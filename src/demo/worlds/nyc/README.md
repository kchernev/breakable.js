# Brick Street (`?world=nyc`)

A New York block on an afternoon: two rows of brick walk-ups facing each other across a two-lane
street, with fire escapes, balconies, air conditioners and flower pots on the ledges, water tanks on
the roofs, pigeons on the copings, lamp posts, cabs and sedans at the curb, hydrants, litter baskets
and mailboxes on the sidewalks, and towers beyond. Everything in the two rows breaks, and so does the
street along them: the road between the curbs (asphalt over earth) and the sidewalks (concrete flags
over earth), where a rocket leaves a crater and the machine gun digs a hole; the street past the row
and the towers don't. The street answers the gun as it answers a rocket (Reactions). It is the
worked example every new world copies (`docs/making-a-world.md`), so it uses the library and the
world contract plainly, one feature where it does the most.

## Files

| File | What it does |
|---|---|
| `meta.ts` | The picker card (order 0). |
| `index.ts` | The definition: sky and look, materials, sounds, dust and chips, and the reactions to blasts and to the gun (`onBlast`, `onShot`, `onBurst`: car alarms, cars losing their glass, the traffic hushing, sirens, the air conditioners, the lamps, the litter baskets; the pigeons and the water in their own files). |
| `city.ts` | The buildings, built from boxes the library bonds where they touch: slabs, the facade's piers, sills and lintels, windows (frames, sashes, panes), ledges with AC units and pots, balconies, fire escapes, parapets, water tanks; the lamp posts, the corner sign and the manhole covers; where the breakable street is (`ROAD`, `WALK`). |
| `materials.ts` | The 18 breakable materials: three bricks, concrete, plaster, glass, painted wood, terracotta, sheet steel, iron, grating, staves, leaves and lamps; the road's asphalt (its double yellow painted on, its sides the aggregate), the sidewalks' flags (each its own, `flagged`; the curb painted on) and the earth under both; the covers' cast iron. |
| `props.ts` | The base pack's props (`public/models`) placed where nothing stands: cars along both curbs (sedans in several paints), hydrants, litter baskets, mailboxes. |
| `scenery.ts` | The street in the world (the bed under the breakable stretch, the ground past the facades), the road and sidewalks past the stretch (`groundEnds`: their layers as pieces that never break, drawn as the slabs are), what a crater shows below them (the earth of the bed, the buildings' foundations), the sidewalk drawn beyond the facades, and the towers down and beyond the street (one shader of window grids, some lit; a fixed box each in the world, which rounds and rockets strike). |
| `water.ts` | The street's water (`Water`): a column from a hydrant's main knocked or shot off it (GPU droplets, the effects' puffs as mist, the fire loop pitched up as its hiss) and the puddle it leaves, which runs off into a hole under any part of it; a rooftop tank leaking from where it's holed, and letting all its water go when it's blown open. |
| `pigeons.ts` | The pigeons (`Pigeons`): 22 in small groups on the copings, the lamp arms and the fire escapes' and balconies' top rails, put up by the gun or a blast, wheeling over the street, coming back down a while after. Two instanced meshes, moved on the CPU. |

7,886 pieces at load: the street's 752 slabs (the road's 432: asphalt 216, earth 216; the sidewalks'
320: flags 160, earth 160), the 12 that never break past its ends and 3 manhole covers; 7,100
breakable in the rows (concrete 2,261, brick 1,369, painted wood 1,068, iron 714, painted brick 486,
glass 424, plaster 342, grating 212, lamps 107, pots 40, leaves 40, AC units 27, tanks 10) and 19
props. With seed 7 no building is dark brown brick, so 17 materials are drawn. Besides: 22 pigeons
(not pieces: two draws) and 26 fixed bodies in the world (the bed, the ground past the facades
both sides, and 23 towers).

## How it's built

- **A building** is floors of walls standing on slabs. Each slab runs out to the facade in panels
  of about 2 m and stops 2 cm short of it, so the facade stands on its own: a stack of piers, the
  block under each window and the lintel over it, carried by the brick below and tied in only at
  its corners. A blast at the ground floor takes out whole brick shapes, and what's above comes
  down when what carries it goes, peeling off and breaking up over the sidewalk and into the
  street, the floors left standing open. Back and side walls are panels;
  a plaster partition with a doorway crosses each floor; ceiling lamps hang under the slabs.
- **No piece much over 2 m** (parapets, coping and slabs are in lengths): a piece much bigger than
  the rest is among the broadphase's large bodies, which every moving piece is tested against, and
  a parapet in one length would come down whole.
- **Its brick is laid as one wall**: every brick piece of a building maps its texture in the
  building's frame (`textureFrame`), so the courses run on across piers, sills and lintels.
- **Windows**: five painted frame pieces and two panes. **Fire escapes**: grated platforms bracketed
  to the floor bands' lips (`d.bond`), railings, stairs whose tilted stringers are bonded to the
  platforms by hand (tilted faces meet only at edges), and a hanging ladder. **Balconies**: a
  concrete slab off the band's lip with a railing, a chair and a pot.
- **Water tanks**: four steel legs, a deck, a twelve-sided tank and a cone roof of staves, both
  shaded round (`smooth: 0.6`).

## How it breaks

- **Brick and concrete** are the presets on Poly Haven and generated textures (`brick_wall_005`,
  `gen_brick_brown`, `gen_brick_painted`, `concrete_wall_008`); broken faces show crushed brick
  (`gen_brick_broken`) or fractured concrete (`gen_concrete_broken`). Slabs and partitions are
  panels of one size: `uvJitter: 1` gives each its own patch of the map. Brick takes its map's
  occlusion (`textured(set, { ao: 1 })`): darker joints. Painted brick is tinted per building
  (`tint`), and its `tintMask` (where the texel isn't brick-red) keeps the chipped spots red.
- **Its mortar is weak once falling** (brick's `strength` 500, the preset's 2.2e4): a front let go
  breaks up as it comes down and where it lands, into a heap of piers, sills, lintels and window
  frames, with the fire escape bent over it. With the preset's, the front toppled whole and lay
  in the road as a sheet with its window grid, or in big panels of it, in four runs of five
  (Checks). It changes only how what falls holds together: what stands carries what it did
  (`support`).
- **Glass** writes depth (dust no longer cuts bright window shapes over the facades). The blast's
  pressure reaches five times its radius for panes (`reach: 5`), and they go to glitter
  (particles), raising no dust (`dustAmount` 0: a puff in each blown window read as a ball of
  cotton). A pane is 3 cm thick, so every shard is under the preset's `minBodySize` and flies as
  glitter wherever it's cut (the library's rule now); a pane breaks into at most four
  (`fragmentSize: 0.35`, `maxPieces: 4`), fewer to cut and fewer particles than the preset's 14 (with
  14: 2-4 % more particles in a collapse, and 642-975 pieces still loose 10 s after it against
  442-529 in four runs of five), and one falling whole breaks where it lands (`landing: 2`).
- **Flower pots** (`pot`, terracotta) break where they land (`landing: 2.5`) into chips.
- **Iron** bends before it tears (the preset's `plastic`): railings and fire escapes come down
  bent, in sections. **AC units** are thin sheet steel (`sheet`).
- **Staves** split along their length (`grain: { axis: 'v', stretch: 4 }`): a tank bursts into
  staves.
- **Lamps** glow only while they stand (`glow: 'standing'`): a ceiling light or a street lamp
  knocked loose goes dark, and its broken faces never glow.
- **What goes through the ground** (a light cell pressed through the sidewalk by a heavy piece
  landing on it, the library's limit: 0-8 a collapse here) is taken out 2 m under the street
  (`destruction: { killBelow: -2 }`), not 50 m down; nothing on this street belongs lower. A piece
  thrown past the ground's ends (130 m out) falls and goes the same way, so `killBeyond` stays at
  the library's 1 km.
- **Props** (the base pack: taxi, sedan, van, hydrant, litter basket, mailbox) rest until a blast or
  a strike throws them; they never break. The sedan's paint takes a tint (its model has a paint
  mask, `scripts/assets/props.mjs` `paint`), so it parks in seven paints (`props.ts` `PAINTS`:
  its own navy, black, red, green, white, beige and gunmetal); this layout shows four of them (red,
  navy, white and gunmetal).

## The street underfoot

- **What breaks**: along the row and 8 m past each end (x -40 to 40), the road between the curbs
  and both sidewalks from the curb to the facades, each laid with `d.addGround` (`index.ts`) on one
  bed 1.2 m under the road (`ROAD.bed`, -1.35 m: the street's fixed body there; `groundAt` gives it
  on the stretch, `inStretch` in `city.ts`):
  - the road: 0.3 m of asphalt over 0.9 m of earth, in slabs of about 2.2 m (6 × 36);
  - each sidewalk: concrete flags 0.2 m deep (`paving`: the preset at concrete's density, a blast
    reaching 0.45 of its radius into it rather than stone's 0.35) over 1.15 m of the same earth, in
    slabs of 2 m (2 × 40, `WALK`). Each slab is one of the map's flags (`gen_sidewalk` at 4 m a
    tile, each side's frame starting on a joint at its curb, the far side's turned round), so what
    breaks is a flag, and the flags beside it stay whole. Each flag is its own (`flagged` in
    `materials.ts`): one of the tile's four, turned or mirrored its own way and a shade lighter or
    darker, by which flag it is, so no two show the same stains in the same place (as laid, every
    other flag showed the same stains); the map's normal (grain and joints, alike in all four) is
    left as laid. The sidewalk drawn past the facades is drawn the same way.
- **Painted on, so it goes with the chunks** (`pieceFrame()`, in the layer's frame): the double
  yellow on the road (`roadSurface`), and the curb along the flags' road edge (`sidewalkSurface`: a
  granite strip 0.22 m wide, the joint behind it, a steel-faced edge, its face down to the road). A
  road crater by the curb shows the flags' edge over the sidewalk's earth. The asphalt's own faces
  other than its top (a slab's edge in a crater's wall, a chunk's sides and underside) show the
  aggregate its broken faces do (`roadSurface`): drawn with the asphalt's map, the chunks' faces
  turned from the light in the shade came out nearly black.
- **Manhole covers** (three in the lanes, `MANHOLES` in `city.ts`): cast iron discs 0.76 m across
  and 3 cm thick lying on one slab each, bonded to it, drawn from where on the disc a point is (a
  raised grid of diamonds worn bright, a groove, the rim: `manholeSurface`). Too small to cut: a
  blast that reaches one throws it whole, a crater under one drops it in, and bullets only ring and
  spark off it (below).
- **What stands on it**: the lamp posts and the corner sign bond to the flag under them and go with
  it; the props rest on the slabs (the cars on the road; the hydrants, litter baskets and mailboxes
  on the flags) and drop into a crater or stay on what's left.
- **Past the stretch** (`groundEnds` in `scenery.ts`): the same layers to the street's ends as
  static pieces mapped in the slabs' frames, so the light, the map, the lines and the curb run on,
  and a crater at the stretch's end shows their edges. Beyond the facades (under the buildings, and
  past the row's ends) the sidewalk is a drawn plane, its flags on the stretch's joints: where it
  meets the slabs, along the facade line, is a joint.
- **What a crater shows** past the slabs: the earth of the bed (a plane at the bed) and, down the
  facade line, the buildings' concrete foundations (planes from the bed up to the sidewalk). The
  ground past the facades is a fixed body 2 m deep, its foot under the bed. A bullet into the bed
  strikes it as earth (the ground's lowest layer), and into the foundations as concrete, a hole
  (`pitSide`: the side of a pit there is the scenery's stone, not the sidewalk's layers).
- **Craters** (a rocket's 2.3 m blast): in the road 2.7-3.5 m² open and 0.6-1 m deep, now and then
  to the bed (a big cell whose middle the blast reached goes whole); in the sidewalk about 2.4 m²
  and 0.7 m deep, the flags lifting in chunks and the earth under them spraying; at the curb both.
  Each adds 35-70 ground pieces (the cells left standing round it, and chunks at rest). A rocket into
  the sidewalk within 2 m of a facade still brings the front down over it, as before.
- **The player** walks down into a crater and out of it without a stop (down to the asphalt's
  bottom, -0.45 m, and up over the chunks on the far side), and through a sidewalk crater.
- **Footsteps**: on the flags and the asphalt `steps.asphalt` (the hard step); on the earth and on
  the bed in a crater, `steps.rubble`.
- See `docs/changelog/phase-e/ground.md` for how the library lays and breaks a ground.

## The machine gun here

The demo's gun (power 6, 14 rounds a second, no reload: `docs/changelog/phase-e/weapons.md`), as it does to
this street's materials, measured standing 3-6 m off (`Destruction.shoot`'s damage per piece; the
first round to break a piece is where it gives way):

- **At once**: panes, the window frames (painted wood), pots, leaves and lamps: every round that
  struck one in a 9 s sweep along a row broke it (18 frames, 39 panes, 3 leaves, 2 lamps, a pot).
- **Soon**: brick. Held at one spot of a ground-floor wall, the 5th round broke a block and 48 of 64
  broke something after, into the plaster behind; six rounds take a sill block out under its
  window. Swept along a row, the rounds spread: 22 of 173 on brick broke something, 13 of 36 on the
  concrete bands and ledges, 2 of 6 on the AC units.
- **The street**: a fresh asphalt slab gives way at the 6th round, a flag at the 9th to 17th (spread
  over two flags), and then nearly every round breaks something on down to the earth (`bullet.dirt`,
  a pock in it), the double yellow and the curb going with the chunks. Held 10 s at one spot of the
  road (141 rounds), with the library's bite this phase (`docs/changelog/phase-f/pile.md`): 103 broke
  something, a ragged pothole 1.85 m² open and 0.99 m deep, +69 ground cells standing and +11 at
  rest, the chunks thrown out to its sides (phase E's: 126, down to the bed, +94 standing in a pile
  of wedges).
- **Holds out**: iron (railings, fire escapes, lamp posts: 47 rounds sweeping and 23 at one post,
  none broke), the grating, and the manhole covers, which only spark, ring and dent (their `impact`
  makes it about 900 rounds at one spot: a cover the gun knocked loose slid 4 m across the road).
- **Props**: the cars dent and don't move, but their alarms go and their windows burst
  (Reactions); a litter basket skitters off at the first rounds, spilling paper, and goes over; a
  mailbox is pushed back a metre by 16; a hydrant cracks off its main at the 3rd round and goes over
  (and, as before, drops and bursts when the flag under it is shot through).
- **The towers** beyond the street are fixed boxes in the world now (`skyline`): a round fired at
  one, or out through a building, strikes it as the scenery's stone (`bullet.concrete`, chips, a
  hole) and its tracer ends there; a rocket goes off on it. Before, they were drawn only: 28 rounds
  at one struck nothing (now 26 struck it; the other two, the view climbing through the burst, went
  over its top).
- The street hears the gun (Reactions): the hooks this phase (`onShot`, `onBurst`) are where its
  reactions to rounds are.

## Look

- **Sky**: Poly Haven's `qwantani_afternoon_puresky_1k.hdr`, the sun at azimuth 1.15 from the
  HDRI's height. `sky.environment` 0.05, `look.hemisphere` 0.7 and `look.fill` (3.9, from where
  the old sky turn put the sky's sun) were set by the runtime team when the sky was turned the
  right way (`docs/changelog/phase-c/runtime.md`): keep them when editing those blocks. No
  `sky.elevation` (the HDRI's afternoon height is the look) and no `look.haze` (a short, shaded
  street).
- **Dust and smoke**: `look.smoke: { life: 0.75 }`, so a blast's brick-dust cloud clears in about
  6 s and the collapse it caused shows; `look.dustPalette: { blend: 0.6 }`, so dust takes more of
  its material's colour (`dust`) over the warm palette. `dustAmount`: masonry raises the clouds;
  lamps 0.2; iron, grating, AC units 0.15; painted wood 0.4; pots 0.5; leaves 0.3; glass none.
- Every effect is warmed by the demo (`effects.warm()`); the hydrants' droplets and puddles are
  drawn (empty) from the start, and their kernel run at that first draw (the demo's, before play),
  and the pigeons sit in the scene from the start, so nothing is made after the card and the first
  burst compiles nothing.

## Sound

- **Bed**: the base pack's `ambience.city` (1.65, quieter up high) and `ambience.wind` (louder up
  high), at the mix's -33 LUFS standing at the start (`docs/changelog/phase-c/sound.md`).
- **Materials**: the base pack's (`packMaterials`). A section landing whole is heard once
  (`land`, the `'landed'` event): brick `brick.impact.large`, concrete `concrete.impact`, iron and
  the cars `metal.impact.large`. Shared sounds at a material's own pitch (`pitch`): plaster 1.15,
  pots 1.4, AC units 1.35 (iron's sounds), lamps 1.25 (glass's).
- **Bullets** (`bullet` in each material's sounds; the gun's strikes are in the base pack): brick,
  painted brick and pots `bullet.brick` (pots at their 1.4); concrete, the flags (at 1.08), the
  asphalt (at its 0.85) and plaster (at its 1.15: render cracks, it doesn't thud as brick)
  `bullet.concrete`; the earth `bullet.dirt` as made (its `pitch` lowers only its strikes and
  debris); frames and the tanks' staves (at 0.9) `bullet.wood`; leaves `bullet.dirt` at 1.3 (a soft
  rustle and thud); iron, the cars, the grating (at 1.15), the AC units (at their 1.35) and the
  covers (at 0.8: heavy, ringing) `bullet.metal`; panes and lamps (at their 1.25) `bullet.glass`.
- **Footsteps** by what's underfoot (`footsteps.surface`): iron (a fire escape's grating, a car's
  roof, a fallen railing) plays `steps.metal`; rubble, and down in a crater the earth and the bed
  under it, `steps.rubble`; the rest (the asphalt, the flags) `steps.asphalt`.
- **Its own pack** (`audio.packs: ['packs/nyc/sounds/']`): the reactions' sounds (Stable Audio 3,
  `scripts/assets/packs/nyc/sounds.mjs`) and `steps.metal`, made from the base pack's takes
  (below). Levelled in play against the like sounds of the other worlds' packs (each file's loudness
  times its `volume`): `pigeons.scatter` at 0.7, as loud as Market Town's `birds.scatter`;
  `lamp.short` at 1, as loud as Neon Alley's `lamp.pop`; `ac.hiss` at 0.9, a few dB under a pane
  bursting; `water.leak` at 0.35, 4 dB under Harbor Yard's `fuel.leak` (it's up on a roof). Voices:
  one flock's wings at a time, two of each of the rest; the car alarms two (`alarm.car`).

## Reactions (`index.ts`, `water.ts`, `pigeons.ts`)

To blasts (`onBlast`), to the gun (`onShot`: each round that strikes something; `onBurst`: each
burst as it ends), and to what the library sends (`'landed'`, `'state'`, `'impact'`, `'fracture'`).
Each is bounded: what a 70-round burst sets off is counted in Checks.

- **Car alarms**: a parked car shot sets its own alarm off (the first round into it); a blast of
  2 m or more, half the time, that of one of the cars within 15 m along the street; a car landing at
  over 3 m/s (`'landed'`, subscribed in `onStart`), or something heavy coming down on one, its own.
  Each goes 14–26 s; a car whose alarm has stopped stays quiet for 45 s; two at most at once (a
  third cuts the oldest short: `alarm.car` has two voices).
- **Glass off a car**: past its 3rd round, each round into a car bursts the window nearest it (the
  windscreen, the back window or a side window), each once: glass chips and glitter off it
  (`effects.impact` and `effects.bullet` as glass), `glass.shatter`, then `glass.debris`. A car's
  first hard landing (over 5 m/s: thrown, dropped, or slammed into another) bursts what it has left.
  The model's glass stays drawn (Known issues).
- **The traffic hushes**: a blast, a burst of the gun as it ends, or the gun kept going half a
  second turns the city bed down to a third (`rt.ambience`), and it comes back over 12 s once it has
  been quiet for 20 s. The wind stays.
- **Sirens**: enough noise in a while brings distant sirens for 45 s: each blast adds its radius,
  each burst 0.08 a round (150 rounds as much as five blasts), decaying over 30 s; past 12.
- **The pigeons** (`pigeons.ts`): 22 in groups of two to five on the copings (along the lip on the
  street side), the lamp arms and the fire escapes' and balconies' top rails, each turning a little
  where it sits now and then. A round striking anything, a burst or a blast puts them all up, the
  nearest first (0.05 s, a second more for every 45 m, and up to 0.4 s more), with one
  `pigeons.scatter` (wings clattering; one voice, 4 s apart) from where most of them went: off the
  perch up and out into the open, then wheeling as a loose flock round an ellipse 30 × 10 m over
  the street at about 28 m, over where the noise was. 18–42 s after the last noise each comes back
  down by itself, to its own perch if it's still there and free (else any free one still standing),
  by a point 3 m out from it and 1.2 m up, slowing, its wings raised. A perch knocked out from under
  one sends it up. Drawn as two instanced meshes (the bodies; the wings folded, beating about six
  times a second, or held in a V on a long glide), lit, casting shadows, in the scene from the
  start, moved on the CPU.
- **Hydrants**: one knocked off its base (gone, moved 25 cm, or lifted or dropped 10 cm: the flag
  under it shot through or blown out), struck at over 4 m/s by something heavier than 0.05, or shot
  three times (cracked off its main and pushed over the way the rounds went) sprays a column from
  its main (from the crater's floor, if the sidewalk under it has gone): about 7 m high, with spray
  splashing round the base, white water up its core and mist where it turns over and lands (the
  effects' puffs), and a puddle spreading along the curb and back from it, which dries slowly
  after. The pressure falls off to nothing over 20 s (the column's height with it), and the hiss
  (the base `fire.loop` at 1.45 × its pitch, where its crackle turns to spatter) falls in volume and
  pitch with it. The droplets are GPU particles drawn as the effects draw their bits (streaked
  along their motion, lit by the scene's sun and sky, a glint looking toward the sun, fog by hand,
  on the particles' layer): one pool of 4,096 for the hydrants and the tanks. A droplet ends where
  it meets the pavement past the stretch (the sidewalk's top, or the asphalt's 15 cm lower), and on
  the stretch at the bed: down into a crater, and through the pavement where there's none (hidden
  by it). The puddle looks under itself five times a second: every 8 cm of it, out to 0.9 of its
  radii (where it's still wet enough to see), against the tops of the flags still standing round
  the hydrant (its sidewalk's slabs, and the cells cut from them as they break: `'fracture'`), seen
  from above. Where any of it lies over a hole it runs off into it, shrinking fast until it's
  clear, and none forms over one, so it never lies over a crater or a flag shot through. A hydrant
  with no model (the base pack missing) is a box and doesn't spray.
- **Rooftop tanks** (`water.ts`): a round into a tank's staves below its water (full: to 15 cm
  under its top) leaks from the hole: a stream out of it as hard as the water over it pushes (0.55
  × √(2gh), weakened by the ragged hole: about 3.5 m/s from a hole 2 m down), each droplet living
  as long as its fall to the roof, with mist where it lands; the water falling as it runs (1.2 cm
  a second at a metre's head), each leak stopping once the water is down to it. Three a tank, six
  in all; `water.leak` at the hole for two of them. A tank shot or blown open lets its water go at
  once: 900 droplets out through its staves and down over the roof, mist, and a gush (`water.leak`,
  louder, fading over 1.8 s).
- **Air conditioners**: a round into a window unit (its box or its grille): a spit of blue-white
  sparks off its works, its gas blowing out of the hole in white puffs for 2.5 s, weakening, and
  `ac.hiss` (a tinny clank, then the gas hissing out and the fan rattling down). Once a unit.
- **Lamps**: a street lamp or a ceiling light knocked out of its fitting (by a round, a blast, the
  ceiling coming down: `'state'`) spits sparks and pops (`lamp.short`), one at most every 0.2 s (a
  blast takes out dozens).
- **Litter baskets**: a round into one spills paper (white chips) as well as its sparks; it
  skitters and goes over.
- Not answering more than they did: the corner sign (its blades shoot off at the first round) and
  the mailboxes (pushed and dented).

## Assets

Brick Street's pack is the base pack: `public/textures` (`scripts/assets/textures.mjs`),
`public/sounds` (`scripts/assets/sounds.mjs`), `public/models` (`scripts/assets/props.mjs`), each
with its credits. The earth under the street is Poly Haven's `rocky_trail_02` (CC0; `EARTH` in
`materials.ts`), greyed: the same maps as Market Town's, copied into this pack's `textures/` so it
stands alone (the dev servers now serve files added under `public/`). The street's new looks are
all drawn from these: the flags and
the curb from `gen_sidewalk`, the covers' iron from `gen_iron_painted` (their pattern drawn in the
shader), the foundations from `concrete_wall_008`; no paid calls were made for them. Its own
folder, `public/packs/nyc/` (credits in `CREDITS.md`):

- `sounds/steps.metal`: ten slices made by `scripts/assets/packs/nyc/steps-metal.mjs` (ffmpeg, no
  paid calls) from the base pack's `steps.asphalt` slices with the first 0.3 s of a
  `metal.impact.small` take under each, a third higher, high-passed and faded. At its volume (0.24)
  it measures -32.2 LUFS back to back, as loud as the asphalt steps at 0.3.
- `sounds/pigeons.scatter` (2 takes), `ac.hiss`, `lamp.short`, `water.leak` (a loop): Stable Audio 3
  Medium, one take each but the pigeons', from the prompts in `scripts/assets/packs/nyc/sounds.mjs`
  (`PACK=nyc node scripts/assets/generate-sounds.mjs`, then `process-sounds.mjs`), raws and how each
  was made in `assets-src/packs/nyc/sounds/`. Looked at as spectrograms and envelopes, not asked of
  the audio model (no paid QA): the pigeons' takes are clusters of wing claps fading out; the lamp a
  sharp pop and a buzz dying away; the leak an even splatter. `ac.hiss`'s take came as the hiss and
  a rattle, then a clank 2 s on: laid out clank first (`parts`). Five takes, $0.19
  (`assets-src/packs/nyc/ledger.jsonl`).

The sedan was processed again with `paint: { hue: [195, 255] }` (`PACK` unset: `~/.local/bin/blender
-b --factory-startup --python scripts/assets/process-props.py -- sedan`, from its raw take, no paid
call): 43 % of its texels are paint, greyed, and `index.json` gives it `tintMask: 'alpha'` and its
navy as `tint`. Its collider is unchanged. With `grow: 3` (a `process-props.py` paint option) the
paint's rims count as paint too, so a car painted another colour shows no pale seams:

- where the paint fades out beside solid paint (the rims of its regions, highlights just under
  `minSat`), out to three texels: these took the grey but only part of the tint;
- the light grey texels the bake left round the paint (`paint_rims`): within three texels of solid
  paint where no unpainted face draws from them (so the chrome trim, the glass and the lights keep
  theirs), and those the panel gaps are drawn from. A gap is a run of slivers (faces under a texel
  across) between painted faces, drawn from a strip of light and dark texels packed beside other
  parts in the atlas: a red car showed it as a white dashed line down each door seam and the
  fender's. Now its light texels are paint and its dark ones the gap's line.

74 k texels were made paint (the mesh, the other maps and `index.json` are the same).

## Checks

Typecheck, tests (218; `tests/hull.test.ts`' timing check failed once with the machine at a load of
27, and passed alone) and build pass. No console errors or warnings, and no pipelines made after the
card through rockets into the street, the gun on the road, the flags, a wall and a cover, a
hydrant's burst in a crater, and every reaction below.

### The street under the gun (phase F)

On the RTX 4090 here (display :106, 1280 × 720), the GPU shared with up to 17 other Chromes (a load
average of 22-27; one run ran out of GPU memory and is left out). Scripts and screenshots:
`scratch/phase-f/nyc/`
(`react.mjs` each reaction in a page of its own, `pipes.mjs`, `towers.mjs`, `crater.mjs`,
`flags.mjs`, `puddle.mjs`, `pitside.mjs`, `ab.mjs` the A/B; `out/`). What played is counted by
wrapping the sound engine's `play` (a voice given: played).

- **A parked car** (a sedan, 6.5 m off): 3 rounds, its alarm (`alarm.car` 1), the pigeons up
  (`pigeons.scatter` 1), the traffic hushed (once); 8 more, two windows (`glass.shatter` 2); 70
  more (50 of them into the car, the rest into the wall behind as the view climbed): still one
  alarm, three windows in all (the far side's was never the nearest a round), one scatter, one hush
  (`out/react-now-car-glass.png`).
- **A hydrant**: 2 rounds, nothing but dents; the 3rd cracks it off: its hiss (`fire.loop` 1), the
  column up, the hydrant 1.2 m off on its side (`react-now-hydrant-column.png`).
- **Bursts** (three of 70 at a facade, 5.5 s apart): one scatter, the bed turned down once, the
  sirens after the third (`siren.far` 1). Held as in the A/B below (350 rounds a run): one scatter,
  the sirens once, 2-3 lamps shot out (`lamp.short`), no alarm (no car in the line of fire).
- **An air conditioner**: 2 rounds, `ac.hiss` 1, its sparks and gas (`react-now-ac-sparks.png`,
  `-ac-vent.png`); 28 more, still one.
- **A street lamp**: 2 rounds, `lamp.short` 1 and its sparks (`react-now-lamp-sparks.png`); four
  blasts into a building's first floor then, 4 more (its ceiling lights).
- **A rooftop tank** (holed from 13 m out, flying): 3 rounds, 3 leaks and two of them heard
  (`water.leak` 2), the streams arcing onto the roof (`react-now-tank-leak.png`, `-leak-side.png`);
  30 more shot it open: its water went (`water.leak` 1 more, the gush) and the leaks stopped.
- **A litter basket**: 4 rounds, paper and sparks off it, the basket 0.9 m off on its side.
- **The pigeons** (`pipes.mjs`, on a build): all up within 4 s of the first round, wheeling over
  the street (`out/birds-up-pair.png`), all 22 sat again 42 s after the last noise. No pipelines
  were made after the card through all of the above, a crater and a tank blown open.
- **The fixes**: the asphalt's sides in a crater on the shaded side (`out/crater-pair-*.png`, before
  on the left); the towers: 28 rounds at one struck nothing before, 26 now (`bullet.concrete` 26, 26
  marks, `towers-now-marks.png`); the flags (`flags-pair-*.png`, `flags-crop-above.png`: before
  above, every other flag's stains the same); the puddle (`puddle.mjs`: a hole shot through the
  flags between the old check's points, 0.6 of the way out: before, the puddle lay on over it at
  3.1 m; now it drained to 1.5 m, clear of it, and kept its edge there). The footing in a pit by a
  facade strikes as concrete, the pit's floor as earth (`pitside.mjs`).

**Frames, before this phase and now** (`ab.mjs`: production builds of both, served to the same
Chrome by request interception, in turns):

| | before | now |
|---|---|---|
| pieces at load; loose in the 10 s after; standing lost | 7,886; 0; 0 | 7,886; 0; 0 |
| idle, vsync and the frame cap off, mean (median), 6 pairs | 4.26-4.57 (4.6-4.9) ms | 3.57-4.77 (2.6-4.9) ms in four; 5.81 and 14.0 in two run under contention |
| the world's CPU a frame (its update, the effects, the sounds), idle / firing | 0.02-0.04 / 0.19-0.33 ms | 0.03-0.07 / 0.21-0.27 ms |
| 70 rounds at a brick wall 6 m off, vsync on, 3 pairs: mean frame (standing just before) | 23.3-32.5 (19.8-29.6) ms | 21.6-41.8 (23.2-27.2) ms |
| then 20 s held sweeping 0.6 rad (+6 s): mean; over 40 ms; rounds that broke something | 24.2-37.3 ms; 82-279; 144-183 of 249-276 | 24.8-29.9 ms; 84-156; 174-203 of 269-280 |
| four blasts at x 10-22 (phase D's): loose at +10 / +20 / +40 s | 455-526 / 3-98 / 0-7 | 543-933 / 25-202 / 0 |
| … frames over 40 ms from the first to +10 s; worst | 105-124 of 381-408; 122-180 ms | 131-169 of 295-372; 111-149 ms |

The front comes down as it did, and everything is at rest by +40 s. The frames are the shared GPU's
more than either build's: the same world standing differed by 10 ms a frame between turns. A second
round (two pairs of the collapse, two of idle) ran with the machine at a load of 70-80, the idle
frame 16-21 ms uncapped on both, and is left out.

### The street underfoot (phase E)

On the RTX 4090 here (display :106, 1280 × 720), the GPU shared with other agents' Chromes (40-60 %
busy, its memory nearly full: three runs ran out of it and were left out). The street as it was at
the start of this phase (the road breakable, the sidewalks drawn) and as it is now, each a
production build served to the same Chrome, in turns: standing 10 s, the street view 8 s, then
four blasts 1 s apart along the building at x 10-22 (phase D's), counted at +10/+20/+40 s.

| | before (4 runs) | now (5 runs) |
|---|---|---|
| pieces at load | 7,555 | 7,886 |
| loose in the 10 s after load; standing pieces lost | 0; 0 | 0; 0 |
| idle, vsync on, mean frame | 19.3-27.5 ms | 23.5-27.3 ms |
| idle, vsync off, mean (median), 3 pairs | 2.94-3.55 (2.2-3.9) ms | 3.11-3.58 (2.5-3.8) ms |
| first blast to +10 s: frames over 40 ms; worst | 33-124 of 384-525; 66-116 ms | 80-111 of 370-426; 84-204 ms |
| … the destruction's CPU a frame, mean (2 runs each) | 1.9-2.6 ms | 2.4-2.8 ms |
| loose at +10 / +20 / +40 s | 364-421 / 6-51 / 0 | 348-782 / 23-414 / 0 |
| the street's slabs broken by the collapse | 0 | 0 (752 stand) |

The front comes down as before, peeling into the street over the sidewalk, the floors standing
(`out/ab-*-top-*.png`). The README's own four along the front at x -1 to 6.5 (one pair): 104 of 380
frames over 40 ms, worst 167 ms, loose 475 / 1 / 0 before; 119 of 361, 157 ms, 492 / 71 / 0 now.
What a collapse leaves on the flags settles a few seconds later than it did on the drawn sidewalk
(Known issues); everything is at rest by +40 s, as before.

Scripts and screenshots: `scratch/phase-e/nyc/`
(`views.mjs`, `crater.mjs`, `gun.mjs`, `sweep.mjs`, `phase.mjs`, `ab.mjs`; `out/`).

### Phase D: the collapse, as measured then

On the RTX 4090 here (display :106, 1280 × 720), the GPU shared
with four other agents' Chromes, so the world as it is and as it was before this phase (brick's
`strength` 2.2e4, `killBelow` 50 m down and glass's dust put back in the page) were loaded in
turns, five times each: standing 10 s, the street view for 5 s, then four blasts 1 s apart along
the biggest building's ground floor (x 11.5 to 20.5, y 1.2), counted at +10 to +40 s after the
last, with no screenshots while frames were timed.

| | as it was | now |
|---|---|---|
| pieces at load | 7,119 | 7,119 |
| loose pieces in the 10 s after load; standing pieces lost | 0; 0 | 0; 0 |
| console errors and warnings | none | none |
| idle, mean frame (vsync 16.7 ms) | 19.7–24.2 ms | 22.1–25.5 ms |
| first blast, worst frame in the 1 s after | 51–105 ms | 52–92 ms |
| first blast to +10 s: frames over 40 ms | 53–142 of 364–502 | 84–110 of 373–427 |
| … worst frame | 62–127 ms | 75–148 ms |
| … the solver's step on the GPU, mean (p95) | 2.8–5.7 ms (5.8–13.6) | 4.0–4.7 ms (9.9–11.5) |
| loose 1 s after the last blast | 1,533–1,632 | 1,521–1,550 |
| loose at +10 / +20 / +30 / +40 s | 382–871 / 12–200 / 0–11 / 0 | 250–500 / 29–132 / 0–9 / 0–2 |
| past 120 m; the farthest | 0; 30–115 m | 0; 34–53 m |
| cells ever under the ground, 5 cm / 1 m | 0–12 / 0–10 (fell to -50 m) | 0–4 / 0 |
| the front's 101 pieces: lying flat in the road at +40 s; still whole | 11–33; 52–58 | 3–13; 46–49 |
| … the most of them still joined at +10 s | 2–45 | 1–2 |
| the front from above at +40 s | a sheet with its window grid in the road in 2 runs, big panels in 2 | a heap in all 5 |

The loose left at +40 s are a few pieces of the fire escape and a slab still settling. The frames
are the shared GPU's more than either version's (the idle frame, the same world standing, differs
by as much between the turns); the collapse's frames less the idle's are alike (5–13 ms now, 2–12
ms as it was). Of a frame over 40 ms the CPU's share is 8–10 ms (the destruction 3.5–4.5, encoding
the frame 3.3–4.3, the world's update and effects about 1); the solver's step is 4–5 ms of GPU
with about 1,500 pieces loose. What the world sets that weighs on a collapse was tried in turns
on the same GPU (three runs each): masonry in at most 10 cells a break instead of 16 and 14 made
more of them bodies, not fewer (1,774–1,925 loose 1 s after against 1,526–1,567) and as many slow
frames (87–102 over 40 ms against 42–125); half the masonry dust was lost in the noise (25–177);
drawing no particles at all, 26–47. Nothing was cut: the dust is the collapse's look, and the
cells were cut last phase.

The README's own four along the front at x -1 to 6.5 (three runs, now): loose 139–213 / 0–1 / 0 at
+10 / +20 / +40 s, nothing past 120 m (the farthest 27–54 m), 4–8 cells through the ground (taken
out at -2 m), frames over 40 ms 66–107 of 415–454, worst 78–153 ms; its front comes down to a heap,
and most of the floors behind it with it (pieces of slab stay at the side walls). As it was (two
runs): 85–404 loose at +10 s, 0 at +30 s; one run the same, and in the other the front over the
hole stayed up for good, held at the side walls.

Pipelines made after the card (standing, a blast, a hydrant's burst): 0. A blown pane leaves no
puff.

## Known issues

- **Window units fall out whole**: a frame's joints are painted wood's (1.4e4), so a window
  leaves a breaking front as one frame with its sash and panes, and a few slide out into the road,
  lying there like picture frames. Not changed: they read as windows torn out.
- **Tinted sedans keep a few marks**: small light scratches in the paint low on the doors and round
  the rear window, and the windscreen's white streaks, which the image-to-3D model baked into the
  glass (on every copy, the navy too).
- **Slow frames in a collapse** (library and the shared GPU): a fifth to three tenths of the
  frames in the first 10 s after four blasts here are over 40 ms, the worst 66–204 ms (Checks).
  Most of each is GPU; now and then the destruction's own CPU time is 20–38 ms in a single frame
  (its breaking and resting checks).
- **A collapse's rubble settles later on the flags** (library): what lies on a breakable ground's
  standing slab isn't on "the ground" to the resting check (in a ground's area the ground is its
  bed), so each piece there takes its slower look at the pieces under it, and fewer come to rest
  in a frame's 2 ms. With the sidewalks breakable, loose at +10 s 348-782 against 364-421, at +20 s
  23-414 against 6-51, the destruction's CPU 0.5 ms a frame more over the first 10 s; all at rest by
  +40 s as before. A fix in the library: take a standing ground slab's intact top as the ground
  there (in `support()`'s first look).
- **Held fire still adds ground pieces** (library): the gun now bites a pothole into the road or
  the flags (`docs/changelog/phase-f/pile.md`), but what stands round it stays: +69 ground cells in 10 s at
  one spot of the road. The piece budget (`maxPieces` 9,400) takes back rubble at rest, not what
  stands.
- **The sidewalk past the facades is a drawn plane**: past the row's ends, where it meets the
  slabs along the facade line, a joint a shade lighter or darker in some light.
- **The puddle drains whole**: over a hole anywhere under it, it shrinks until it's clear of the
  hole (on all sides, not only that one), and keeps its edge there while the water runs.
- **Bullets never knock a cover loose** (about 900 rounds at one spot): at the `impact` metal
  takes, 56 rounds popped one out of the road and it slid 4 m, as if light.
- **An `alphaMap` that varies** on a transparent `MeshStandardNodeMaterial` drew as if sampled at a
  corner (nothing, for a radial falloff; a uniform map worked); the puddle samples its falloff in
  `opacityNode` instead.
- **Not used here**: hinges (nothing on this street hangs; a hung piece at rest no longer counts as
  moving, so one could), `sky.elevation` and `look.haze` (above).
- The hydrants' water collides with nothing but the ground: it falls through cars and balconies. A
  tank's leak ends at its roof's height (each droplet lives as long as its fall), through anything
  in its way (the tank's legs, a parapet).
- **A car's glass stays drawn**: its windows are part of the model's one mesh, so a window that
  goes is its glitter, chips and sound; the model still shows it (with the rounds' dents on it).
- **The pigeons fly through what's in their way**: they keep above the roofs while they wheel and
  come down onto a perch from the street side, so they seldom meet anything, but nothing stops one
  (a collapsing front, a tower down the street). A rocket's dust hides them as it hides the rest.
- **A tank blown open by a rocket** lets its water go, but its spray is lost in the blast's dust
  from the street; shot open, it shows.
- **The towers strike as stone all over**: their windows are drawn in the shader, so a round into
  one cracks and holes it as concrete, not glass.

