# The pile: the gun into the ground, a crater's floor, and a piece budget

The library's changes in this phase for the pile that sustained fire leaves: what a pit's floor is
made of (`GroundOptions.bed`), the gun digging a pothole into a breakable ground instead of a heap
of standing wedges and slivers, and a budget on the pieces in a world (`maxPieces`), past which
rubble at rest shrinks away.

Files: `src/lib/destruction.ts` (the bite, the budget, the rubble kept as a set), `src/lib/ground.ts`
(`bed`), tests `tests/ground.test.ts` (the bed's material, the pothole) and `tests/budget.test.ts`
(new). Nothing new to export: `GroundOptions`, `Ground` and `DestructionOptions` were already.
Scripts and pictures: `scratch/phase-f/pile/`
(`hold3.mjs` the gun held on a ground, `session.mjs` a long session, `pile.mjs` and `stuck.mjs` a
collapse under a low budget, `view2.mjs` what's in view, `trimcost.mjs`, `shrink.mjs`, `load.mjs`;
`node/` the checks on the CPU: `dig4.mts` the gun held on each ground, `why2.mts` what's sprayed
and why, `pothole.mts` the ground test's numbers over eight seeds, `pile.mts` a pile under the
budget; `base/` the library before this phase, `proto/` the reviewed one, to run them on; `out/`
the pictures and results). The review's own: `phase-f/pile-review/`.

**No world has to change anything.** Without `bed` the bed is what it was (the layer under, else
the top), without `maxPieces` there's no budget, and the gun's bite is every world's at once (all
six grounds were held under fire, below). What a world may set: `bed` on its ground, and
`maxPieces` in its `destruction` options (about its load count plus 1,500, below).

## What a pit's floor is: `GroundOptions.bed`

`d.addGround({ ..., bed: 'rock' })`: a key of the Destruction's materials, what the floor of a pit
through the ground is (the bed, under the layers). Default `under`, else `material`. A material
named here that the Destruction doesn't have is refused (`addGround: no material 'x' for the bed`),
as an unknown `material` is: define it in `materials()` (a material no piece is made of costs
nothing; its mesh is made with its first piece).

The ground keeps it as **`ground.bedMaterial`**, not `ground.bed`: `ground.bed` has been the bed's
height since phase E (`top - depth - underDepth`, what `groundAt` gives in the area, used by every
world, the player and the gun), and stays so. The contract for this phase said `ground.bed`; the
hooks team's `gun.ts` and `hooks.md` use `bedMaterial`, which is what's built. A bullet striking
the floor strikes as it (the gun's `pitAt`, `hooks.md`); the sides of a pit against
the scenery strike as the layer at that height, as the hooks team built it.

## The gun into the ground: a pothole, not a heap of slivers

**What it was.** Held on one spot of a breakable ground, the gun left a heap of thin light-grey
wedges and slivers standing where a pothole should be, and added 70-130 standing ground pieces in
10 s. Why: a round of power 6 that breaks a slab cuts it as a small blast of it alone would, 12-22
Voronoi cells packed round the hit (`impactSeeds`); those within the bullet's reach (0.8 × the slab's
size, kept to 0.15-0.4 m, × 1.82 at power 6, × the material's `reach`: 0.36 m for asphalt) go, and
every cell beyond it stands. Packed seeds make long radial wedges and slivers beyond the reach, so
each break left 5-8 of them standing, and the next round struck one and cut it into 12 again.

**What it does now** (`Destruction.bite`, for a bullet's break of a piece of a breakable ground; a
rocket's crater and everything else cut as before). `r` is the bullet's reach into the material
(0.36 m for asphalt, 0.33 for paving, 0.55 for Dust Town's sand):

- **The bite**: five seeds packed within 0.6 r of where it struck, just in from the face, and six
  more 1.6 r out (±15%, each turned a little): above it, below it and four ways across the ground,
  turned at random about the vertical. The bite is then about a cube 1.6 r across with its faces
  at random angles, and the rest of the piece a few blocky cells round it, the cuts between them
  running straight out from the hole, down its sides and across under it. The frame is the
  ground's, not the struck face's: struck on a pit's side, or bitten as the slab across a seam (a
  power-6 round breaks the pieces of the same layer within r too, or half its radius if that's more), the cuts still run down through
  the layer, never along it as plates. Seeds past the piece's edge cut it too.
- **What goes**: the bite's cells. The biggest, if it's at least r in size (and `minBodySize`), is
  thrown whole as a chunk (`outOfHole`): up fast enough that its foot clears the top by 25 cm from
  as deep as it lies, and out to one side of the line of fire (90° ± 30°), to land about 4 r away
  (1-2 m for asphalt): clear of the hole, which grows on along the line of fire, and of the line of
  fire, where the next rounds would cut it up. The rest go as spray (`'debris'`), a spray for each
  bit of a cell the size of the least that stands ((0.8 r)³: 24 L for asphalt), at most four,
  spread through it, so what goes is seen to go; and dust at the heart (`'dust'`, within r/2 and no
  bigger than `dustSize`). A piece too small to bite that a round breaks loose is thrown out of the
  hole the same way.
- **What stands of the rest**: a cell at least 0.8 r in size (and `minBodySize`, unless
  `keepSmall`), and at least 0.35 r thick and wide through its centre (`plan()`: twice how deep its
  centre lies from its nearest face, and from its nearest side seen from above). One lying all
  within 2 r of the bite must also be as wide as a quarter of its length (a wedge or a sliver
  sticking into the hole); one reaching out past that stands however long it is (a strip of the
  slab beside the hole). The rest goes as spray: a small cell, a thin plate, a wedge by the hole.

Under sustained fire the bites run together into a ragged pothole down into the layer under, its
floor that layer or, once through, the bed; the chunks lie round it, out to its sides.

### What the review found, and what changed

The first version of the bite made the holes by deleting ground. Its sliver test asked every cell
to be as wide as a quarter of its length, so long cells far from the strike failed it (a
2.2 × 0.5 m strip of asphalt, a 3 × 2 m triangle of Harbor Yard's concrete) and went whole as one
`'debris'` event, drawn as one small puff at the cell's middle. Two more causes, found measuring it
(`node/why2.mts`): the out-seeds were laid round the struck face's normal with none in front of it,
so a slab bitten across a seam (whose nearest point lies on the face toward the strike) was cut
open on that side and its bite cells ran 4 m through it (one of 940 L of gravel); and a round into
a pit's side turned the cuts across the layer, slicing its top off as a plate (581 L) that was then
too thin to stand. The holes were straight slots several metres long and box pits along the slab
seams, and most of each was ground that vanished: 6 m³ in 10 s in Harbor Yard, 8 m³ in Dust Town.

Now (the cuts in the ground's frame, a sixth seed above, the sliver test only near the bite, the
spray in parts), on the CPU (`node/dig4.mts`, the reviewer's harness: 140 rounds, four seeds, from
6 m (`interior`), from 15 m grazing (`far`), and walked 2 m across (`sweep`); what's thrown taken
away; 'far' is more than 0.6 m from the strike):

| | standing added | slivers standing (under 10 cm across or high) | sprayed | of it far | the biggest far spray | the most from one round |
| --- | --- | --- | --- | --- | --- | --- |
| Brick Street from 6 m: before the bite / reviewed / now | 117 / 12 / **47** | 2.8 / 0 / **0** | 0.33 / 7.0 / **3.0** m³ | 23 / 4,923 / **528** L | 12 / 799 / **22** L | 81 / 1,687 / **361** L |
| Brick Street from 15 m | 252 / 30 / **96** | 7.5 / 0 / **0** | 1.0 / 9.2 / **5.0** m³ | 77 / 6,094 / **732** L | 13 / 723 / **24** L | 88 / 1,250 / **357** L |
| Harbor Yard from 15 m | 318 / 13 / **47** | 34 / 0 / **1** | 2.1 / 11.8 / **3.9** m³ | 232 / 9,835 / **809** L | 25 / 1,907 / **25** L | 164 / 2,588 / **337** L |
| Dust Town from 15 m | 321 / 23 / **67** | 28 / 0 / **0** | 1.5 / 12.9 / **7.3** m³ | 12 / 9,588 / **2,229** L | 8 / 1,883 / **79** L | 205 / 3,277 / **716** L |
| Sun Temple walked across | 123 / 24 / **63** | 4 / 0 / **0.3** | 0.04 / 5.1 / **2.8** m³ | 6 / 3,230 / **369** L | 2 / 562 / **16** L | 7 / 893 / **316** L |

All 18 cases (six grounds, three ways each) are in `out/dig-final.txt`: standing added 17-104
(before the bite 74-321), slivers 0-1 (0.5-34), the biggest far spray 11-25 L but Dust Town's 72-79
(sand's bit is 85 L), the most from one round 116-361 L but Dust Town's 614-716. The most from one
round is the bite (0.58 m across for asphalt) through the slabs it reaches; Dust Town's sand has
`reach` 0.75, so its bite is 0.87 m across.

The trade: what was sprayed far and whole now stands, so more stands than in the reviewed version
(2.5-4 times as much; a sixth to a half of what stood before the bite), but none of it is a sliver,
and what goes, goes where the bullet struck.

**Measured in the browser** (display :102, port 5331's dev server, which served these files as
edited; the gun at the spot from 6 m off, the view held still, 10 s with the trigger held, counted
8 s after; `hold3.mjs`):

| | rounds that broke | ground cells left standing | ground rubble (in the hole / round it) | all pieces added | hole open (in 3 × 3 m) | deepest | sprayed (the biggest spray) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Brick Street, before the bite | 129 of 141 | +132 | +43 | +192 | 0.86 m² | 0.70 m | |
| Brick Street, reviewed | 75 of 141 | +27 | +26 | +114 | 2.81 m² | 1.03 m | |
| Brick Street, now | 103 of 141 | **+69** | +11 (4 / 7) | +80 | 1.85 m² | 0.99 m | 2.6 m³ (24 L) |
| Sun Temple, now | 64 of 141 | **+54** | +22 (11 / 11) | +103 | 2.09 m² | 1.0 m (the bed) | 2.0 m³ (18 L) |
| Harbor Yard, now | 13 of 141 | **+26** | +1 | +27 | 2.23 m² | 0.70 m (the bed) | 2.8 m³ (22 L) |
| Dust Town, now | 22 of 141 | **+41** | 0 | +41 | 4.12 m² | 0.87 m | 5.5 m³ (79 L) |
| Market Town, now | 109 of 141 | **+89** | +23 (13 / 8) | +138 | 2.71 m² | 0.89 m | 3.0 m³ (18 L) |
| Neon Alley, now | 85 of 141 | **+30** | +9 (0 / 9) | +45 | 2.56 m² | 0.48 m (the bed) | 1.1 m³ (24 L) |

With the chunk thrown back the way the bullet came (tried first), Brick Street's chunks flew up
into the line of fire, were cut up by the next rounds and fell back in (15 in the hole, 13 round
it); thrown on along it, they landed where the hole grew (29 / 7). Out to the side, 4 / 7. Frames
while firing were as standing (Brick Street 17.5 ms a frame on average, none over 40 ms; the
destruction's update 1.2 ms on average, 12 ms at most; the weapons, the bullets' cutting included,
0.6 ms).

Pictures, the reviewed version on the left and now on the right, from above (Brick Street, Harbor
Yard, Sun Temple, Dust Town): `out/review-vs-now-above.png`; each world from the player's height
and from above: `out/<world>-fix3-close.png`, `-above.png`; Market Town and Neon Alley:
`out/others-fix3.png`. Harbor Yard's hole now crosses the seam instead of running along it, and
its 6 m slot is gone; Sun Temple's straight 3 m trench is a compact hole with its chunks round it;
Dust Town's box pit has two ragged sides, its other two still the slab seams (below).

## A budget on the pieces: `DestructionOptions.maxPieces`

**What it does.** Past `maxPieces` pieces in all (default Infinity: none), rubble at rest dissolves,
each piece shrinking away into the point under its middle at its lowest over 1.2 s (drawn again
smaller each frame; its collider stays as it was until it's gone), so it sinks into what it lies on
rather than popping out. What goes first is what's out of the viewer's view, then what's in it;
of each, what looks smallest from the viewer first (its size over its distance). Standing pieces,
props, anything loose or hanging, rubble that came to rest under 3 s ago, and rubble with other
rubble lying on it from above (its centre higher) never go: the top of a pile goes first, and what
was under it after. Rubble that came to rest joined goes together or not at all. What only leans
on a piece that goes (its centre no higher) rests on as it lies, held by what else it touches; what
came to lie on it while it went wakes. A dissolving piece that's woken (a bullet's push, a blast,
what it rests on going) stays, drawn whole again. While over it, every 0.25 s a tenth of what's
over starts to go (at least 2), no more than 32 at once: about 25 pieces a second at most, and the
count may stay over the budget while what's over is standing or moving.

- `maxPieces` is also a field (`d.maxPieces`), as `killBelow` is: a world may set it in `build()`,
  and a check can change it as it runs.
- `d.viewer`: the camera the budget looks from (default: the first camera in the scene; the demo
  adds its camera to the scene, so nothing needs setting).
- **Cheap per frame**: the rubble is kept as a set as pieces change state, so nothing looks at
  every piece every frame (the clearing of small rubble and the count of how long rubble has rested
  went over every piece each frame; now over the rubble only). The budget looks over the rubble
  four times a second while over, and draws again only what's dissolving.
- **Small rubble cleared** (each material's `rubbleLife`) now shrinks away the same way instead of
  vanishing, and props are never cleared.

**What the review found, and what changed.** (1) The budget could take only about a third of a
real pile: a piece with any other rubble in its resting links never went, and those links count
what leans beside it too, so two pieces leaning together each held the other, and all under them,
for good (Brick Street's collapse with the budget far under the count stopped with 1,459-1,514
rubble left, 33% taken). Now only what lies on it from above holds a piece. (2) Being in view only
counted a piece four times its size, so small pieces in view went before bigger ones behind the
player; now everything out of view goes first. (3) A dissolving piece woken went on dissolving and
was taken out while moving; now it's drawn whole again and stays. (4) Found checking (1): what
leaned on a piece that went woke, as anything resting on a piece that goes does, and on a pile that
stirred the pieces round each one that went: 8,159 wakes in the 56 s after the collapse in the
session below with the budget at 9,400 (482 without the budget), and up to 474 pieces moving at
once in the low-budget pile. Now what only leans on it rests on as it lies.

**Measured** (Brick Street; display :102, port 5331):

- **The pile, the budget far under the count** (`pile.mjs`: four rockets at the building, 40 s to
  settle, then `maxPieces` 5,000): the rubble went from 2,117 to 37 in 85 s, steadily, about 25 a
  second, none woken, none moving; frames 16.8-19.2 ms on average (as before the budget started),
  the destruction's update 0.4-0.6 ms on average, 3 ms at most. Before: it stopped with 1,459-1,514
  left. (A second run, the reviewer's `stuck.mjs` waiting 100 s: 115 left, 5%: rubble that came to
  rest joined, a part of it lying above and a part below a piece that's in neither, waits on itself.)
- **What's in view** (`view2.mjs`: the collapse, looking at it, the budget 240 under): of 222 the
  budget took, 18 were in view, and each time no piece out of view could have gone instead (at rest
  3 s, nothing on it from above); 51 more were small rubble cleared by its own `rubbleLife`, which
  doesn't look at the view.
- **A long session** (`session.mjs`: the gun held 60 s on the front of the building at x -6, the
  view sweeping 0.6 rad across it, then four rockets at x 10-22, then 56 s more):

| pieces (rubble) at | 0 s | 30 s | 60 s | 66 s | 90 s | 120 s | most | woken after the rockets |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no budget | 7,915 (0) | 8,536 (628) | 8,915 (1,038) | 10,033 (1,436) | 10,361 (3,378) | 10,328 (3,413) | 10,849 | 482 |
| `maxPieces` 9,400, leaners woken | 7,916 (0) | 9,110 (820) | 9,455 (1,535) | 10,443 (1,737) | 10,292 (3,067) | 9,587 (2,177) | 10,740 | 8,159 |
| `maxPieces` 9,400, now | 7,914 (0) | 8,556 (535) | 8,959 (1,113) | 10,073 (1,366) | 10,119 (3,181) | **9,405** (2,515) | 10,577 | 1,286 |

  Frames after the rockets: 17.4 ms on average with no budget, 17.6 now (none over 40 ms).

**What a world sets**: `destruction: { maxPieces: <its load count + 1,500> }`. At load: Brick Street
7,886, Market Town 8,014, Dust Town 7,872, Neon Alley 7,976, Harbor Yard 6,835, Sun Temple 5,752, so
about 9,400, 9,500, 9,400, 9,500, 8,300 and 7,250. 1,500 is about what a minute of the gun at a
brick wall adds (+1,560 in phase E), so the budget starts to work after a long session or a big
collapse, not in the first minutes. **No world sets it yet, and `main.ts` sets no default, so the
budget is off in the demo** (both are other teams' files): either `main.ts` adds, after
`destruction.reinforce()`, `if (destruction.maxPieces === Infinity) destruction.maxPieces = destruction.stats.pieces + 1500`,
or each world sets its number above.

## Tests

- `tests/ground.test.ts`: what the bed is made of (its own say, else the layer under, else the top;
  an unknown one refused); the gun held on one spot (70 rounds of power 6 from 6 m off, a little
  spread): through the asphalt round the spot and into the earth; a round's spray no more than its
  bite (under 0.35 m³), no single spray over 25 L, none 2 m or more from where it struck and under
  0.15 m³ in all over a metre off (the reviewed version sprayed 643 L from one round); what's thrown
  goes up fast enough to clear the top (the reviewed version's rose 3 cm); no more than 40 standing
  pieces added (+157 before the bite), and none narrower than 10 cm across or high, or than a tenth
  of its length, measured as the eye would (the least width of its outline seen from above, by
  rotating calipers, and its height), not with the library's own `plan()`.
- `tests/budget.test.ts`: the rubble of what broke (three blocks blown apart, their cells resting
  on and against each other), a stack of three and two leaning together all go, down to the
  budget, the stack from the top; what stands, a prop, a sign on its hinge and a piece moving all
  along never go; it holds again after more. Of two leaning together either may go, and the other
  rests on as it lies. A dissolving piece pushed is drawn whole again and is still there after it
  would have gone. What goes first: out of view, the small one and then a big near one, before
  anything in view; in view, a joined pair 30 m off, a brick 30 m off, one 3 m off, a big one last.
  A piece dissolving is drawn smaller, its foot on the ground under its middle, and is gone after;
  small rubble past its life shrinks away too. Run on the reviewed code, the first three fail
  (13 pieces left for 11; neither of the two leaning goes, and the woken one isn't drawn whole; the
  big one behind goes after those in view).

## Still open

- **The budget is off in the demo** until `main.ts` or the worlds set `maxPieces` (above).
- A pit's wall where two slabs meet runs straight down through both layers (the layers' slabs are
  laid on one grid, and a slab's bite ends at its edge unless the strike is within r of it): Dust
  Town's hole has two straight sides on its seams (`out/western-fix3-above.png`). Laying the layer
  under with its seams staggered half a slab would break that up; it changes every world's slab
  counts and what holds a slab up, so it isn't done.
- A thin cell reaching out past the bite (under 0.35 r through its centre) goes as spray and leaves
  a narrow cut into the slab, which reads as a crack (Harbor Yard's, `out/harbor-fix3-above.png`).
- More stands than in the reviewed version (above): +26 to +89 ground cells left standing by 10 s
  of fire (the reviewed version +4 to +27, before the bite +73 to +132 where measured). A rocket's
  crater adds 15-120, and the budget takes rubble back but not what stands.
- Rubble that came to rest joined, with an other piece lying between a part of it above and a part
  below, holds itself up and never goes (5% of a collapse's rubble with the budget far under).
- Earth clods thrown from a bite crumble where they land (`landing`), into rubble that isn't a
  ground piece, cleared after the earth's `rubbleLife` (8 s).
- A dissolving piece keeps its collider until it's gone (1.2 s): something landing on it then
  rests on what's no longer drawn, and wakes when it goes.
- `docs/making-a-world.md` (not this team's) doesn't have `bed`, `maxPieces` or the bite yet: its
  "Breakable ground" options list, its `destruction` options list ("`maxLoose`" has a neighbour now),
  "What a bullet does" (into a breakable ground it bites, as above) and "Scale and cost" (what
  craters and bullets break stays: the budget is what takes it back) want a line each.
