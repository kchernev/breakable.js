# Structural stability and collapse: what changed

The structure team's changes in this phase, all in `src/lib/destruction.ts` (freezing, waking,
weighing, letting go, the public calls) and a new `src/lib/support.ts` (where two convexes touch,
which way each touch pushes, whether a centre of mass is over what holds it). `StateEvent` is
exported from `src/lib/index.ts`.

Tests (no GPU, no browser): `tests/stability.test.ts` and `tests/support.test.ts` (on
`tests/fake-world.ts`, which now has `World.bodies`, body shapes, collision groups and
`applyImpulse`); the old `tests/structure.test.ts` still passes unchanged.

## What every world sees (defaults)

- **Rubble freezes only where something holds it up.** A loose piece at rest (under 0.15 m/s and
  0.3 rad/s for 0.8 s, as before) freezes as rubble only if its centre of mass is over the touches
  that push it up: the ground, fixed bodies that aren't pieces (the scenery: steps, quays, cliff
  hulls, found by `reinforce()`; not bodies that collide with nothing, like a hinge's holder, nor
  ones removed since), standing pieces, rubble, and loose pieces at rest themselves. A touch holds
  it up when its normal is within ~70° of straight up; sideways touches don't. Within 3 cm (more
  for bigger pieces: 3 cm per metre of size again) of balanced counts as over. A piece leaning on
  something (a plank against a wall) also rests: a sideways touch pushing it back over the edge it
  stands on, high enough above that edge for friction there to take the push (1/0.6 of its
  overhang). Sections still joined together are judged as one, with their centre of mass.
- **A piece creeping on doesn't freeze.** A slow piece that moves more than 3 cm from where it
  slowed down starts its 0.8 s again.
- **A section at rest that nothing holds up as one comes apart at its joints** (`bondBreak` events,
  as when a joint breaks on landing), and each piece is then looked at alone. A temple span jammed
  between its neighbours, or a wall propped on one end, falls apart instead of hanging. A prop's
  welded parts stay one.
- **A jammed piece drops clear.** A piece (or a section, or a prop's parts, together) at rest that
  nothing holds up, touching standing pieces that don't hold it up either, is jammed against them:
  fixed pieces don't give way, and the solver's friction against them can hold it in the air for
  ever. It passes through them (they stop colliding with it) until all of it is clear of them, or
  for 2 s at most. With nothing under it at all it passes through rubble too; partly held, only
  through what's still standing. **Collision group bit 30 (`1 << 30`) is the library's** for this:
  don't use it in a world.
- **Wedged in among rubble, a piece settles.** Not held, but touching only rubble and loose pieces
  (a pile), it freezes after 2.5 s at rest; and so does a jammed piece that stayed where it was for
  5 s though it passed through what it touched, or one at rest touching nothing the library knows
  of (held by a body that isn't a piece or scenery). But not while anything it touches is still
  moving: it waits until that has stopped (and then rests on it, or on the rubble it became).
- **Rubble and props remember what they rest on, and wake when it goes**: when it's removed or
  broken (a blast's cells replace it), comes loose, wakes, or (a loose piece they came to rest on)
  moves on more than 3 cm. A piece that froze leaning, or wedged, remembers what it leans or is
  wedged against too (its sideways touches). Waking is loose again, at rest; what rests on what
  wakes, wakes too. Props note what they rest on when added and again at `reinforce()`.
- **Rubble that came to rest joined stays joined.** Its bonds are kept (the joints go while it's
  fixed) and it wakes as one, its joints made again where they held it as it rested. Taken out
  (`removePiece`) or let go (`loosen`), what rested joined to it wakes and looks again at what
  holds it.
- **Small rubble that something rests on, or that came to rest joined to other rubble, isn't
  cleared** (`rubbleLife`): that would stir the pile, or leave what hung from it in the air.
- **A blast that reaches part of something moving as one moves all of it.** Rubble that came to
  rest joined is thrown whole, as a rigid body would be by the throws of the pieces the blast
  reaches; what's in the blast's heart (half its radius) is torn off alone, and each part left is
  thrown by its own pieces' throws (the two ends of a row torn in the middle fly apart). A loose
  section the GPU push (`BlastPass`) reaches part of: the pieces out of the push's reach are raised
  to their share at once (as BlastPass raises those in reach: what's going that way already keeps
  its speed), where they are now, not through joints, which would tear first. Without a GPU (a
  world with no compute device) nothing loose is pushed, as before.
- **One breaking budget a frame for every blast and hit.** `frameBudget` (4 ms) is shared by every
  `explode()` and `hit()` from one `update()` to the next, including those fired before
  `update()` in the same frame (the demo's launcher): a world calling `explode()` 60 times in a
  frame no longer gets 60 × 4 ms. What's over is queued, nearest first, and broken over the next
  frames, as a big blast's is. When blasts are all broken, one pass over the structure brings down
  what they undermined (for all of them at once), in a frame with the time it took last, or one
  with nothing else to break. `explode()` may now return with nothing broken yet (`done: false`;
  the result fills in). `frameBudget = 0` breaks nothing at once.
- **A strengthened bond's extra strength is for its load as built.** `reinforce()` notes the
  weight each bond carries (`Bond.builtLoad`). Asked to carry more, a bond's extra strength fades:
  all of it at `margin` (1.5) times its as-built load. So a bond strengthened many times over gives
  way well before `margin` times: at about 1 + (margin − 1)² / (2·margin − 1) times its as-built
  load, **1.125 at the default margin**; one strengthened a little gives way nearer margin times
  (twice: 1.2; 1.3 times: 1.3). Most strengthened bonds in the worlds are strengthened many times
  (Harbor Yard's median 31.7, Sun Temple's 90th percentile 83), so read `margin` as "how much
  headroom as built", not "how much more it takes". Damage that sends more weight down a path than
  it was built for overloads it, so what hangs on what's left comes down.
- **The weighing knows moments where it matters.** It follows where in plan each piece's weight
  (with what it carries) bears. A piece whose weight now bears further out past what it stands on
  than it did as built, by 0.12 m or 18% of its width, has tipped: what it's pressed onto carries
  none of it, and its side bonds carry it as levers (each less the further the weight is from its
  face). What it stands on: the faces it's pressed onto, of pieces that carry it, however many bonds
  each is from the ground; a piece hanging from it (one that reaches the ground only through it)
  doesn't. Pressed onto none, the faces of its bonds to pieces that carry it. As built, anything goes
  (jetties, cornices, eaves: what was built was built to stand); a blast's new cells don't tip. A
  span that lost one of its columns, or whose column now hangs from it, a joist whose front post
  went, now gives way instead of standing as a shelf.
- **A section let go turns over the edge it rests on.** With its centre of mass out past what it
  still rests on, it starts turning over that edge as if it had tipped 0.05 rad already. A slender
  section (taller than twice its base's reach that way) whose centre of mass is out of the middle
  third of what it stands on goes over that edge, just fast enough to get its weight over it.
- Costs: the weighing (every piece, after each change) takes a median 1.9-3.1 ms in the six worlds
  (1.0-1.5 without the tipping check): Brick Street 2.5, Market Town 2.8, Dust Town 3.1, Neon
  Alley 2.8, Harbor Yard 2.3, Sun Temple 1.9. The pass that brings down what's undermined takes
  about 0.8 ms (whether a standing piece is on the ground is now found once a piece). The resting
  checks run after readbacks, at most ~2 ms each (0.8-1.4 ms on average while Brick Street's
  three-blast pile settles).

## New options, calls and events

- `DestructionOptions.killBelow` (default: 50 m under `ground`, or -50 with no ground): loose
  pieces below it are taken out of the world. It's a field too, so a world can set it in `build()`:
  `d.killBelow = SEA - 10`.
- `reweigh()`: weigh the structure again at the next update, after changing it from outside
  (`bond.strength = 0`, a bond cut). Replaces the zero-radius `explode()` far away.
  `for (const b of p.bonds) b.strength = 0.1; d.reweigh();`
- `unbond(bond)` is public: cuts the bond (and its joint); between standing pieces, it weighs again.
  Between two rubble pieces it only cuts (neither wakes: `push()` one if it should).
  `for (const b of [...post.bonds]) if (b.other(post) === under) d.unbond(b);`
- `loosen(piece, velocity?, spin?)`: let one standing piece go whole, moving at `velocity` (m/s),
  turning at `spin` (rad/s), cut from what it was bonded to (weighed again); rubble is cut from
  what it rests joined to, which wakes. Static pieces never go. `d.loosen(panel, [0, 0, -2])`
- `release(pieces, velocity?, spin?)`: let standing pieces go together as one section (their
  bonds to each other become joints, to the rest cut; a `collapse` event), moving at `velocity`,
  turning at `spin` about its centre of mass. `d.release(box.pieces, [0, 0, -1.5], [2, 0, 0])`
- `push(piece, velocity)`: add `velocity` to a piece free to move, shared with what it's joined to
  as a rigid body would share it: a loose piece (impulses on it and the rest of its section), or
  rubble and props at rest (woken, with what they rest joined to). Standing pieces aren't pushed
  (`false`). `d.push(tumbleweed, [wind * 0.3, 0, 0])`
- `loosePieces`: the loose pieces, read only (a `ReadonlySet<Piece>`).
- `'state'` event, `{ piece, from, to }` (`StateEvent`): every change of state but a piece's
  making: let go or thrown whole (`fixed` to `loose`), come to rest (`loose` to `rubble`), woken
  (`rubble` to `loose`), gone (broken into cells, dust, cleared). Many in a blast: listen only if
  you need it. `d.on('state', (e) => e.from === 'fixed' && e.to === 'loose' && thrown.add(e.piece))`
- `Bond.builtLoad`: the weight it carried as built (`reinforce()`). `Piece.corners` and
  `Piece.radius`: its convex's corners where it is now, and its farthest corner from its centre.
- `ExplosionResult.collapsed` now holds what fell once all the blasts finished by then had been
  broken (several blasts finishing together share one list).

## What it replaces, world by world

Nothing has to change: the workarounds still work (they're what kept things moving before). They
can go, or get simpler:

- **Sun Temple** (`temple/index.ts`, `update`): the perched props' nudges (`explode` of radius 0.3
  at each prop whose stand went) aren't needed: a prop wakes when what it rests on goes.
  `temple/levers.ts` `update`: the zero-radius `explode` at (0, -500, 0) is `d.reweigh()`;
  `release()`'s remaking a piece as loose is `d.loosen(p)`. The weighing now tips a span whose
  weight has moved off its columns (whole, over the edge of what's left); `Levers` still cuts it at
  that edge (`shear`), which the library doesn't. `layout.ts`: the sea can go back down, with
  `d.killBelow` set below it in `build()`.
- **Harbor Yard** (`harbor/index.ts`, `update`): the zero-radius `explode` after `tipStacks` and
  `unstall` is `d.reweigh()`; `unstall()` isn't needed (nothing freezes with its centre of mass out
  over the water). `containers.ts`: `tipStacks` setting `bond.strength = 0` can `d.unbond()`
  (weighed at once), and the section let go turns over the edge it's out past by itself
  (`nudge` can stay for its push out); `buckle()`'s tiny blasts are `d.loosen(piece, velocity)`
  (they worked only for pieces under 1.5 × `minSize`). A box shoved off the quay whole:
  `d.release(box.pieces, velocity)` in `onBlast`; boxes that came to rest are thrown whole already.
  The weighing doesn't buckle a box under a lost corner: `tipStacks` keeps that rule.
- **Dust Town** (`western/life.ts`, `updateWalls`): the 1 cm hits that wake the stepped front's
  frozen boards aren't needed (they wake when what they rest on goes); `snapTies`' hits on a
  wall's ties can be `d.unbond(b)`; `tip()` can be `d.release(members, velocity, spin)`. The scans
  for pieces thrown whole (`scans`, `track`) can listen to `'state'` (`fixed` to `loose`).
- **Market Town** (`medieval/falls.ts`): `releaseFronts`' 2 cm blasts are `d.release(front)` or
  `d.loosen(p)`; a jettied front whose ground floor went now tips off its joists by itself where
  the joists' weight has moved off the posts. Keep `leanFalls` for the towers: an undermined tower
  turns over the side it lost only when what's left under it no longer reaches across its base;
  one left standing on the rest of its base stays (see Measured, and Limits).
- **Neon Alley** (`neon/life.ts`, `giveWay`): its cracks no longer stall a frame (they share one
  budget, and one pass at the end). The tower comes down further by itself (below), but a gutted
  shell whose back and side walls reach the ground still stands: that is what the weighing says of
  it. To keep the design's "four or more bring the whole tower down", the cracking can be
  `for (const p of rest) for (const b of p.bonds) b.strength = 1; d.reweigh();`.

## Measured (on display :101, the GPU shared with other agents' Chromes)

- **Every world stands**: 0 loose, no collapse, no wakes, in the 10 s after loading, in all six.
- **Brick Street, one blast at a ground-floor front** (`demo.blast(2, 1.2, 10.3)`): 39 pieces
  (4.2 m³) let go, as with the tipping check off. Before the fix to what a piece stands on, 313
  were (the check compared a piece's side faces with an overhang measured on the faces it was
  pressed onto). A second blast higher up (2, 8.5, 10.3): the largest group of rubble at rest
  joined is 26 pieces, and nothing at rest is thrown whole but single pieces.
- **Brick Street, three blasts at a ground-floor front** (x -1, 2, 5; y 1.2; z 10.3): the facade
  above falls into the street; the slabs, carried by the side and back walls, stand. Loose: about
  1,000 at 5 s, 430-660 at 10 s, 6-14 at 20 s, 0-3 at 30 s (three runs); 220-700 wakes in all.
  No bond between rubble pieces is cut by clearing (340 were), and no rubble off the ground is
  linked to nothing. Idle frames 18 ms.
- **Dust Town, one blast at the saloon's porch** (-19, 1.5, 9.3): 400-418 pieces let go, against
  116 with the tipping check off: the balcony over the blasted porch posts comes down (with the
  check off it stays whole, a shelf over nothing). **Four blasts at the saloon front** (x -22,
  -19, -16, -13.5; y 1.5; z 9.3): the front falls into the street; loose 53-93 at 12 s (the
  earlier 33-36 didn't hold up), 21-39 at 16 s, 8-10 at 20 s; of the rubble more than 1 m up, all
  but 0-1 pieces are over what holds them.
- **Sun Temple, one blast at a flank column** (`demo.blast(-4, 1.6, 2.1, undefined, [0, 0, 1])`):
  the entablature over the gap comes down into a pile with the column's pieces, and the cella
  roof's tiles and timbers drop onto its trusses. 13-14 s after it, 15-21 loose; rubble 1 m or more
  above what's under its centre: 76-79, of which 66-67 are over what holds them (roof beams and
  the peristyle's ceiling beams lying across walls; two cornice blocks wedged as a flat V across
  the top of the gap, see Limits) and 9-13 aren't (settled wedged among rubble on the roof's
  trusses: each wakes when what it's wedged against goes). None touch nothing; none are linked to
  nothing. A second flank blast (-8.3): the next span comes down too; 2 loose 14 s later.
- **Neon Alley, N3 (8 floors) with three blasts across its ground-floor front, `giveWay` off**:
  fixed volume left above 2 m, of 364 m³: 178 (the front bays and what hangs off them come
  down). With `giveWay` on: 45, the tower across the alley; 34 `explode()` calls, at most 5.8 ms
  of breaking in any frame.
- **Breaking per frame**, three radius-4 blasts in Brick Street a frame apart: at most 7.2-7.9 ms
  (frameBudget 4; 9.5 before). What's over is a big piece's cutting begun just before the budget
  ran out, or the pass at the end of the blasts (1-10 ms there while the pile moves, the CPU
  shared), which now runs alone in a frame.
- **Market Town, the church tower undermined on its west face** (three blasts at x 14.7, z -4.2
  to 0.2), `falls.ts`'s lean off: the outcome depends on what the blasts leave. In one run the
  tower (603 pieces) came loose turning west over its west foot and fell across the square; in
  another (the reviewer's) it fell west, though not by the slender rule; in the last, it (600
  pieces) came loose 1.9 s after the blasts and settled where it stood, on the west wall still
  standing above the hole across its whole base. The round tower, between two lengths of town
  wall, sinks onto its stump and stays: the walls hold it on both sides.
- **Harbor Yard, a rocket at the foot of Block B's 4-high stack, `tipStacks` off**: the three
  boxes above drop onto the bottom box and stay on it (they rest on its top over their middle).
  The library doesn't buckle the box under; `tipStacks` keeps doing that.

## Limits

- **Rubble doesn't weigh on what it rests on.** A section let go that settles on what still stands
  (the church tower on the rest of its base, rubble heaped on a slab) adds nothing to the weighing,
  so what it rests on never gives way under it.
- **The tipping check sees each bond's face as a square of its area.** A long thin face (a board
  along a joist) can be judged tipped when the weight on it moves along the face; its side bonds
  then carry it as levers (Dust Town's false front: boards at 8.8 m tip after a blast at the porch,
  and their side bonds hold them).
- **Two pieces can hold each other up.** Wedged against each other between fixed ends (two cornice
  blocks in a flat V across a gap), each touches the other from below; if the solver holds them
  there, they freeze there.
- **Scenery is looked at once** (after `reinforce()`): fixed bodies a world adds later hold
  nothing up until the next `reinforce()`; what rests only on them settles after 2.5 s, linked to
  nothing.
- **The resting checks take at most 2 ms a readback**, lowest first: after a big collapse (Dust
  Town's four rockets, 1,500 loose) pieces at rest wait their turn for some seconds.
