# Phase E: breakable ground and the machine gun

These are the notes of phase E, kept as they were written when its teams' work came together (only
their links to each other changed, when they moved here from `docs/changes/`). The user asked for a
ground that breaks and a machine gun as a second weapon. Four teams built them at once: the ground
team (`ground.md`: slabs a rocket craters, the player in the crater), the weapons team
(`weapons.md`: the gun, switching, bullets in the library, strikes and marks on surfaces), the
gun-model team (`gunmodel.md`: `gun.glb`) and the gun-sounds team (`gunsounds.md`: twelve sounds
in the base pack). Then the user made the gun much stronger and took its reload away (below).
Their own notes, with the numbers and the reasons, are next to this file. This page is the short
account, for the world teams: what was new, what every world got without asking, what each world
could do, and what was checked with everything together. The vendored solver didn't change.

Since then each world has laid a breakable ground of its own (all six have one: Brick Street's road
and sidewalks, Market Town's square, Dust Town's street, Neon Alley's alley, Harbor Yard's yard,
Sun Temple's court and hilltop) and says what a bullet sounds like on each of its materials; each
world's README says what it did and what it measured. `docs/making-a-world.md` describes what a
world author needs of it all (the last section here, "Where `docs/making-a-world.md` is out of
date", and the teams' suggestions for it have been folded into it: read that first). "Per world"
and "Still open" below are as they stood then. The user's change to the gun (the first section) is
current; the older parts of the four notes that it names are not.

**No world has to change anything.** All six load with no console errors or warnings, stand (no
standing piece lost, nothing loose for 10 s after load but what's meant to move), idle as before,
take rockets as before and have the gun. Brick Street's road is the one breakable ground; the
other worlds' grounds are as they were. The typecheck, the tests (204) and the build pass.

## The user's change: a much stronger gun that never reloads

Made after the weapons team's review fixes; it overrides their brief. Don't bring a magazine or a
reload back, and don't make a world's materials tougher to weaken the gun.

- The gun fires for as long as the trigger is held: 14 rounds a second, a tracer every other round.
  No magazine, no rounds counted, no reload (no <kbd>V</kbd>, no middle button; the HUD shows the two
  weapons and which is in hand). `gun.reload` and `gun.empty` stay in the base pack, unused by the
  demo. The model's `magazine` node stays seated.
- Power 6 (`POWER` in `src/demo/gun.ts`): each round is `Destruction.shoot(at, dir, 6)`. By `weapons.md`'s
  figures a quarter-metre brick, a board or a pane goes at the first round, a 0.5 m pier in 2, a 2 m
  concrete block in about 8, a steel plate in a few dozen (each world's own pieces are below). With power over 1 a round that breaks something breaks it as a small
  blast: the cut's radius, its cells' speed and its cell budget grow by the cube root of the power
  (×1.82: up to 0.73 m, 5.5 m/s, 22 cells), and the standing pieces within half that radius go with
  it. Loose things are pushed 6 times harder (at most 6 m/s, as before).
- Older parts of the notes describe the gun before this: `weapons.md` below its first section (11
  rounds a second, a tracer every third, the magazine and reload, what broke at power 1),
  `gunsounds.md` on the reload, the empty click and bursts at 11-12 a second, `gunmodel.md` on the
  reload's pose. Their first sections and this page are current.

## New

### Breakable ground (`ground.md`)

- `d.addGround({ material, under?, area, top?, depth?, underDepth?, cell?, textureFrame?, toss?, tint? }): Ground`
  in `build()`: a road or a square laid as slabs over `area` (`[x0, z0, x1, z1]`), a top layer over
  an optional one under it, resting on the world's fixed bed at `ground.bed` (`top - depth -
  underDepth`). A slab is held up by what's under it, never by what's beside it; what stands on a
  slab bonds to it and goes with it. A blast leaves a crater and throws its chunks up and out round
  the rim; bullets chip and break the slabs; the player walks down into a crater and out (a jump
  gets out of a deep one).
- `groundPresets.asphalt`, `cobbles`, `sand`, `paving`, `earth`, `gravel`, `fill`: materials like
  `presets.*` (pass a `surface`). Only asphalt over earth has been tried in a world.
- `d.groundAt(x, z)` (a ground's bed inside its area, else `ground`), `d.grounds`, `piece.ground`
  (the ground a standing slab or cell was laid as), `Ground.contains(x, z, margin?)`.
- The demo: a bullet into a crater's bed strikes the ground's lowest layer (`under ?? material`);
  chips of a strike and a crater's debris land on what's under them (the slabs, rubble), not on
  `groundAt`; the player stands on the highest of five points under the foot's breadth (no more than
  a step, 0.5 m, up), and the eye eases up after a step up.

### The machine gun (`weapons.md`, `gunmodel.md`, `gunsounds.md`)

- Playing: <kbd>1</kbd> the launcher, <kbd>2</kbd> the gun, the wheel goes round them, <kbd>Q</kbd>
  back to the last one (flying, Q still goes down). Hold the button to fire. Switching takes 0.3 s;
  a trigger held through it fires the gun once it's up.
- Its model is `kit.gun` from `loadKit()` (`public/packs/kit/models/gun.glb`: a made-up light
  machine gun in the launcher's olive drab, 24k triangles), held and drawn as the launcher is.
- Library: `d.shoot(at, direction, power = 1, range = 500): ShotHit | null` (`ShotHit`: a `RayHit`
  with `material`, `broke`, `damage` 0-1). It strikes the first standing piece, rubble, prop or
  loose piece (where it is now), pushes what's free to move (`bulletPush(mass, power)`), adds
  `power` to what the piece has taken and breaks it where it was struck once that passes
  `bulletsToBreak(material, size)`, through the same breaking budget and weighing as blasts. Props
  and static pieces never break. `materialKind(name, material, sounds?)` says what a material is
  for a strike's sound and look (`MaterialKind`: brick, concrete, metal, wood, glass, dirt).
- `MaterialSounds.bullet` (a sound name): what a bullet striking the material sounds like, in the
  world's `audio.materials`; default `bullet.<kind>` of `materialKind`. It plays at the material's
  `pitch`: a number pitches every kind of its sounds, the bullet's too; `pitch: { bullet: 0.9 }` this
  kind alone. `DestructionSounds.bullet(at, material, kind?, glance?)` plays it, and now and then off
  metal and stone a ricochet (more often grazing).
- Sounds in the base pack (every world loads them; a world pack's sound of the same name replaces
  one): `gun.shot`, `gun.tail` (the echo after a burst), `casing.drop`, `bullet.brick`,
  `bullet.concrete`, `bullet.metal`, `bullet.wood`, `bullet.glass`, `bullet.dirt`,
  `bullet.ricochet`, and the unused `gun.reload`, `gun.empty`. Their levels are in the pack's
  `index.json`; a world re-levels one in `audio.settings` (the demo plays `gun.shot` at half its
  pack level).
- In the demo: `Weapons` and the `Weapon` interface (`weapons.ts`), `Gun` (`gun.ts`), `groundKind`.
  For scripted checks: `demo.weapon('gun' | 'launcher')`, `demo.fire(n)` (n rounds, or n rockets,
  at the weapon's pace, where the crosshair is), `demo.gun`, `demo.weapons`, `demo.stats().marks`.

### Strikes and marks on surfaces (`weapons.md`)

- `rt.effects.bullet(at, normal, { kind, chips?, dust?, floor? })`: a strike's chips, powder,
  sparks off metal, glitter off glass, clods off dirt, in the material's `chips` and `dust` colours.
  Also `muzzle`, `casing`, `tracer`.
- `rt.effects.decal(at, normal, { kind?, size?, piece?, color? })`: a bullet `'hole'`, a `'dent'`
  (metal), a `'pock'` (dirt) or a `'scorch'`; on a `piece` it goes where the piece goes and onto its
  cells when it breaks. `rt.effects.scorch(at, normal, radius)`: a blast's soot, softening those
  round it so blasts in one spot never stack to black. Marks are boxes drawn where the scene's depth
  puts a surface inside them: no mark ever hangs in the air, and a mark lies on whatever surface is
  there (the effects' own marks are fine over a crater: they go with the piece they're on, or onto
  what's there). A ring of 2048; the oldest fade as new ones come.

## Changed (every world gets these)

- The gun, with a strike for every material (`materialKind` guesses each from its sounds and name:
  check the guesses, per world below), in its `chips` and `dust` colours. A hole, dent or pock where
  each bullet strikes (none where the piece gave way, on glass, or on a flying piece).
- A scorch under every rocket blast and `demo.blast`, except on the water (where the world doesn't
  let the player walk and `groundAt` is under -0.5 m: Harbor Yard's).
- The world's own ground (not a piece) is struck as dirt where its steps are dirt, sand, gravel,
  grass, soil, mud or earth (`groundKind`: Dust Town, Sun Temple), else as stone. Bullets go into
  the water without a sound or a mark.
- The player's footing and step-up (above): the same on flat ground; at a ledge, a rim or a chunk
  the foot's breadth counts.
- The HUD's lower right shows the weapons; the card lists the keys.
- **Bullets don't call `onBlast`**: a world's reactions to rockets (birds, alarms, cicadas, a
  brown-out) don't happen for the gun. Its breaks send the library's events as blasts do
  (`'fracture'`, `'collapse'`, `'dust'`, `'debris'`, `'impact'` of what they cut loose), so a world's
  listeners on those hear them. See "Still open".

## Checked together

On display :105 (port 5331), the RTX 4090 shared with other agents' Chromes (it went from quiet to
59 % busy during the runs; Brick Street measured at the same time as each world). Scripts and
screenshots: `scratch/phase-e/integration/`
(`lib.mjs`, `load.mjs`, `nyc.mjs`, `fire.mjs`, `sounds.mjs`, `ab.mjs`, `crater.mjs`,
`trench.mjs`, `water.mjs`; `out/`).

**Fixed here**: a rocket into Harbor Yard's water left a soot star lying on the open water (the
scorch is drawn on whatever surface is in its box, and the water plane writes depth): `main.ts`
keeps no scorch where the gun's water rule says water, within a metre of the blast
(`out/water-before.png`, `water-after.png`). The gun-sounds test's comment tied `gun.reload` to a
2 s reload in `gun.ts` that's gone; it now says the reload stays in the pack for a world's own use.
Nothing else needed fixing where the teams' work meets.

- **Loads** (each world, 10 s after load): no errors, warnings or failed requests; standing pieces
  the same throughout; `kit.gun` loaded (the model, not the drawn stand-in) with its `magazine` node;
  all twelve gun sounds defined. Loose at 10 s: 0, but Dust Town's 4 (its three tumbleweeds and a
  sign the wind swings: as in phase D) and Market Town's 26 hung signs in the first second only.
  Idle at the start, vsync on: a median of 16.7-16.9 ms in all six (60 fps) with the GPU quiet,
  16.7-19.1 ms with other Chromes on it.
- **Idle against the code before this phase**: both built (`vite build`) and served to the same
  Chrome by request interception, vsync and the frame cap off, 8 s at the start, in turns:

  | ms a frame (mean / median) | before | now |
  | --- | --- | --- |
  | `nyc` (5 pairs) | 1.9-2.35 / 1.6-1.7 | 1.85-2.55 / 1.8-2.0 |
  | `medieval` (4) | 1.5-2.4 / 1.2-2.1 | 1.44-2.02 / 1.2-1.9 |
  | `western` (1) | 1.86 / 1.8 | 2.11 / 1.8 |
  | `neon` (1) | 1.6 / 1.5 | 1.84 / 1.5 |
  | `harbor` (4) | 2.0-2.82 / 1.8-2.0 | 1.98-3.02 / 1.8-2.4 |
  | `temple` (1) | 1.51 / 1.2 | 1.46 / 1.2 |

  The same within the spread of runs; Brick Street's median 0.1-0.3 ms up (its 432 slabs and 4
  static pieces, +15.7k vertices).
- **Brick Street with real input** (three runs): pointer lock by a click, then <kbd>2</kbd>,
  <kbd>1</kbd>, the wheel, <kbd>Q</kbd>, <kbd>2</kbd> each switched. The gun at the road 4.5 m off,
  held 1 s: 15 rounds, all `concrete` on the asphalt slabs (`bullet.concrete` each), the first slab
  gave way at round 8-11; held 4 s more: 49-56 of 57 rounds broke something, down into the earth
  (`bullet.dirt`), 7-8 slabs cut, chunks thrown round the hole, casings lying on the road. A click on
  the launcher fired a rocket at the road 6 m off: a crater 4.6-4.8 m² open and 0.73-0.74 m deep,
  its chunks round it, the scorch on its floor and rim. Walking in: the feet down to -0.45/-0.46 and
  out the far side without a stop; the gun from inside the crater into its bed struck `dirt:earth`.
  No pipelines made after the card through all of it (`GPUDevice.create*Pipeline` counted). Every
  `gun.shot`, strike and casing asked for played (71-72 shots, 70-71 strikes, 28-29 casings).
- **Sounds** (`sounds.mjs`): each of the twelve played by name gave a voice and signal on the
  engine's output (peaks -9 dB for `gun.shot` to -33 for `gun.reload`); real strikes on brick,
  concrete, painted wood, glass and steel in Brick Street played `bullet.brick`, `.concrete`,
  `.wood`, `.glass`, `.metal`, and a ricochet off the brick.
- **The stronger gun in each world** (`fire.mjs`): square on to a piece of the world's main material
  6 m off, 70 rounds at one spot, then 20 s with the trigger held while the view swept 0.6 rad
  across. Rounds that broke something, pieces added, the most loose at once, the fastest and the
  farthest piece let go while it fired (pieces already loose left out), frames over 40 ms:

  | | burst: broke | sweep: broke | pieces added | loose at most | fastest, farthest | frames over 40 ms in the sweep (26 s); worst |
  | --- | --- | --- | --- | --- | --- | --- |
  | `nyc` brick (4 runs; a 5th held 60 s) | 52-63 of 70 | 190-219 of 280 | +1,200-1,600 | 675-843 | 17-20 m/s, 31-49 m | 1-74; 46-120 ms |
  | `nyc` the road (1) | 62 | 265 | +600 | 54 | 9 m/s, 3 m | 9; 54 ms |
  | `medieval` limestone (2) | 10-11 | 45-67 | +100-110 | 24-25 | 10 m/s, 15 m | 23-50; 100-211 ms |
  | `western` siding (2) | 62-69 | 269 | +390-560 | 324-373 | 12-14 m/s, 52 m | 2-61; 41-90 ms |
  | `neon` concrete (2) | 33 | 133-138 | +540-940 | 436-799 | 14-19 m/s, 15-21 m | 4-47; 44-61 ms |
  | `harbor` container (2) | 4-6 | 21-27 | +6-9 | 57-170 | 9-22 m/s, 8-27 m | 0; 38 ms |
  | `temple` limestone (2) | 41-55 | 130-160 | +100-170 | 149-152 | 13-15 m/s, 8-10 m | 19-28; 89-190 ms |

  Standing there before, the same runs had 0-3 frames over 40 ms in 5 s and worsts of 28-83 ms: the
  slow frames came and went with the other Chromes. With the GPU quiet (Brick Street's 4th run,
  Dust Town's 2nd) the sweep was 17.8-18.4 ms a frame on average, its worst 41-47 ms, 1-2 frames over
  40 ms: the gun costs little more than standing. The destruction's CPU while sweeping: 0.2-3 ms a
  frame on average; a frame with a big piece's first cut takes 10-35 ms of it. Nothing was flung: no piece over
  20 m/s but two in Harbor Yard's first run (22 m/s, 25 is its cap), when the spot picked was inside
  the open box and 170 of its pieces were let go at once; the farthest pieces were sections coming
  down (a Brick Street wall, Dust Town's front boards), as a rocket's collapse throws them. What each world
  measured is in its section below. Held for 60 s at Brick Street's wall: 640 of 841 rounds broke
  something, +1,560 pieces (most in the first 20 s; 8,948 when the rubble had cleared), 6 frames
  over 40 ms.

## Per world: what to do

Nothing is needed. To make each its own: the ground (only where the player can reach and shoot,
never under what must never go; `ground.md`'s "How a world adopts it" has the eight steps, and
Brick Street's `index.ts`, `city.ts`, `materials.ts` and `scenery.ts` are the worked example), the
bullet sounds of its materials, and what in its code the gun or a crater changes. Kinds below are
what `materialKind` picked for each material; set `bullet` in `audio.materials` where one is wrong.

### `nyc` (Brick Street)

- **Ground**: done. The road between the curbs breaks along the row (x -40 to 40): `asphalt` 0.3 m
  over `earth` 0.9 m, slabs of 2.2 m, on its bed at -1.35 m (`ROAD` in `city.ts`); `groundAt` gives
  the bed there; past both ends the same layers in static pieces (`roadEnds`); the double yellow
  painted in the slabs' surface (`roadSurface`, from `pieceFrame()`); the sidewalk boxes 2 m deep;
  a crater's sides drawn down the curbs; `steps.rubble` on the earth and the bed. Left for this
  world: the earth's texture is Market Town's (`rocky_trail_02`, CC0): copy it and its credit into
  this pack if the packs should stand alone; the curbs' faces in a crater are plain planes.
- **Bullets**: brick, brickPainted, plaster, pot: brick; concrete, asphalt: concrete; earth: dirt;
  painted, wood, foliage: wood; metal, grate, sheet: metal; glass, lamp: glass. Worth a line:
  `plaster` cracks as brick (`bullet: 'bullet.concrete'` closer); `foliage` thunks as wood
  (`bullet: 'bullet.dirt'` at 1.3, a soft rustle-thud); `earth`'s `pitch: 0.75` plays its
  `bullet.dirt` that low too (`pitch: { impact: 0.75, debris: 0.75 }` keeps the strike as made).
- **The gun here** (rounds for a piece of the median size): brick and painted brick 5 (1.1 m),
  concrete 8, plaster 3, the road's asphalt slab 6 and its earth 5; panes, frames, pots and leaves
  at the first. 20 s held at a wall brings a section of it down (above). The parked cars are props:
  bullets dent them and never move or break them, and set no alarm (the alarms are `onBlast` and
  debris striking a car); a bullet doesn't crack a hydrant (only a strike does: `onImpact`).

### `medieval` (Market Town)

- **Ground**: the market square, `cobbles` over `fill`; the ground team's advice is the market's
  middle only, clear of the houses round the square (a house standing on slabs goes into a crater).
  In its code:
  - The bed: the ground is one fixed box, 700 × 2 × 700 m, its top at 0 (`ground()` in
    `scenery.ts`): split it so the area's part is at the bed and the rest reaches below it.
  - `groundAt` is `height`, 0 within 55 m of the centre: give the bed inside the area.
  - The cobbles are one plane over `COBBLES` (-45..55 × -20..24) whose shader reads `positionWorld`
    (two turned lookups, worn patches, the ragged edge into dirt): on slabs it has to read
    `pieceFrame().position` (plus the layer's middle), or the setts slide off the chunks a blast
    throws; cut the plane out over the area.
  - The well's shaft is a dark disc lying at 2 cm (`WELL`, -5, -6): a flat mesh over the area floats
    over a crater; keep the well out of the area, or make the disc part of the well.
  - What stands on it bonds to the slabs and goes with them: the stalls' posts, the well, the cross,
    the pillory, the low wall; the props (barrels, handcarts, the hay wagon, baskets) wake and drop
    in. The dirt roads out are planes 4 cm over the ground, outside the square.
  - Steps: on the slabs `steps.cobble` (the hard step) is right; down on the fill and the bed it
    is too, unless `footsteps.surface` gives them `steps.rubble`, as Brick Street's does.
- **Bullets**: limestone, limestoneTower, rubble, rubbleTower: brick (they share brick's sounds;
  `bullet: 'bullet.concrete'` is closer to dressed stone); plaster, tile: concrete (`tile`:
  `bullet.brick` at 1.15 fits roof tiles); oak, boards, cloth, hay, produce: wood (`hay`, `cloth`,
  `produce`: `bullet.dirt`); iron: metal; **bronze (the bell): concrete**, as it doesn't bend:
  `bullet: 'bullet.metal', pitch: { bullet: 0.85 }`; glass, lantern: glass.
- **The gun here** (rounds for a median piece): limestone 19, rubble walls 20-25: the stone holds
  (10-11 of 70 rounds at one block broke something, 45-67 of 280 sweeping, nothing came down).
  Plaster infill, oak, boards, tile, cloth and produce go at the first; the bell never.
- **Its code**: the birds, the market's hush, the signs swinging, the hens and the bell answer
  `onBlast` only.

### `western` (Dust Town)

- **Ground**: the street, `sand` over `earth` (the ground team's choice; no asphalt here). In its
  code:
  - The bed: one fixed box, 1200 × 4 × 1200 m, top at 0 (`scenery()`): split it round the area.
  - `groundAt` is 0 everywhere: give the bed inside the area.
  - The ground is one 1400 m plane whose shader reads `positionWorld`: the street paler within
    `|z| < 7` in town, the ruts (`ruts()`), the churned middle. On slabs these come from
    `pieceFrame().position` (the ruts then go with the chunks); cut the plane out over the area.
  - The street's edge: hitching rails at `|z|` 6.6, troughs at 6.2-6.4, the boardwalks from 7
    (`WALK`): keep the area inside them (`|z| < 6`), or let the rails and troughs stand on slabs and
    fall into a crater. The lumps by the corral posts (meshes 8 cm up) and the corral's fixed boxes
    are out of town.
  - The tumbleweeds are props pushed by the wind: they roll into a crater and out if the wind can.
    `onImpact`'s dust where things land uses where they land: fine.
- **Bullets**: siding, timber, stave, paint, signpaint, hay: wood (`hay`: `bullet.dirt`); adobe,
  brick, coals: brick; stone: concrete; tin, iron: metal; **bronze: concrete** (`bullet.metal` at
  0.85); glass: glass. The ground is struck as dirt (its steps). Casings tinkle as on pavement:
  `audio.settings: { 'casing.drop': { volume: 0.07 } }` sounds more like sand. Its reverb rings
  longer: the echo after a burst is a dB or two louder here, as it should be.
- **The gun here** (rounds for a median piece): every wood at the first, adobe 2, brick and stone
  4, tin 7. 20 s held at a front brought a stretch of it down in boards (324-373 loose at once,
  +390-560 pieces, up to 1,184 particles), a board or two thrown 52 m, as a collapse here throws
  them.
- **Its code**: the alarm bell, the doves, the signs and the tumbleweeds thrown answer `onBlast`.

### `neon` (Neon Alley)

- **Ground**: the alley, `asphalt` with its own look: the wet surface (its low roughness, for the
  reflections) and the puddles in the slabs' surface. In its code:
  - The bed: one fixed box, 240 × 1 × 240 m, top at 0 (`ground()` in `scenery.ts`): split it, the
    rest reaching below the bed.
  - `groundAt` is 0: give the bed inside the area.
  - The ground is one 240 m plane, and everything on it is in its shader from `positionWorld`: the
    puddles, rain rings, the gutters along both facades with a drain every 6 m, two manholes, and
    the signs' reflections (`wet.ts`: each pixel loops over up to 48 strips). On slabs all of it has
    to come from `pieceFrame()` (try the reflections' cost on a `FragmentMesh` material); or keep the
    gutters, drains and manholes outside the area. Cut the plane out over it.
  - The facades stand at `|z|` 3.75 (`FRONT`): stop the area short of them. In the alley stand the
    gate's posts (x -25.6, z ±3.2), the vending machines, the transformer box, the slot pipes and the
    clutter props: on slabs they bond to them and go into a crater.
  - The steam vents puff from fixed points 5 cm up (`VENTS` in `life.ts`: the manhole at 12, 0.8
    and the slot): over a crater they'd steam in the air.
- **Bullets**: concrete: concrete; tile, render: brick; steel, signbox, shutter, grate: metal; neon,
  lightbox, lamp, glass: glass; awning, lantern, wood: wood (`awning`, cloth, and `lantern`, paper:
  `bullet.dirt` at 1.2). The wet street is struck as stone.
- **The gun here** (rounds for a median piece): concrete 10, tile 4, render 2, signbox 7, steel 6,
  grate 29; glass, neon, lamps, shutters, awnings and lanterns at the first. 33 of 70 rounds at one
  concrete spot broke something; 20 s held inside a shop's ground floor (where the spot picked was)
  brought its floors down round it (436-799 loose at once, 52-67 still loose 10 s later) and up to
  5,500 particles (the cap is 8,000).
- **Its code**: the brown-out, the shutters rattling, the shop alarm and the vents' gush answer
  `onBlast`.

### `harbor` (Harbor Yard)

- **Ground**: an open stretch of the yard the player crosses, `paving` (concrete flags) over `fill`,
  not the quay's edge: the lane between the yellow lines (x 4.4-11.6) from z 0 to 30, past the
  crane rails' end stops, is clear of the stacks. In its code:
  - The bed: the deck is one fixed box, 900 × 12 × 600 m, its north face the quay wall (`deck()` in
    `scenery.ts`): split it round the area.
  - `groundAt` is 0 on the deck (the water's -1.8 north of the quay): give the bed inside the area.
    The gun's water rule (`walkable` no and `groundAt` under -0.5) still holds: the area is walkable.
  - The deck is a 480 × 320 m plane whose shader (the 4 m flags, puddles, tyre tracks) reads
    `positionWorld`; the reflections (`look.reflections`) need its low roughness on the slabs too.
    Cut it out over the area.
  - `markings()` lays flat meshes on the deck: the painted lines (3 mm up, polygon offset), the
    crane rails and their beams, the drain grates (one in that stretch, at 8, 15) and the oil
    stains. Over the area they float over a crater: paint them into the slabs' surface, or keep the
    area clear of them.
  - What stands: the barriers along x 12.3, the light masts, the site office, the containers' posts:
    on slabs they go into a crater.
- **Bullets**: every steel thing (container, steel, cladding, tank, roof...): metal; concrete:
  concrete; wood, cardboard: wood (`cardboard`: `bullet.dirt` at 1.2); glass, lamp, beacon: glass.
- **The gun here** (rounds for a median piece): container panels 7, cladding 5, steel 23, tank 21,
  concrete 5; crates and cardboard at the first. The containers mostly dent (4-6 of 70 rounds broke
  something). Rockets into the water leave no scorch now (fixed here).
- **Its code**: the gulls, the crane's ropes, the door leaves swinging, a tank breached and the
  stacks' tipping window (`tipUntil`) answer `onBlast` (the last also `'collapse'`, which the gun's
  breaks can send).

### `temple` (Sun Temple)

- **Ground**: the paved way is already breakable (limestone flags in `PAVING`'s three rectangles,
  from -0.09 to 0.03 m, on the plateau box), and the sanctuary's ground is gravel underfoot (struck
  as dirt). If a breakable ground is wanted: `gravel` over `fill` in an open court, or the paved way
  laid as `paving` over `fill` in place of its flags. In its code:
  - The bed: the plateau is one fixed box, 74 × 4 × 60 m, top at 0, with hulls down the cliffs
    (`physics()` in `scenery.ts`): split the box round the area.
  - `groundAt` is the terrain (0.03 on the paving): give the bed inside the area.
  - The ground is the land mesh (triplanar maps): cut a hole in it over the area.
  - What stands: the altar, the statue base, the stelai, pedestals and trees: on slabs they go
    into a crater.
- **Bullets**: marble, drum, triglyph, ruin: brick (brick's sounds; `bullet: 'bullet.concrete'` at
  1.1 is closer to marble); limestone: concrete; **terracotta: glass** (its sounds are glass's: a
  strike shows glitter, no hole; `bullet: 'bullet.brick'` at 1.2 makes it chip, and it still breaks
  at the first round, as it shatters); timber, bark, foliage, cypress: wood; bronze: metal.
- **The gun here** (rounds for a median piece): marble and drums 4, limestone and triglyphs 3,
  timber 2; terracotta at the first. 41-55 of 70 rounds at a limestone wall broke something; 20 s
  held brought the wall behind the colonnade and some roof timbers down in blocks (149-152 loose
  at once).
- **Its code**: the cicadas, the jackdaws and the bay's echo answer `onBlast`.

## Still open

- **The world doesn't hear the gun.** A burst is about as loud as a blast down the street, but every
  world's ambient reactions (birds, cicadas, the market, alarms, a brown-out) hang on `onBlast`,
  which bullets don't call, and a world has no hook for a bullet: Brick Street can't set off a car's
  alarm when its car is shot. Proposed for the world contract (`worlds/types.ts`, not this team's):
  `onShot?(hit: BulletHit, rt)` from `gun.onHit` in `main.ts`, and a quieter `onBlast`-like call
  once a burst has gone on (its rounds, where it was aimed), so each world can duck what should go
  quiet.
- **The road under sustained fire.** At power 6 each round into the asphalt breaks something, and
  each break leaves the cells beyond its reach standing: 10 s held along Brick Street's road left
  +400 standing ground pieces and 104 chunks of rubble round a hole 1.5 m² open and 0.45 m deep, a
  strip of light-grey wedges on the road more than a pothole (`out/trench-close.png`,
  `trench-above.png`; at power 1 it was a small pothole, `ground/out/gun2/`). Options for the ground
  and weapons teams: cut a ground piece a bullet breaks with fewer, blockier cells, or let the
  small cells of a ground go as its spray.
- **Pieces added by the gun stay.** Held 20 s at a wall: +390 to +1,600 pieces, most of them cells
  left standing round the holes and rubble; that wall's count levels off (+1,560 after 60 s). A long
  session can take a world well past its ~8,000 at load, as rockets can.
- Water is guessed from `walkable` and `groundAt` (Harbor Yard's); a `water?(x, z)` in the world
  contract would say it (Sun Temple's sea too).
- From the teams' notes, still so: thin asphalt chunks come to rest on their edge; a 1-pixel seam
  between two slabs at one grazing view; a crater's faces are flat Voronoi cells; the gun looks more
  like an automatic rifle than a machine gun (a heavier take is $1.24, `gunmodel.md`); its right
  side is the image-to-3D's guess; no hands; no decals on a piece flying when struck; a scorch
  darkens pieces flying through its box; dirt strikes in Dust Town are a little darker than its
  sand.
- `tests/hull.test.ts`'s timing check (200 points under 15 ms) fails now and then when the machine
  is loaded (15.6 ms in one run here); it passes alone.
- `README.md` (the project's) still calls the demo "six worlds to blow apart with a rocket launcher"
  and its controls have no <kbd>1</kbd>/<kbd>2</kbd>, wheel or <kbd>Q</kbd> (`weapons.md` has the
  suggested lines).

## Where `docs/making-a-world.md` is out of date

Its owner's to change; until then, read it with these:

- The demo has two weapons (the opening paragraph, and "Checking it": `demo.weapon`, `demo.fire`,
  `stats().marks`).
- `groundAt` (the definition): inside a breakable ground's area, its bed. A section on breakable
  ground (`ground.md`'s suggested bullet, and the eight steps) belongs beside `scenery`.
- Building breakable things: `d.shoot` beside `d.explode` and `d.hit`; a bullet measures a piece by
  its material's `impact` and its size.
- Reactions: `onBlast` is rockets (and `demo.blast`) only; the effects add `bullet`, `decal`,
  `scorch`, `muzzle`, `casing`, `tracer`.
- Sound: `MaterialSounds.bullet` (and `pitch: { bullet }`), and the gun's sounds in the base pack.
- A scorch is laid under every blast: a world's own flat marks on the ground (stains, grates) take
  it as any surface does.
