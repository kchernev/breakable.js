# Collapse: piles that come to rest, the loose cap, tiny bodies, weighing, bridging and landing

The collapse team's changes in phase D, all in `src/lib/destruction.ts` (and one field in
`src/lib/materials.ts`). Tests: `tests/collapse.test.ts` (new, on `tests/fake-world.ts`, no GPU);
`tests/stability.test.ts` and `tests/structure.test.ts` pass unchanged.

An independent review found one regression (chained hinges), one rule that fired far more widely
than meant (pieces "over a gap"), and four smaller problems. All six are fixed; what changed is in
each section below and summed up in [After review](#after-review).

**No world has to change anything.** All six load with no console errors and stand: 0 loose for 12
s after load, Dust Town aside (its 10 hinged pieces are `stats.hanging`, and `stats.loose` reads 3-4:
its three tumbleweeds, which the wind rolls, and now and then a sign it swings further than 10 cm).
What's built stands: no world's count of standing pieces changed over those 12 s. The typecheck, the
tests and the build pass. The workarounds still work; those that can go are listed at the end.

How it was measured: scripted blasts on display :102 (`demo.blast`), counting what's loose at +5,
+10, +20, +30 and +40 s, with screenshots; two runs at a time on the shared GPU, so every number is a
range over runs, with Brick Street run among the others. The solver team's fixes (no more flung
pieces, sliding that stops: `solver.md`) landed during this phase too, so "after" has
both. Where a change was switched on and off in the same build to isolate it, that's said. Scripts,
JSON and screenshots: `scratch/phase-d/collapse/`
(first round) and `.../phase-d/collapse-fix/` (after review: `run.mjs`, `plans.mjs`, `out/`).

## 1. Piles that never came to rest

**What was wrong.** After four rockets at Neon Alley's end block, hundreds of pieces could lie still
in the pile for tens of seconds without freezing (in one of three runs here: 941 loose at +20 s, 753
of them still for over 0.8 s; 692 at +30 s, 653 still). Four causes, the first by far the biggest:

- **The resting checks were slow and ran once a readback.** `rest()` got 2 ms after each readback
  (every 0.1 s), lowest groups first. Each group's `support()` ran `touches()` (edge clipping)
  against everything the piece touched, sideways neighbours included, and looked for loose
  neighbours in grid cells 2 m round it; a group that wasn't held up yet was looked at again every
  0.5 s. In that collapse: 45 µs a piece in `support()`, about 23 groups a readback, while hundreds
  lay still waiting their turn.
- **A section froze only when every piece of it was still**: a wall section lying on the pile with
  one end still sliding, or one piece jittering, stayed loose whole.
- **The wedged-piece rule waited on anything moving it touched** (`onMoving`): any overlapping loose
  piece not still for 0.8 s, beside or above it, a sign swinging on its hinge included.
- **A piece creeping or jittering never counted as still** (over 0.15 m/s at a readback, or 3 cm on
  from where it slowed), however long it stayed put.

**What changed.**

- **The checks run every frame**: 2 ms a frame (not a readback). Each readback sorts what it found
  at rest, lowest first, and the frames after walk that list where the last one stopped, finding
  each piece's section when its turn comes, until it's all been looked at or the next readback
  comes. A big section that won't fit in what's left of a frame's 2 ms (about 20 µs a piece) waits
  for the next frame and has it to itself.
- **`support()` is asked in stages** and stops as soon as what it has found holds the piece up: the
  ground and the scenery (no `touches()` with pieces at all), then what's under it, nearest first
  (standing pieces, rubble and loose pieces at rest, their centre lower), then everything. The search
  for loose neighbours reaches only as far as the loose pieces do (not 2 m).
- A piece that isn't held up is looked at again once it could settle where it is (2.5 s at rest),
  not every 0.5 s.
- **A section at rest in part, for 2.5 s, parts there**: the joints between its pieces at rest and
  those still moving give way (`bondBreak` events), and the part at rest is looked at alone.
- **Stopped, however it creeps or jitters**: a loose piece that stays within 10 cm of where it was
  for 6 s is at rest, whatever its speed reads. That's the ceiling on how long a slow, held-up piece
  stays loose.
- **A wedged piece waits only on what moves under it** (its centre lower, not on a hinge), and for 6
  s at most: then it freezes resting on that too, and wakes when that moves on 3 cm (Phase C's rule).

Phase C's rules stand: nothing freezes unless held up (or wedged, as before), and rubble wakes when
what holds it goes. I tried freezing whole contact islands at once (touching pieces at rest, held
from outside as a whole): it froze two blocks in a V across a gap as readily as a pile, so it isn't
used; the staged checks and the per-frame budget get its speed.

**Before and after** (loose pieces; "first round" is the version the review checked, "after review"
this one):

| | +5 s | +10 s | +20 s | +30 s | +40 s |
| --- | --- | --- | --- | --- | --- |
| Neon Alley, four at the end block, before (3 runs) | 1,376-2,305 | 897-1,662 | 149-941 | 32-692 | 23-37 |
| Neon Alley, first round (reviewer's 4 runs) | 1,141-1,374 | 910-1,267 | 215-557 | 1-292 | 0-52 |
| Neon Alley, after review (10 runs) | 1,037-1,616 | 673-1,297 | 36-628 | 0-290 | 0-188 |
| Brick Street, four at a ground floor, before (3) | 1,045-1,090 | 489-709 | 11-61 | 1-2 | 0-1 |
| Brick Street, first round (reviewer's 4) | 839-1,067 | 409-458 | 1-30 | 0 | 0 |
| Brick Street, after review (5) | 1,027-1,118 | 193-694 | 0-29 | 0 | 0 |
| Harbor Yard, a stack toppled, before (3) | 298-372 | 3-360 | 1-5 | 0-1 | 0 |
| Harbor Yard, first round (reviewer's 2) | 253-264 | 137-147 | 19-21 | 0-6 | 0 |
| Harbor Yard, after review (4) | 221-262 | 78-180 | 11-20 | 0-1 | 0-7 |

Neon Alley's collapse varies a lot from run to run, and at +20 s the pile is still moving: of the
ten runs after review, eight had 0-5 loose at +40 s, one 33 and one 188 (in that one, at +40 s 38
of its pieces still moved over 5 cm/s, and pieces kept cycling: 41 were dropped clear of a jam three
times or more). In an eleventh, looked at closely: 70 loose at +20 s (15 of them dropping clear of a
jam, 26 waiting their next look, 15 moving faster than 15 cm/s, mostly a tile and concrete section
still sliding), 2 at +30 s, 0 at +40 s. Harbor Yard's 7 at +40 s (one run of four) are pieces
that woke and froze again. Before, Neon Alley's counts include 0-30 pieces hanging on hinges; after,
`stats.loose` leaves out those hanging at rest. What changed is that what's still gets frozen: pieces
still for over 0.8 s and not frozen at +20 / +30 s were 13-753 / 1-653 before, 75-98 / 27-31 after
the first round. In one build with the checks once a readback, 300-500 pieces at rest waited for
their turn at +10 to +20 s; with them each frame, 0-7 (once 99). `support()` is 20 µs a call (45
before).

**What the checks cost a frame** (the resting checks' time summed per frame, 4 s windows): the first
round overshot its 2 ms because each frame's checks first found the sections of all that was at rest
before looking at the clock (up to 3.4 ms; in a fake-world test of 2,025 blocks at rest, 28,454
sections looked for, 14 times over). Now each piece's section is looked for once a readback (under
2,430 in that test). In the browser after review: 2.0-2.2 ms in 19 frames of 20, at most 2.1-4.3 ms,
0-4 frames per window over 2.5 ms, nearly all in the first seconds after the blasts. What still goes
over is single calls that took 1-4 ms however few pieces they had (the garbage collector's pauses
landing in them, as far as I can tell: a call on one piece taking 2.7 ms), and the grid of loose
pieces made once a readback (up to 2.8 ms, once, with about a thousand loose).

## 2. The loose cap, and hanging pieces

**What was wrong.** Past `maxLoose`, the smallest loose pieces were removed, whatever they were: a
sign hung on its hinge is loose for good, so a collapse anywhere took it (and its lettering), and
props woken by a blast went too. `stats.loose` counted hinged pieces, so Dust Town's HUD read 13 at
rest. And a sign whose bracket fell with it stayed loose for good: a piece on a hinge that held
never came to rest, whatever it hung from.

**What changed.**

- The cap leaves out props and what hangs: pieces on a hinge that holds them to the world, to a
  piece that stands, or to a piece that hangs itself (a cable's links, each hinged to the one
  before, and a lantern on the last), and what they're joined to (a sign's lettering). They still
  count toward it.
- `stats.hanging`: how many pieces hang so (swinging or not). `stats.loose` leaves out those hanging
  at rest (still for 0.8 s, or within 10 cm of where they were for 6 s, as anywhere else), so the
  HUD's "moving" (it shows `stats.loose`; `main.ts` needed no change) reads 0 when nothing but hung
  pieces is there, swaying a little in the wind or not.
- A piece hung from a piece that no longer stands or hangs (its bracket fell with it) isn't hanging:
  it comes to rest like anything else, resting on what its hinge holds it to too (it wakes with it).
- Small rubble a hinge still holds isn't cleared after `rubbleLife` (it may hang in the air).

**The regression the review found.** In the first round only the first link of a chain hung: each
link after it, hung from a loose piece, counted as fallen with what it hangs from. Neon Alley's cut
lantern strings froze in the air link by link (12 of 28 hinged pieces rubble 5.6-6 m up at +20 s, 14
of 20 by +40 s), and lanterns frozen so were then cleared as small rubble (7 removed in mid-air at
+22 to +28 s), while the links still swinging counted as loose (the HUD read 15 moving). Now a piece
hung from one that hangs, hangs. The same three strings cut (six runs): all 27-28 hinged pieces hang,
none froze or went (none in over a minute, in one run); `stats.hanging` 42-52 (with what's joined to them). At +35 s the lanterns still
hang, lit (`out/cableShots1-t35.png`). A test hangs a chain bracket, link, link, lantern.

Measured: Market Town with the cap at 400 (`demo.destruction.maxLoose = 400`), a blast that hangs the
tavern's sign, then the church tower's four: before, the sign was gone; after (first round and after
review), it hangs.

## 3. Tiny bodies beyond a blast's reach

**What was wrong.** `breakPiece()` turned a blast's cells under `minBodySize` into particles only
within the blast's reach; beyond it they stayed in the structure as bodies, whatever their size. A
pane only partly in reach (glass reaches three times the blast's radius, and shatters into even
shards) kept its far shards standing, a few centimetres across against glass's `minBodySize` of 0.3;
the next collapse threw them as tiny bodies, the solver's favourite victims.

**What changed.** Cells under `minBodySize` are `debris` events wherever they are: thrown within the
blast's reach, falling where they were beyond it. `BreakableMaterial.keepSmall: true` keeps the old
way for a material (they stand as bodies).

Measured, Brick Street's four blasts: bodies under their material's `minBodySize` made by the
blasts, 2 s after: before 129 glass standing, 100 glass loose and 13 brick standing; after none (the
reviewer found none at 2 and 6 s).

## 4. How weight is routed, and how bonds give way

**(a) Tipping.** A piece whose weight had moved off what it stands on gave its pressed bonds no
capacity at all, so a rafter or plate whose load centre shifted gave way at once, however well
bonded. Now a tipped piece's pressed bonds hold as levers, as its side bonds do, with what their
material holds pulled (`support` × area, less the further the weight is from the face). Not the
extra strength `reinforce()` gave them, which was for pressing; but a bond weakened from outside
(`b.strength = 0.1`, then `d.reweigh()`) stays weak (`Math.min(1, b.strength)`: the first round
dropped `strength` here altogether, so a weakened bond held its full strength once its piece
tipped). Phase C's cases still come down (a span on one column, a joist whose post went; tests); a
well-bonded plate now holds, and one whose bond was weakened falls (tests). No world sets
`b.strength` today. Dust Town's balcony over its blasted posts came down in 2 of 4 runs with the old
rule and 2 of 4 with the new (switched in the same build): no difference there. After review its
middle came down in 5 of 6 runs (one blast at the saloon's porch), as in both of the reviewer's.

**(b) Overloads in one round.** Every overloaded bond broke in the same round, and a support was
weighed with all the weight on the bonds over it, even those breaking that round. That's fixed as an
option, **`DestructionOptions.passHeldOnly`** (default false): a bond asked to carry more than it can
passes on only what it holds. It isn't the default because three worlds' collapses rely on the
cascade (measured with it on and off in the same build):

- Dust Town, one blast at the saloon's porch: with it, the balcony stays whole over the blasted posts
  in 5 runs of 5; without, it comes down (whole or in part) in 11 of 20.
- Neon Alley, four at the end block: of 774 m³ standing above 2 m, 492-518 stays with it, 396-421
  without (the floors over the arcade stay up as a shell).
- Sun Temple, one flank blast: with it, `levers.ts` cuts and remakes the same three entablature
  blocks every frame for good (the library keeps standing a span `Levers` calls undermined; cut, it's
  the same span), 4 pieces loose for good.

So it changes what comes down, not only what breaks off. Market Town's nave roof (one blast on its
south slope: 345 of the 353 roof pieces more than 4 m from the hit stand) and the church tower's fall
(the nave keeps its roof) come out the same either way, as the world splits the roof into bays
already; it can set `passHeldOnly: true` in its `destruction` block and try the roof joined.

**(c) Routing by stiffness: not done.** Weight goes to neighbours fewer bonds from the ground,
shared among them by what each bond can carry (by area, material and direction already). Making the
paths themselves stiffness-aware (a shortest path by compliance: Dijkstra instead of breadth first)
would cost about twice the weighing (a heap over 25-50 k bonds), and wouldn't fix the case that asked
for it: with the library's notion of direction (pressed only within ~45° of vertical), an arch's
inclined joints carry like side bonds (Market Town's limestone: 45 × 0.12 m² = 5.4) while a pane's
top edge, pressed, carries more (30 × 0.016 m² × 40 = 19), so the glass would still be the stiffer
path. It needs arch action (inclined compression) in the weighing first.

## 5. Bridging and landing sections

**What was wrong.** Over a lost column, Sun Temple's frieze and cornice could come to rest jammed
across the gap in a V. Three things held them there: a section at rest with its ends on the columns
froze whole (its centre of mass between its ends); loose pieces and rubble counted as holding up
whatever they touched from below, so the two arms of a V held each other up; and the wedged-piece
rule froze whatever stayed put for 2.5 s. Separately, a section that landed kept its joints unless
the solver pulled them apart (`breakOnPull`): Brick Street's facade falling flat into the street is
pressed, not pulled, and lay there as a sheet with its window grid.

**What changed.**

- **A section at rest bent at a joint gives way there**: a joint turned more than 4° from as it
  stood is pulled open on one side (a V sagging across a gap, a wall lying broken over something).
  Metal joints (`plastic`) and prop welds are left: they bend by design.
- **Rubble and loose pieces hold up only what's higher** (its centre over theirs). Standing pieces
  hold up whatever they push up.
- **A piece over a gap**, resting on one side and propped on the other on a piece no lower than
  itself, isn't wedged: it drops through what it's propped on, as a jammed piece drops clear
  (collision bit 30, 2 s at most). Over a gap: nothing at all within 1 m under its centre of mass,
  not the ground, the scenery, a standing piece, rubble or a loose piece. Propped: on rubble, or on
  a loose piece at rest that's over the gap too (the V's other arm).
- **A section cracks where it strikes**: as each of its pieces first strikes something (2 m/s or
  more into it) since it came loose, each of that piece's joints gives way if the energy of its two
  pieces' strike (½ × their reduced mass × their speed into what was struck, from the readback
  before) is more than the joint's strength times 1 mm. Sections report their contacts whether or
  not anything listens for `landed`.

**What the review found.** In the first round the test for a gap was a ray through the grid, which
holds only standing pieces and rubble: it missed the ground, the scenery and loose pieces, so a piece
lying unbalanced in a fresh pile or in the street was "over a gap", and was dropped through rubble
and loose pieces beside it (the reviewer counted 47 such jams with the ground within 1 m in one
collapse, and 84-340 through loose pieces). And a section cracked all its joints by its first
strike, so a toppling facade came apart in the air when its foot touched down (14-136 of 34-150
joints cracked between two pieces neither of which had touched anything; one cracked section reached
19.9 m). Both are fixed as above. After review (two runs each, the same instrument):

- Jams in a collapse (Brick Street two runs, Neon Alley four): Brick Street 245-347 (the reviewer's
  first-round runs: 303-322), Neon Alley 398-637 (736-1,069). Of those, by the rule for pieces over a
  gap: Brick Street 61-86, Neon Alley 142-215; through loose pieces at all: 21-22 and 36-57 (84;
  216-340). None by that rule can have the ground within 1 m under its centre of mass now; the 12-44
  a collapse that do are Phase C's rule (nothing under the piece at all, jammed between rubble).
  13-16% of the pieces looked at as not held were over a gap.
- Landing cracks: 34 and 64 joints cracked in Brick Street's collapse, every one at a piece that
  struck; none between two pieces still in the air. The facade falls in panels and breaks up where
  it strikes (`out/crackAir1-sheet.png`, +1/+2/+3 s), not in the air.

Measured:

- Brick Street, four blasts, from above at +8 s: before, the facade lay across the road as a sheet
  with its windows in 1 of 3 runs (and in part in another); after the first round, in none of 6,
  rubble across the street; after review, the street view at +40 s shows rubble, no sheet
  (`out/four2-t40.png`, `out/fourI3-t40.png`).
- Sun Temple, one flank blast (`demo.blast(-4, 1.6, 2.1, undefined, [0, 0, 1])`), +15 s: in the first
  round no V across the gap in 6 runs; in 2 a block or two still hung tilted at its edges, off what
  stands. After review, 3 runs: no V; 1-5 loose at +15 s, 0 at +25 s; the gap is open under the
  entablature (in one run a frieze block tilted at its edge rests on the cella wall behind:
  `out/temple1a-t25-close.png`, `out/temple1b-t25-close.png`, `out/temple1c-t25-close.png`). With the rules above but without the
  one for pieces over a gap, two architrave blocks froze in a V across it in 1 run of 2 (by the
  wedged rule, each resting on the other). Four flank blasts: the whole flank comes down, 0 loose at
  +15 s (`out/temple4a-t25.png`).

## 6. killBeyond

`DestructionOptions.killBeyond` (default 1000 m) and the `killBeyond` field: loose pieces further than
that from the world's centre (x 0, z 0, seen from above), or as high above the ground, are taken out,
as below `killBelow`. Props too. The runtime passes `WorldDefinition.destruction` through, so a world
sets it there:

```ts
destruction: { killBeyond: 90 }, // or in build(): d.killBeyond = 90
```

One run of Neon Alley's end block before had a piece 18.7 km up, still climbing at the speed cap; the
solver team's fix stops such flings, and 1 km catches what's left. It's a circle, and the same
distance caps height: it isn't a box test, and it doesn't spare props.

## New options and fields

| | Default | |
| --- | --- | --- |
| `DestructionOptions.killBeyond`, `Destruction.killBeyond` | 1000 | Loose pieces this far out, or this high, are taken out (props too). |
| `DestructionOptions.passHeldOnly`, `Destruction.passHeldOnly` | false | A bond giving way passes on only what it holds. |
| `BreakableMaterial.keepSmall` | false | A blast's cells under `minBodySize` beyond its reach stand as bodies. |
| `Destruction.stats.hanging` | | Pieces hanging on a hinge from what stands, the world, or what hangs. |

```ts
const d = new Destruction({ world, scene, materials, killBeyond: 300, passHeldOnly: true });
glass: presets.glass({ keepSmall: true }), // a pane keeps its far shards in the frame
d.stats.hanging; // 10: Dust Town's signs, batwing leaves and bell
```

## Changed defaults every world sees

- Piles freeze sooner: resting checks every frame (2 ms), in stages; sections part where they're at
  rest; the 6 s ceiling; the wedged rule waits only on what moves under a piece, 6 s at most.
- Loose pieces and rubble hold up only what's higher; a piece with nothing within 1 m under it,
  propped on rubble or a loose piece over the gap no lower than itself, drops through it.
- A section at rest bent more than 4° at a joint gives way there; a falling section cracks where its
  pieces strike, by their strike's energy (sections always report contacts).
- A tipped piece's pressed bonds hold as levers, with their material's pulled strength (they held
  nothing).
- `stats.loose` leaves out pieces hanging at rest; `stats.hanging` is new; a chain of hinges hangs
  whole. The loose cap leaves props and hanging pieces; small rubble a hinge holds stays.
- A blast's cells under `minBodySize` are particles wherever they are.
- Loose pieces past 1 km (or 1 km up) are taken out.

## What world workarounds can go

- **Market Town** (`medieval/index.ts`): `destruction: { maxLoose: 1500 }` can stay as a cost cap; the
  README's "the loose cap takes hung signs and props" and "pieces at rest wait to settle" no longer
  hold. The roof bays and the glass's 5 mm clearance stay (4(b) is an option to try with the roof
  joined; 4(c) isn't done). `falls.ts` (`releaseFronts`, `leanFalls`) stays: nothing here changes how
  fronts and towers are let go.
- **Dust Town** (`western/life.ts`, `clearRunaways`): keep it. `killBeyond` isn't the same test: it's
  a circle round (0, 0) that also caps height, so it can't follow the 70 × 60 m box (its corners are
  92 m out), and it takes props too, so tumbleweeds the wind rolls out of town would go where
  `clearRunaways` keeps them. The README's "`demo.stats().loose` reads 13 at rest" is now
  `stats.hanging` 10 and `stats.loose` 3-4 (the tumbleweeds, and at times a sign swung further).
- **Neon Alley** (README, Known issues): "Big collapses settle slowly" and the glass shards a few
  centimetres across kept as bodies are fixed in the library (the flings are the solver team's). Its
  cut cables and lanterns (`life.ts`, `hang()`) now hang link by link, as built, and the HUD read 2
moving 20 s after three were cut (15 in the first round).
- **Brick Street** (README, Known issues): "Glass at the edge of a blast's reach" is fixed; hinges are
  no longer counted moving while they hang at rest, so the reason given for not using them is gone.
- **Sun Temple** (`temple/levers.ts`): the V it guards against in `settle()` ("a span come to rest high
  up, out past what it rests on … leaning on its neighbour over the gap") is the library's now; keep
  `cut()` (shearing a span at its support's edge). With `passHeldOnly` on, `Levers` loops (4(b)): it
  would need a guard against cutting the same span again.
- **Harbor Yard**: nothing here replaces `tipStacks`.

## For `docs/making-a-world.md` (its owner's to change)

- Lines 123-125: "A hung piece is a moving body for good" no longer holds: it swings while its hinge
  holds it to what stands, the world, or a piece that hangs; once what it hangs from has fallen it
  comes to rest like anything else (and wakes with it). `stats.hanging` counts what hangs;
  `stats.loose` leaves out what hangs at rest.
- Line 162: "two pieces wedged against each other can hold each other up" holds only in part: loose
  pieces and rubble hold up only what's higher, a piece over a gap propped on one no lower drops
  through it, and a section at rest bent at a joint gives way there. Two blocks in a V over rubble
  less than 1 m under them can still settle there (Limits).
- New: `killBeyond` (a radius from (0, 0) and a height, props too), `passHeldOnly`,
  `BreakableMaterial.keepSmall`, `stats.hanging`.

## After review

| Finding | What was done |
| --- | --- |
| 1. Chained hinges froze in the air, lanterns cleared | A piece hung from one that hangs, hangs (`hanging()` round after round); hinged rubble isn't cleared; `stats.loose` counts hanging pieces at rest by the usual rule (still, or within 10 cm for 6 s). Test: a chain. |
| 2. The gap rule fired in piles and on the street | Over a gap only with nothing at all within 1 m under the centre of mass (the ground, the scenery, any piece); a loose prop only if it's over the gap too. Tests: a slab propped over a gap drops, not with the ground or a loose piece under it; the V across posts still drops. |
| 3. Landing cracked joints in the air | Each piece cracks its joints at its own first strike. Test: a section striking at one end keeps the joint between the two pieces still in the air, and loses it when the other end strikes. |
| 4. Tipped pressed bonds ignored `strength` | `Math.min(1, b.strength)`. Test: a weakened bond fails. |
| 5. The resting checks overshot 2 ms | Sorted once a readback, walked across frames; looked at only from `update()` (not with what's left after a readback); a big section waits for a frame to itself. Test: 2,025 blocks at rest freeze over several frames, each section looked for once. In the browser what's left over is single slow calls (see 1). |
| 6. Docs and tests | This file corrected; the `making-a-world.md` lines above for its owner; tests added for the wedged rule's wait on what moves under a piece and its 6 s cap, and for the "under" stage linking only what held the piece (and waking only when that goes). |

## Limits

- The resting checks take 2 ms a frame, but a single slow call can take it to 3-4 ms now and then, and
  a big section at rest (hundreds of pieces) takes what it takes, in a frame of its own. A collapse
  of 1,500 pieces at rest takes a few seconds to freeze. While a pile still moves (Neon Alley's end
  block at +20 s), nothing freezes it, and pieces that keep dropping clear of jams (a few dozen in a
  Neon Alley collapse, up to 8 times each) keep it loose longer.
- A wedged piece that isn't over a gap still settles where it is after 2.5 s, held or not (Phase C's
  rule): two blocks in a V over rubble less than 1 m under them can still freeze there. And the gap
  test is a single line under the centre of mass: a block over a narrow gap with a piece of rubble
  just under its middle isn't over a gap.
- A loose piece over the gap that props another has its collision mask changed while the other
  drops through it (20-64 in a collapse in Brick Street and Neon Alley): any jammed piece passes
  through it then.
- A section cracks only at each piece's first strike since it came loose; one that lands softly and
  then falls further doesn't crack again.
- A hung piece that swings more than 10 cm counts as loose for as long as it does.
- `passHeldOnly` makes a support carry no more than what fails over it held: right for what breaks
  off, but the weighing then lets more hang off its neighbours (a balcony over lost posts stands as a
  shelf), which is why it isn't the default.
