# Phase F: the worlds answer the gun

These are the notes of phase F, kept as they were written when its teams' work came together (only
their links to each other changed, when they moved here from `docs/changes/`). Phase E gave every
world a breakable ground and a machine gun the user asked to be "a lot more powerful", with no
reload; the worlds' reactions still answered rockets only. This phase the worlds come alive under
the gun, and the open issues phase E's last checks found were taken up (below). The gun is as the
user made it: 14 rounds a second at power 6, no magazine, and no world's materials made tougher to
weaken it.

- `hooks.md`: the hooks team. Four hooks in the world contract (`onShot`, `onBurst`, `water`,
  `pitSide`), what a bullet strikes down in a pit through a breakable ground, and the fixes the
  last checks found in the shared demo: a blank screen from `repeat()`, chips floating over the
  road, the gun's shots and strikes dropped under heavy fire, the side of a pit struck as the rim's
  top.
- `pile.md`: the library's changes for the pile that sustained fire leaves. `GroundOptions.bed`
  (what a pit's floor is), the gun biting a pothole into a breakable ground instead of leaving a
  heap of wedges, and a budget on the pieces (`DestructionOptions.maxPieces`) past which rubble at
  rest shrinks away.
- The six world teams' notes are their worlds' READMEs (`src/demo/worlds/<id>/README.md`: what
  each world's reactions to the gun are, its fixes, and its phase F checks); `temple.md` is Sun
  Temple's short account beside its README.

`docs/making-a-world.md` has what a world author needs of it all (each note's "For
`docs/making-a-world.md`" section has been folded into it: read that first). The project's
`README.md` has the reactions in each world's paragraph, the library's additions and the fal.ai
spend. "Still open" in `hooks.md` and `pile.md` is as it stood when they were written; what the
world teams did about it since is below.

Where a world's README or a code comment points to `docs/changes/<name>.md`, the note is in
`docs/changelog/`: this phase's (`pile.md`, `hooks.md`) here, `sound.md` in `phase-c/`,
`gunsounds.md` in `phase-e/`.

## New in the library

Nothing new to export: `GroundOptions`, `Ground`, `DestructionOptions` and `SoundEngineOptions`
were already.

- `GroundOptions.bed`: a key of the Destruction's materials, what the floor of a pit through the
  ground is (default `under`, else `material`; an unknown one is refused), kept as
  `Ground.bedMaterial` (`Ground.bed` is still the bed's height).
- **The bite** (`pile.md`): a bullet that breaks a slab of a breakable ground cuts it as a bite,
  about a cube 1.6 times its reach across, the biggest cell thrown whole up out of the hole and out
  to one side of the line of fire, the rest as spray and dust; what's left of the slab stands round
  it in a few blocky cells, and what would stand as a sliver or a wedge by the hole goes as spray.
  Held 10 s at one spot, the six grounds now show a ragged pothole 1.85-4.1 m² open and 0.48-1 m
  deep, +26 to +89 ground cells standing (before: a heap of wedges, up to +132). A rocket's crater
  is cut as before.
- `DestructionOptions.maxPieces` (and the field `d.maxPieces`), `d.viewer`: past the budget, rubble
  at rest shrinks away into what it lies on over 1.2 s, a tenth of what's over every 0.25 s,
  what's out of the viewer's view first and the smallest-looking first; never what stands, props,
  anything moving or hanging, or rubble with rubble lying on it. Small rubble cleared by its
  `rubbleLife` shrinks away the same way, and props are never cleared. The rubble is kept as a set,
  so nothing looks at every piece every frame.
- `SoundEngineOptions.reserve` (default 8): sounds in the listener's head (the player's own: the
  gun, the launcher, steps, the ambience bed) have voices kept for them past `maxVoices`, take the
  least heard of the world's past those, and are never masked by a louder sound a moment before.

## New in the demo and the world contract

- `onShot(hit: BulletHit, rt)`: each bullet that strikes something, after its chips, mark and
  sound. `onBurst(burst: Burst, rt)`: once a burst ends, `{ rounds, at, seconds }`. Both in
  `src/demo/worlds/types.ts`, the types in `src/demo/gun.ts`, wired by `gunHooks` (`weapons.ts`).
- `water(x, z)`: where the ground is water (bullets go into it, no scorch); default the old guess
  (`waterOf`).
- `pitSide(at, ground)`: what a pit's side is where the ground meets the scenery: a material,
  `null` for the scenery's stone, nothing for the layer at that height (the default). A pit's floor
  strikes as `bedMaterial`.
- The effects: `impact(at, normal, color, floor?)` and `EffectsOptions.floor` (the demo's
  `floorUnder`): chips, sprays and sparks a world throws land on what's under them, not at y 0.
- The gun's six strikes play at priority 2 (`WEAPONS` in `src/demo/audio.ts`).
- Fixed: `repeat()` (`textures.ts`) no longer leaves a blank screen when its maps are late; chips
  from debris that isn't ground land on what's under them; under fire no shot is dropped (277 of
  277 in Neon Alley's busiest check) and the strikes hold their voices (269-274 of about 290 heard,
  151-178 before); looking down into a pit, the bullet strikes its side, not the rim's top.

## Per world

Every world now has `onShot` and `onBurst` and sets `maxPieces` (what it loads with and 1,500).
Each world's README has the details and the numbers.

- **Brick Street** (7,886 pieces at load, `maxPieces` 9,400): a parked car shot sets its own alarm
  off and loses its windows one by one; 22 pigeons (`pigeons.ts`) on the copings, lamp arms and
  rails go up at a round and come back down 18-42 s after the last noise; the traffic hushes after
  half a second of fire, and long bursts add up to the sirens; a hydrant shot three times cracks
  off its main and gushes; a rooftop tank leaks from each hole and empties when shot open
  (`water.ts`); an air conditioner hisses out its gas; a street lamp shorts out; a litter basket
  spills its paper. Fixed: the towers beyond the street are fixed boxes now (rounds strike them),
  the asphalt's sides in a crater show its aggregate in the shade, each flag shows its own stains,
  the hydrant's puddle drains into a hole under it, the footing in a pit by a facade strikes as
  concrete (`pitSide`), the earth's maps are in its own pack. Four sounds, $0.19.
- **Market Town** (8,014, 9,500): the gun hushes the songbirds and the market by how much of it
  the town has heard lately (`hear`), and from the third round puts the pigeons up and the hens in
  a flap; a round on the bell rings it (`bell.ping`), on its headstock brings it down; a sign shot
  beside it or on its bracket swings and creaks (`sign.creak`), shot on its board it falls apart; a
  tower the gun brings down leans toward where its rounds broke it. `water: () => false` (the old
  guess took a crater's bed by a scenery house for water), the bed `earth`. Two sounds, $0.15.
- **Dust Town** (about 7,850, 9,400): the water tower spurts a stream from each hole, wetting the
  dirt where it lands, its level falling (`water.ts`); the bell rings and swings until its yoke is
  cut; a sign shot apart hangs on by the pieces under its chains; tumbleweeds hop; the doves flush;
  the hawk leaves the windmill, circles and comes back down clear of the town; a long burst at the
  chapel brings out its alarm. Three sounds, $0.23.
- **Neon Alley** (7,976, 9,500): a sign struck stutters and sparks and, a few rounds on, dies with
  its light and its streak in the street (`neon.die`); lamps and lit panels pop dark; shutters
  rattle; a vent or a steam pipe shot gushes; the street keeps a pale mark round each strike (in
  its shader); 20 rounds without a pause brown the power out; the neon buzz and the awning's rain
  give their voices to the strikes while the gun keeps on. The bed is wet `earth`; the shutters'
  `minSize` 0.15 so a round holes a slat. Three sounds, $0.23.
- **Harbor Yard** (6,835, 8,300): a fuel tank leaks a stream down its shell into a pool from each
  hole and catches fire after about 3 s of a burst held on it; a drum trickles; ten gulls
  (`gulls.ts`) go up off the bollards, the crane, the stacks and the masts; the open box's doors
  swing, the hanging box's ropes rattle; the rounds add up to the ship's horn and the siren, and a
  burst opens the stacks' tipping window as a blast does. `water` says the harbour, `pitSide` the
  crane rails' beams; the apron's craters retuned (`toss` 0.6, the slab cut in up to 24, its thin
  wedges as grit) so the player steps down into them (53 of 56 walks, 35 before). Three sounds,
  $0.23.
- **Sun Temple** (5,752, 7,250; `temple.md`): the cicadas stop at a burst's first strike and come
  back later the longer it was; the jackdaws go up at its third; the bay throws the burst back
  (`bay.echo`); the bronze goddess rings when she's shot (`bronze.ring`); a shot olive sheds its
  leaves (`Leaves` in `flock.ts`). `water` is the sea, `pitSide` the land's cut, both beds `rock`;
  the court's craters no longer plugged with flags, the fields' earth retaken as crumbly soil, the
  picture retaken. Two sounds and one image, $0.49.

The phase's paid calls: $1.50 in 40 (33 Stable Audio takes, one GPT Image 2.5 image, six audio
checks). Every ledger together: $48.51 in 688 calls (`README.md`, Credits).

## What became of what was open

- Phase E's "Still open" (`docs/changelog/phase-e/README.md`): the world didn't hear the gun (it
  does: `onShot`, `onBurst`, in all six); the road under sustained fire was a strip of standing
  wedges (the bite digs a pothole); the pieces the gun adds stayed (rubble at rest goes back past
  `maxPieces`; what stands still stays, below); water was guessed (`water` says it).
- `hooks.md`: no world used the hooks (all six do now); Brick Street and Harbor Yard were to set
  `pitSide` (both do); Neon Alley's crater floor struck as its concrete base until it set `bed`
  (it's `earth` now).
- `pile.md`: the budget was off in the demo until `main.ts` or the worlds set `maxPieces` (every
  world sets it; `main.ts` sets no default).

## Still open

From the notes and the worlds' READMEs, at the end of the phase:

- **What stands stays.** The budget takes back rubble at rest, never what stands: the cells a
  crater or the gun leaves standing round a hole stay (+26 to +89 for 10 s of the gun into a
  ground). Rubble that came to rest joined, with another piece lying between a part of it above
  and a part below, holds itself up and never goes (5% of a collapse's rubble with the budget far
  under); a piece going keeps its collider until it's gone (`pile.md`).
- **The pothole's walls** run straight down along the slabs' seams (the layers are laid on one
  grid), and a thin cell reaching out past a bite leaves a narrow cut that reads as a crack (Dust
  Town's, Harbor Yard's; `pile.md`). Staggering the layer under by half a slab would change every
  world's slab counts.
- **Rubble on a ground's slabs settles later** (Brick Street's README): what lies on a standing
  slab isn't on the ground to the resting check, so a collapse onto the sidewalks is at rest by
  +40 s as before but slower before then. A fix in the library: take a slab's intact top as the
  ground there.
- **Chips and powder**: a chip lands at the height of what's under where it started, so one thrown
  over a crater's rim lands in the air beside it; the puffs of a strike's powder rest at y 0
  (`hooks.md`). Leaves struck raise
  soil's powder, a pale cloud round the falling leaves (`temple.md`): a strike look for leaves, or
  the material's `dustAmount` on a strike's powder, would make it a green haze.
- **The worlds' own**: each README's Known issues (and Harbor Yard's library requests). Among them:
  water drawn through what's in its way (Brick Street's hydrants and tanks, Dust Town's streams), a
  leak's pool left lying over a pothole dug under it later (Harbor Yard asks for a wet decal),
  birds that fly through what's in their way, a car's glass still drawn once its window has burst.
- From phase E's list, not taken up in this phase's notes: thin asphalt chunks resting on their
  edge, a crater's faces flat Voronoi cells, the gun more an automatic rifle than a machine gun and
  no hands, no decal on a piece flying when struck, a scorch darkening pieces flying through it.
- The timing tests (`tests/hull.test.ts`' 200 points under 15 ms, `tests/collapse.test.ts`' resting
  checks in 2 ms a frame) fail now and then with the machine loaded, and pass alone.

At the end of the phase the typecheck is clean and the tests (218) pass; in one of two full runs
the hull's timing test failed (200 points in 19.4 ms), and it passes alone.
