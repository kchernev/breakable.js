# Solver: flung pieces, stale slots, sinking, rolling and load hitches

The solver team's changes in phase D. Most are in the vendored three-avbd (`vendor/three-avbd/src`,
each noted for upstream in `vendor/three-avbd/VENDORED_COMMIT`). The library passes two new options
through (`src/lib/destruction.ts` `create()`), and the demo makes every pipeline before play
(`src/demo/main.ts`). Tests: `tests/solver.test.ts` (the plumbing, on a fake GPU device) and
`scripts/solver-lab.mjs` (the solver's behaviour, in Chrome: see Checking it). The vendored GPU tests
(`tests-gpu`) follow the changes, but they can't run here: Dawn won't load under Node on this
machine.

A review found one regression and several overstatements. They're fixed here, and this note says
what's left:

- **Seams** (3): speculative contacts stopped pieces dead at the seams between flush fixed bodies.
  That's fixed, along with the same stop, rarer, that was there before speculation.
- **Flings** (1): flings are bounded at `maxSpeed`, not gone. The counts below show what's left.
- **Pipelines** (5): the warm-up left pipelines for the first frames of play. Now it leaves none in
  Harbor Yard and Market Town, and one in Brick Street (its own hydrant kernel).
- **Rolling**: `DestructionOptions.rolling` is a number only now (per material belongs in
  `BreakableMaterial`).

**No world has to change anything.** All six load with no console errors and stand (0 loose pieces
for 10 s after load; Dust Town 4-13, its hinged signs, batwing leaves, bell and tumbleweeds). The
typecheck, the tests, the build and the solver lab pass. The workarounds still work. Most can now
go (end of this note).

## How it was measured

Four blasts 1 s apart, then 20 s of watching every readback of the loose pieces (a probe wrapped
round `Destruction.afterRead`):

- Neon Alley: at the end block's base, (29.9, 1.2, ±6 and ±2.6).
- Harbor Yard: at the crane's four leg feet, (-20.8 or -8.8, 2.5, -21 or -1).
- Brick Street: x 10, 14, 18 and 22, y 1.2, z 10.3.
- Dust Town: along the saloon's ground floor, x -22 to -13, y 1.2, z 9.3.

The counts:

- **far 120 m**: pieces ever read more than 120 m from the world's centre.
- **off**: new pieces whose first readback was further from where they were made than `maxSpeed`
  allows.
- **sunk**: pieces read wholly under the ground (5 cm or more), where there is ground (not water).
- **through**: pieces read 1 m or more under it, so out of the bottom of the ground box.
- **flings**: from 0.5 s after the last blast, loose pieces whose speed rose by 8 m/s or more
  between two readbacks (about 0.1 s apart, in which a fall gains 1 m/s), to 10 m/s or more. In
  brackets, those of them thrown upwards (over 5 m/s up). Some are real: a piece struck by a heavier
  one falling. The upward ones are the solver's.

Two counts aren't evidence any more, because the step limit (1) now guarantees them:

- **jumps** (a piece moving further between readbacks than `maxSpeed` allows) can't happen.
- **far 1 km** can't happen in the 20 s watched: at 40 m/s that's 800 m.

Before the changes they were real: up to 14 pieces past 1 km and 68 jumps a run in Neon Alley, and
a Brick Street cell 89,000 km off.

The "before" rows are four runs a world, one at a time. The GPU is shared with other agents'
Chromes, and a slower frame takes more substeps. The "through" count came later, so its "before" is
from two runs per world with the old solver behaviour switched back on. Flings weren't counted on
the old code. The "after" rows are five runs a world of the finished code (Dust Town nine).

| | far 120 m | off | sunk | through | flings (up) | farthest |
| --- | --- | --- | --- | --- | --- | --- |
| Neon Alley, before | 2-56 | 0 | 62-86 | 3-6 | | 232 m to 86 km |
| Neon Alley, after | 0 | 0 | 0-4 | 0-4 | 2-6 (0-1) | 64-88 m |
| Harbor Yard (crane), before | 0-7 | 0 | 0-1 | 0-1 | | 97 m to 167 km |
| Harbor Yard, after | 0 | 0 | 0 | 0 | 0 | 96-108 m |
| Brick Street, before | 3-14 | 0 | 4-14 | 0-3 | | 204 m to 89,000 km |
| Brick Street, after | 0 | 0 | 0-4 | 0-4 | 1-5 (0-1) | 34-57 m |
| Dust Town, before | 3-19 | 0-24 | 19-58 | 12-41 | | 1.6 km to 10^8 km |
| Dust Town, after | 0 | 0 | 0-11 | 0-7 | 0 | 55-77 m |

Dust Town's 11 sunk and 7 through were all in one run of the nine (the cells of two siding
boards; Not done, in 3). In the other eight, none sank.

Loose pieces left 20 s after the last blast varied widely from run to run: Neon Alley 126-1,134,
Brick Street 56-2,995. The collapse team was changing how pieces come to rest
(`Destruction.rest`) during these runs, and an A/B of my last change at one moment showed no
difference. So that number says little about the solver.

Small checks run in the page, each on a world of its own. They're `scripts/solver-lab.mjs` now (see
Checking it):

- boxes sliding from 10 m/s, which should stop in 10.2 m;
- plates and slivers thrown at a 1 m ground box at 10-40 m/s;
- pieces slid over a floor of flush tiles;
- pieces rolled;
- cells made in freed slots.

## 1. Pieces thrown kilometres in one step

**Cause.** I traced it by stepping the solver by hand and reading every body after every step. Each
fling was a light piece (0.1 g to 20 g in the solver's units) pinched between heavy or fixed bodies:

- a neon tube fragment between the street and a fallen pane;
- a glass shard between two signboxes;
- a steel mullion under a 4 t slab.

Neither contact can be satisfied. Augmented Lagrangian's dual raises both forces every iteration
(λ += k·C), and keeps them into the next step. The pinched piece then carried forces of 40 to 3,000
units from both sides: tens of thousands of times its weight. The small mismatch between two nearly
opposed forces (normals and lever arms not quite opposite, f32 round-off) threw it out at
10-40 m/s, spinning at 100 rad/s.

`maxSpeed` then clamped the velocity, but not the position the Newton step had produced. The piece
stayed where it was thrown, up to 10^13 m off. Its joints and contacts dragged its neighbours after
it in the remaining iterations.

**Every traced kilometre jump was in a substep that reused the manifolds.** That is a slow frame's
second or third step (`main.ts` passes `reuseManifolds` there). Those steps kept the detecting
step's contact points: anchors and normals from before a piece had spun half a turn, so its
contacts pushed in nonsense directions. With every step detecting, the same 700-step trace had
none.

**Changes** (vendored solver; on whenever `maxSpeed` is set, which the Destruction does):

- **No contact pushes harder than it takes to change its pair's speed apart by `maxSpeed` in one
  step**: their reduced mass × `maxSpeed` / dt. A light piece under a heavy one gives way, or is
  pressed into what it rests on, instead of being shot out.
  - A push cut that way stiffens the Newton step only as much as is left of it, as friction at its
    cone does. It doesn't ramp its penalty.
  - No impact needs more: this force stops a pair closing at `maxSpeed` in one step. What it does cut
    is a heavy load resting on a light piece (see Not done).
- **A step moves a body no further than `maxSpeed` × dt from where it started the step**, in every
  primal update, and the velocity it leaves comes from that pose (the pose and the velocity agree).
  This is the safety net: no iteration ever sees a body somewhere it couldn't have got to.
- **Substeps collide again.** `reuseManifolds` now keeps the detecting step's broadphase pairs and
  runs the narrowphase on them again: pairs whose bodies haven't moved keep their points, as on any
  step. The kernel that copied every manifold whole is gone.

**What's left: flings are bounded, not gone.** The push cap is per contact. Two opposed pushes, each
within the cap, can still differ by as much as the cap, so a pinched piece can still be shot out at
up to `maxSpeed`. What the changes guarantee is that nothing goes faster or further than that. In
Neon Alley, over 500 hand-stepped steps with every other one a substep, steps where the solve sped
a piece up by 8 m/s or more away from any blast fell from 14 to 5. Pieces turning faster than
60 rad/s fell from 151 to 100 piece-steps. In real collapses, the flings column of the table:

- Neon Alley: 2-6 a collapse.
- Brick Street: 1-5.
- Harbor Yard and Dust Town: none.

In Neon Alley and Brick Street, one run in five had one thrown upwards, at 10-13 m/s: a concrete
chunk 13 m up, a piece of wood 7 m up. The rest went down, at 10-16 m/s, most of them high in the
falling block: struck by heavier pieces falling, or flung, which the probe can't tell apart. The review counted
4-5 in Neon Alley (1-2 upwards) and 0-1 in Brick Street on the code it reviewed.

Two ways to go further, not tried:

- Stop the dual raising a contact's force while its body is already pushed at the cap from the
  opposite side.
- Cap a body's net contact push in a step rather than each pair's.

Either needs each body's contacts summed before the dual, which the solve doesn't do now.

A spin limit, applied at the end of each step, was tried and left out:

- In the primal it made things worse. Turns the Newton step wanted were taken up by moves.
- At the end of the step, it made no difference over three real-time runs per world.

## 2. Fragments starting at another body's place

**Cause: mostly not the slot.** I tested freeing slots and reusing them across steps, reading back
the new bodies:

- heavy boxes resting on the ground, replaced in the same frame by light ones;
- loose hulls cut into eight cells each, the cells made in the freed slots.

The new bodies did inherit their predecessor's warm starts. The narrowphase matches last step's
pair of the same two slots, and carried over its forces, penalties and static-friction anchors.
But the effect was bounded: at most 8 mm and 0.8 m/s, because a resting piece's force over its
penalty is millimetres. The contact watch also read the new body as the old one, still touching,
so it reported no landing for it.

What Dust Town's "off" pieces really were (24 in one run) was cells cut from a floor and the
boardwalk, under a blast. The blast throws them away from its centre, so downwards: 25-35 m/s into
the ground. One step took them half a metre into a 1 m ground box, past its middle, and the contact
then pushed them out of its far side. In that first readback they were already 5-30 m under the
street, falling (the "already falling 25-29 m/s" of the report). Brick Street's two "absurd" pieces
were flings (1).

**Changes:**

- **Speculative contacts** (3) catch those cells at the surface.
- **A freed slot waits a step** (vendored `World`): a removed body's slot goes to a new body only
  after one step has run with the old body parked there. Nothing of the old body's contacts can
  carry over, and contact events read right.
  - A full world still takes a parked slot at once.
  - This replaces the earlier patch for a body removed before its first flush.
  - The Destruction's own readback cache needed nothing. A new body is written after any readback
    in flight was issued, so its pose comes from its own state until a readback of its own.

"Off" went from 0-24 a run to 0 (Dust Town); the others had none before.

## 3. Pieces sinking through the ground

**Cause.** There were three, found by tracing the step each piece first went under.

1. **No contact until they overlap.** A piece falling or thrown at 10-35 m/s is above the ground at
   the start of a step and 15-60 cm into it at the end. The narrowphase only makes contacts for
   bodies already touching.
2. **In a substep, no new contact at all.** A substep kept the detecting step's contacts and found
   no new ones. With every other step a substep, 57% of first sinkings were in substeps.
3. **Recovery was 1% a step.** The paper's stabilization moves 1 - α of a penetration a step, and α
   is 0.99. A piece 20 cm under was still 16 cm under a second later. It came to rest there and was
   frozen as rubble under the street. That's why Neon Alley's neon bits were read at rest at -0.15 to
   -0.4 m.

Once past the middle of a 1 m ground box, the shallower way out is the bottom. With Dust Town's 4 m
box that happens 2 m down, so it lost fewer pieces. In Neon Alley most sunk pieces stayed in the box,
which is why its 20 m box sank as many. Thin pieces' contact normals were not the problem: a small
body inside a big box always gets the big box's nearest face.

**Changes** (vendored solver, each on by default and switchable in `solver.params`):

- **`speculative`**: a moving body's contacts with fixed bodies (the ground, scenery, standing pieces,
  rubble) are found while they're still apart. The broadphase, the box and hull narrowphases and the
  contact clipping all take the gap.
  - The look-ahead is as far as the body moves in three steps at its speed, but only within the
    broadphase cells next to its own. Against the large bodies (the ground boxes, tested against
    every mover) that's the whole way. Against small fixed ones (standing pieces, rubble) it's about
    a cell: the finest cells are twice a typical piece's radius, so under 2 m at 40 m/s. Widening
    the scan to the full look-ahead would make a fast piece scan many times as many cells.
  - Such a contact holds no force until the gap closes. Its normal row takes the gap whole, and only
    the overlap past the margin is stabilized.
  - Between two moving bodies, contacts are still made only on touch.
  - The narrowphase's preference for a face over an edge is now a margin on the separation's size,
    so it holds for a pair still apart. Scaled by 0.95, a positive gap let an edge win: a flat plate
    falling onto the ground met it on one point, tipped and went 7 cm in. Now it stops on it.
  - Contact events count a pair as touching once a point has met or pushed. A begin's impulse is the
    larger of the step's and the speed they met at times their reduced mass, because a speculative
    contact takes a hit over two steps. A 1 kg box falling 1.25 m reads 4.74 N·s (5.07 before; m·v
    is 4.95).
- **`seams`** (added after the review; below).
- **`pushOut`**: penetration deeper than 1 cm past the contact margin is pushed out at up to 1 m/s,
  besides the 1% a step. A piece pressed 20 cm in is out in about 0.2 s, before it can come to rest
  there.
- **Substeps collide again** (1).

With 120 plates and slivers (1-3 cm thick) thrown at a 1 m ground box at 10-40 m/s, 39 went through
before and 1 after. 66 ended under the surface before, and 1 after. Real collapses: the table's
"sunk" and "through" columns.

### Seams: pieces stopping dead between flush fixed bodies

The review found that speculation made sliding pieces stop dead at the seams between flush fixed
bodies, or hop:

- Dust Town's boardwalk planks;
- floors made of several slabs;
- Sun Temple's paving;
- frozen rubble.

On a floor of 0.5 m fixed tiles, a box sliding from 15 m/s went 0.6-1.7 m where friction allows
28.7 m. On Dust Town's boardwalk, a box from 4 m/s went 0.41-0.56 m instead of about 1.4.

**Cause.** A piece resting on a fixed body sinks the contact margin (1 cm) into it. So its bottom is
1 cm below the top of a flush neighbour, and towards that neighbour the separating axis with the
most separation is the neighbour's side, not its top. Speculation found that side ahead, as a
contact with a gap, and it stopped the piece at the seam as if at a wall. Without speculation the
same happened whenever the piece crossed into the neighbour by less than the 1 cm it sat in its own
tile: a few seams in a hundred at 6-15 m/s. That's why boxes stopped at 13.5 m of 28.7 m before
speculation too.

**Change: `seams`** (vendored, on by default; `wgsl-collision.ts` `rides`, used by the box and hull
narrowphases):

- A moving body level with a fixed body's upward face meets that face, not any axis that separates
  them more. "Level" means overlapping it along its normal by no more than twice the margin;
  "upward" means within 45° of up.
- While the piece is beside the neighbour, the face's contact clips to nothing. Once it's over it,
  it rests on its top.
- Only for a moving and a fixed body, and only upward faces. A thin plate sliding into the foot of a
  wall still meets the wall: the wall's face it would ride under faces down. 1-3 cm plates and boxes
  slid into a fixed wall at 8-14 m/s stopped at its face, the same as without `seams`.
- Pieces dropped on the edge of a fixed slab land as they did.

| Slid over flush fixed tiles, 0.5 m (boxes 5-40 cm and a hull, box and hull tiles, 3-15 m/s, friction 0.4) | distance, of v²/(2μg) | fastest upwards |
| --- | --- | --- |
| speculation, before | 0.01-0.76 | 3.28 m/s |
| no speculation, no `seams` | 0.51-1.05 | 1.26 m/s |
| speculation and `seams` (now) | 0.98-1.10 | 0.15 m/s |

In Dust Town, boxes were slid along the saloon's boardwalk (planks across it, a seam every 0.4 m)
and, for comparison, the street (one ground box):

| Slid from | 2 m/s | 4 m/s | 6 m/s |
| --- | --- | --- | --- |
| boardwalk, speculation, before | 0.07-0.38 m | 0.41-0.56 m | 0.41-1.35 m |
| boardwalk, now | 0.37-0.38 m | 1.51-1.55 m | 3.42-3.50 m |
| boardwalk, no speculation and no `seams` | 0.07-0.37 m | 1.51-1.53 m | 3.42-3.53 m |
| street, any of these | 0.32-0.33 m | 1.33-1.34 m | 3.01-3.12 m |

On the boardwalk they now go as far as without speculation, and the 2 m/s box no longer stops at
the first seam. They go a little further than on the street: the planks' friction is lower.

In the four-blast collapses, `seams` on and off (two runs a world, and four more in Dust Town)
differed only within the run-to-run noise: sinking, flings and how far pieces went. The
collapse's own pieces mostly land in piles, not on long runs of flush fixed floor.

**Not done:** the pieces that still go through, none in most collapses and up to 7 in a few:

- Neon Alley and Dust Town had them before the review.
- After it, they turned up in one run of five in Neon Alley (4), in Brick Street (4) and in Dust
  Town (7, of nine runs).

Each is the cells of one piece at a time:

- Neon Alley's tiles 8062-8064;
- Dust Town's siding 9808-9809, 9552-9554 and 9739-9741;
- Brick Street's bricks 7517-7520.

Each was found at about -1 m, moving down at 7-16 m/s. That fits a light cell pressed into the
ground by a heavy piece landing on it. The push cap (1) lets the heavy piece press the cell as hard
as the ground can hold it, so it stays in and is driven down. There is no true continuous
collision.

I tried leaving contacts with fixed bodies uncapped (three runs each in Neon Alley and Dust Town):
0-1 went through against 0-2, with no flings either way. That's within the noise, so I left the cap
the same for all contacts.

## 4. Rolling forever, and sliding on

**Cause: mostly friction, not rolling.**

- **Sliding friction failed for light bodies.** Friction cut to its cone (sliding) kept its full
  penalty stiffness in the Newton step, ramped while the contact had stuck. A light body's step
  (m/dt² under that stiffness) then hardly felt the friction force, and it slid on as if on ice.
  Neither the reference nor the paper changes this. A 0.3 m box of density 0.001 sliding from
  10 m/s went 31.6 m; 10.2 m is right. 5 cm brick cubes from 15 m/s went 15 m; 12.7 m is right.
  That was Brick Street's cells at 12-28 m/s for 100 m, and Harbor Yard's rail sliding at 28 m/s
  for 6 s.
- **A contact that had stuck pulled back.** The stick bit was set only while friction was within
  its cone, so it survived sliding. A contact that had stuck kept its old anchors while it slid and,
  once stopped, pulled the body back towards them: a box pushed 10 m slid 6 m back.
- **Real rolling never stopped.** A polygon rolling over its faces loses little in the solve,
  because nothing in the contacts resists turning.

**Changes:**

- **`slipFriction`** (vendored, on by default):
  - A sliding contact's friction rows keep only as much stiffness as the cut to the cone left them,
    floored at the pair's own m/dt² where they were stiffer. Without the floor, a light cube
    sliding pitched over its front edge and bounced along (58 m).
  - The stick bit is cleared whenever the contact slips.
- **Rolling resistance**, per body (vendored `BodyOptions.rolling`, default 0, as upstream). It's a
  torque against the body's turn: the coefficient × the push its contacts carry × its smallest half
  width. It's applied where the step's spin is derived, from the contacts' last forces.
  - Nothing in the air: a cube spinning in free fall spins as it does without it (4.758 rad/s after
    1 s from 5, either way; the integrator's own loss).
  - The Destruction gives every piece and prop `DestructionOptions.rolling` (default 0.02).

| From the lab | before | after (rolling 0) | after (rolling 0.02) |
| --- | --- | --- | --- |
| 0.3 m box, density 0.001, sliding from 10 m/s (10.2 m is right) | 31.6 m | 11.3 m | |
| 5 cm brick cubes sliding from 15 m/s (12.7 m) | 15.0 m | 14.1 m | |
| Box pushed 10 m after resting 2 s | slid back to 4.3 m | stays at 10.1 m | |
| 16-sided drum, 0.6 m across, rolling at 2 m/s | 4.4 m | 3.6 m | 2.9 m |
| 0.3 m cube thrown tumbling at 15 m/s | 47.8 m | 18.9 m | 19.2 m |

The baluster isn't in the table: an eight-sided one (0.85 × 0.07 m) set rolling at 0.2 m/s on
level ground stopped at once before and after. Dust Town's, rolling on for 8 s, wasn't on level
ground or wasn't alone (a slope, a pile, a push), and I couldn't make it again. Rolling resistance
is for that: at 0.02 a rolling baluster stops in about half a second.

## 5. Load hitches

**Causes.**

1. **The first frames made every render pipeline as they drew.** They made the AO pre-pass first,
   then the beauty pass with its reflection buffers, and only for what was in view. Measured over
   the first 10 s after the card, three runs each:
   - Harbor Yard: 4-5 frames over 100 ms, 6.0-6.5 s in all, worst frame 3.5-3.9 s.
   - Market Town: 3 frames, 2.1-2.6 s, worst 1.7-1.9 s.
   - Brick Street: 3 frames, 4.0-4.2 s, worst 2.0 s.
2. **The solver remade its prefix scan's shader module and pipelines on every `addBodies`**: 122
   times in one Brick Street collapse.
3. **The contact-event pass was made at the first loose contact**, mid-game.

**Changes:**

- `main.ts`: before the card, under a "Shaders…" status, the demo:
  - steps the world once (the solver makes its hull narrowphase when the first hulls reach it);
  - runs the particles once (their kernels);
  - draws two frames of the whole pipeline with nothing frustum-culled (every pass, the shadows and
    the post, for every object), in the renderer's animation loop;
  - then waits for the GPU.

  `renderer.compileAsync` alone can't make these. It compiles for the default pass, and the
  passes' pipelines differ by render target, MRT and context. The ambient-occlusion context is read
  when nodes are built, after `compileAsync` has returned.

  The review found that the first version, one frame drawn outside the animation loop, still left
  pipelines to the first frames of play: Harbor Yard 47, Brick Street 11. They were the shadow
  pass's, the reflections' and a vertex variant per instanced mesh, besides the solver's and the
  particles' kernels. A frame drawn outside the loop doesn't advance the renderer's frame, so
  its passes made pipelines that play didn't reuse. Pipelines made after the page was ready, while
  standing, counted by wrapping `GPUDevice.create*Pipeline`:

  | | first version | now |
  | --- | --- | --- |
  | Harbor Yard | 47 | 0 |
  | Market Town | | 0 |
  | Brick Street | 11 | 1 |

  Brick Street's one is its hydrants' water kernel, made by the world's own `update` on its first
  frame (`worlds/nyc/water.ts`). Nothing new is made at the first rocket.
- The vendored scan makes its pipelines once per device.
- `World.onContact` makes the contact-event pass when a listener subscribes, so the Destruction gets
  it at load.

| Frames over 100 ms in the first 10 s after the card | before | first version (3 runs, then 6) | now (3 runs) |
| --- | --- | --- | --- |
| Harbor Yard | 4-5 (6.0-6.5 s; worst 3.5-3.9 s) | 0-2 (0-0.9 s; worst 0.1-0.7 s) | 0-1 (117 ms) |
| Market Town | 3 (2.1-2.6 s; worst 1.7-1.9 s) | 0-1 (0-0.13 s) | 0 |
| Brick Street | 3 (4.0-4.2 s; worst 2.0 s) | 0-2 (0-0.23 s) | 0-1 (117 ms) |

The two frames over 100 ms that are left aren't compiles: no pipeline is made after the card.

The time to the card is the same as with the first version: Harbor Yard 6.9-7.2 s, Brick Street
4.9-5.1 s (two runs each, in turn). The "Shaders…" stage is most of it: Harbor Yard 5.8-6.1 s,
Brick Street 3.8-4.0 s, against 1.1 s for everything before it. This note said 2.1-2.3 s before.
That was wrong: the status change was recorded only after the first version's draw, which held the
page for seconds without yielding.

**The first rocket's worst frame**, fired at what the player looks at on arrival:

| | before (2-3 runs) | first version (6 runs; median) | now (3 runs) |
| --- | --- | --- | --- |
| Harbor Yard | 50-67 ms | 33-117 ms; 33 | 33-50 ms |
| Market Town | 50-83 ms | 17-117 ms; 42 | 33-117 ms |
| Brick Street | 33-83 ms | 33-150 ms; 42 | 33 ms |

The medians are down, but there are outliers. Three of those worst frames, broken down:

- the CPU spent 3-25 ms of the 50-87 ms (the destruction's work 0.3-16 ms, the render's encoding
  2-22 ms);
- the rest is the GPU, shared with other agents' Chromes, where Brick Street standing runs at 30-50
  fps.

So the first blast isn't solved; what's left isn't pipeline compiles.

## Cost

GPU time of a step in a collapse (timestamp queries, during four blasts, the GPU shared):

| | before | after |
| --- | --- | --- |
| Neon Alley, detecting step | 3.9 ms (p90 4.8): collision 2.4, solve 1.4 | 4.3 ms (p90 5.0): collision 2.9, solve 1.3 |
| Brick Street, detecting step | 4.0 ms (p90 5.2): collision 2.6, solve 1.3 | 4.4 ms (p90 5.0): collision 2.7, solve 1.5 |
| Substeps (a slow frame's 2nd and 3rd), collision | 0.02 ms | 0.3-0.5 ms |

In both worlds, about 10% more per detecting step, mostly the speculative pairs. A substep pays for
its narrowphase, but substeps were rare in these runs (under 10% of steps). Fewer pieces stay
loose, which the solver gains back after a few seconds. `seams` adds a compare per face axis.

## New, and what it replaces

### `DestructionOptions.rolling` and `BodyOptions.rolling`

```ts
new Destruction({ world, materials, rolling: 0.02 }); // the default, every piece and prop
new Destruction({ world, materials, rolling: 0 });    // they roll on
world.addHull({ shape, rolling: 0.05 });               // three-avbd, per body (default 0)
```

It's rolling resistance, a coefficient: on what a piece rests, its turning is slowed by a torque of
this × the push it rests with × its smallest half width. At 0.02, a drum 0.6 m across set rolling
at 2 m/s stops in about 3 m, and a baluster at once. Nothing happens in the air.

The option took a record by material name too; that's gone, before any world used it. A material's
own rolling belongs in `BreakableMaterial` (`src/lib/materials.ts`, not mine to change). With a
`rolling` field there, the Destruction's `create()` would pass `material.rolling ?? this.rolling`.
The review found no world that needs it yet: the wind rolls Dust Town's tumbleweeds as before.

### `World.maxSpeed` now limits moves and pushes

```ts
new Destruction({ world, materials, maxSpeed: 40 }); // the default, as before
```

As before, nothing loose goes faster. Now, also:

- a step moves nothing further than `maxSpeed` × dt;
- no contact pushes harder than it takes to change its two bodies' speed apart by `maxSpeed` in a
  step.

### Solver parameters (`world.solver.params`, vendored; all on by default)

- `slipFriction`: sliding friction as Coulomb's, for light bodies too (4).
- `pushOut`: deep penetration pushed out at up to 1 m/s (3).
- `speculative`: contacts with fixed bodies found a few steps ahead (3).
- `seams`: a moving body level with a fixed one's upward face meets that face, so it slides over
  seams (3).

```ts
world.solver.params.seams = false; // as before: pieces may stop at the seams of flush fixed bodies
```

The vendored reference comparisons switch them off, as they do `massPenalty` and the others.

### `step({ reuseManifolds: true })`

It now keeps the pairs, not the contacts (1).

## Changed defaults every world sees

- **Moves and pushes are capped by `maxSpeed`** (40, or the world's). Flung pieces go no faster
  than that and no further than it takes them, where they went kilometres. A few are still thrown
  (1).
- **Sliding friction works for light pieces.** Light debris used to slide up to three times as far
  as friction allows, and now stops where it should. A contact that slid no longer pulls its piece
  back.
- **Pieces slide over seams.** On planks, slabs, paving and rubble they go as far as on one floor.
- **Deep overlaps are pushed out at up to 1 m/s.** Pieces pressed into the ground rise out of it.
- **Speculative contacts with fixed bodies.** Thin pieces thrown at the ground stop on it, nearly
  always. A contact event's begin impulse is the larger of the step's force and the meeting speed ×
  reduced mass, so landing speeds read a little differently: about m·v.
- **A light piece holds about 245 times its weight at most** (a contact's push cap at 40 m/s and
  60 steps a second: 40 × 60 / 9.81). Under more, it's pressed into what it rests on.
- **Substeps run the narrowphase again**: 0.3-0.5 ms more GPU each on a slow frame.
- **Rolling resistance 0.02** on every piece and prop (`DestructionOptions.rolling`).
- **A removed body's slot waits a step** before a new body takes it (a full world takes it at once).
- **The demo makes every pipeline before the card** ("Shaders…"), and steps the world once. The
  contact-event pass and the solver's scan pipelines are made at load.

## Per world: what can now go

- **Harbor Yard** (`src/demo/worlds/harbor/index.ts`): `runaways()`, its `seen` map and its call in
  `update`.
  - In nine crane collapses the farthest piece was 96-108 m from the yard's centre, and none
    passed 120 m: light sheet now stops sliding.
  - `destruction.maxSpeed: 25` is the world's to keep or drop (40 is the default).
  - Its README's known issues 1 (flinging) and 2 (sliding on), and library requests 3 and 6, are
    done.
- **Dust Town** (`src/demo/worlds/western/life.ts`): `clearRunaways()` and `runawayCheck`.
  - Its speed test was already the library's. Its out-of-town test (|x| > 70, |z| > 60) caught
    flings: the farthest piece in the 19 saloon collapses run since was 55-85 m from the centre.
  - A blast at the town's edge can still throw a board 100 m, at 35 m/s. Keep it if the town should
    stay tidy.
  - `destruction: { maxSpeed: 35 }` was for the runaways: it can go.
- **Neon Alley**: nothing in code. Its README's notes on pieces thrown kilometres and sinking through
  the street (known issue and library request) are done. A few pieces are still thrown at up to
  13 m/s in a collapse (1).
- **Brick Street**: its README's notes on the first loose contacts compiling and on the adjacency
  scan being remade are done.

## Checking it

`scripts/solver-lab.mjs` runs the solver's behaviour in Chrome, each case on a world of its own on
the demo's device, and exits 1 if a case misses its threshold:

```
SHOT_DISPLAY=:1NN node scripts/solver-lab.mjs --port 5331 [--only seams,roll] [--world nyc]
```

| Case | Threshold | Now |
| --- | --- | --- |
| `throw`: 120 plates and slivers thrown at a 1 m ground box at 10-40 m/s, substeps between | at most 2 through | 1 |
| `slide`: 0.3 m boxes of density 0.001-1000 from 10 m/s, thrown and after resting 2 s | within 15% of v²/(2μg), 10.2 m; none slides back | 10.1-11.3 m |
| `seams`: boxes and a hull over flush box and hull tiles at 3-15 m/s | within 15% of v²/(2μg); under 1 m/s up | 0.98-1.10; 0.15 m/s |
| `stack`: ten bricks; a 4 t slab on 2 g cubes; a box under one 2,500 times heavier | column top 2.9 m within 3 cm (each contact rests 1 cm in); slab bottom over -3 cm; still; the light box pressed in, bottom over -0.4 m | 2.901; -0.009; 0.015 m/s; -0.290 |
| `pinch`: slivers under a dropped slab, chips in a V under a dropped block, panes between boxes driven together, chips under a slab | no light piece gains 8 m/s between readbacks; none strays | 1.2 m/s; 0 |
| `roll`: a 16-sided drum at 2 m/s, rolling 0 and 0.02; a cube spinning in the air | under 4.5 m at 0.02, and shorter than free; the same spin either way | 3.57 m free, 2.86 m; 4.758 rad/s |
| `landing`: a 1 kg box falling 1.25 m | one begin, impulse within 15% of m·v (4.95) | 4.74 N·s |

With `speculative` off, `throw` fails (41 through). With `seams` off, `seams` fails (0.01-0.76).
`making-a-world.md` isn't mine to change. Its owner should add three things there: this script,
in "Checking it"; and the rolling default and the 245× limit, in "What the library does by itself".

## Not done

- **The first rocket's worst frame**: medians 33-42 ms, outliers to 117-150 ms (5). What I measured
  of the rest is GPU time on the shared GPU.
- **True continuous collision**: the 0-7 pieces a collapse (0 in most) through the ground in Neon
  Alley, Dust Town and Brick Street (3).
- **Flings bounded, not removed** (1).
- **Fidelity**: light pieces pinched between heavy ones now give way rather than being shot out. A
  light piece under a much heavier one (over about 245 times its weight) is pressed into what it
  rests on, the ground included, and the heavy one settles onto it. In the lab, a 0.3 m box of
  density 1 under one of 2,500 ends with its bottom 0.29 m into the ground, and the heavy box 2-7 cm
  into it. That's the push cap's price.
- **The vendored GPU tests** (`tests-gpu`: updated for slot parking, the new flags, the substep
  semantics and seams) can't run here. `scripts/solver-lab.mjs` runs the same checks in Chrome.
