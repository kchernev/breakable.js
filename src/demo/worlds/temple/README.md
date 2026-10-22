# Sun Temple

A Doric sanctuary on a limestone promontory above the Mediterranean at midday. A peripteral
marble temple (6 × 11 columns) faces east over its altar, where an offering still smoulders; a
treasury stands north of it, a domed tholos to the south-west, the ruin of a stoa along the north
cliff, a gate (propylon) on the east. Cypresses and olives, dry grass and pale rock, cliffs down to
the sea 62 m below, islands in the haze, dry hills inland and mountains behind them. The court before
the temple is paved with marble flags and the hilltop round it is earth over rock, both breakable:
a rocket craters them, the gun chips them. The rest of the plateau is laid the same where a blast
reaches it, and the olive scrub, the loose rocks and the two boats are built as pieces once a round
or a blast reaches them (see "Round the sanctuary"). What doesn't break: the land off the plateau
(its slopes, the cliffs, the hills and mountains inland), the sea and the islands. The place
answers the gun as it answers a rocket: the cicadas fall silent, jackdaws go up off the roofs, the
bay throws the burst back, the bronze goddess rings when she's shot and a shot olive sheds its
leaves. About 5,750 pieces (276 of them anchors, 422 the ground's slabs), 19 materials, 13 props.
`?world=temple`. It loads in 6.5..8.2 s here (Brick Street 5.3..6.3 at the same time, the GPU
shared).

The plan it follows is `DESIGN.md` (same folder); where this differs, it says so below.

## Files

| File | What |
|---|---|
| `index.ts` | The definition: sky, look, audio, and the reactions to blasts and the gun (`onBlast`, `onShot`, `onBurst`: cicadas, birds, the bay's echo, the goddess ringing, leaves shed, the tufts a blast flattens) and to what falls (marble dust where stone lands, bronze ringing, bursting leaves, splashes), the altar's smoke, the sea (`water`), `groundAt` (the bed where the plateau has been laid too), and the scenery made dormant (`dormantScenery`). |
| `meta.ts` | The card (order 5). |
| `layout.ts` | Where things are: the height function of the land (plateau, cliffs, slopes, hills, mountains), the coastlines, the sea level, the places of the buildings, the breakable ground's areas and layers. |
| `kit.ts` | The builders' kit: boxes by corners, hulls of points (`static` or `anchor` if asked), per-material tints, drums and columns (their texture frames on their axes, shaded round), prisms cut in a vertical plane, drums lying on a facet. |
| `doric.ts` | Entablature bands round a rectangle of column axes, the triglyph frieze, coursed walls in running bond, platforms (their slabs anchors unless `anchor: false`). |
| `roof.ts` | A gabled roof (ridge along x): plates, tie beams and king posts, rafters, tile panels, ridge caps, antefixes, sima, pediments with raking cornice and acroterion; with `falls`, its frame falls with what held it (the treasury's and the propylon's). |
| `temple.ts`, `buildings.ts` (treasury, propylon), `stoa.ts`, `tholos.ts`, `small.ts` (altar and its offering, ramp, statue base and exedra, votive column, stelai, pedestals, temenos wall, fragments), `trees.ts` | The structures. |
| `ground.ts` | The breakable ground: its slabs, the bed's bodies under its areas (`plateau()`; the rest of the plateau, `PLATEAU`, is tiles in `scenery.ts`), and what a crater shows past the slabs (the bed, under the whole plateau, and the cut where the ground ends; `pitMaterial()`, the tiles' pits' too). |
| `land.ts` | The land's look (grass, thyme and bare rock, cliff rock, the terra rossa and bedrock under the grass), shared by the land mesh, the ground's earth and rock, and the cut. |
| `levers.ts` | Spans cut at their supports when they're let go or have lost them, and stone come to rest hanging (see below); an anchor counts as the ground. |
| `props.ts` | The statue, lions, tripods and amphorae. |
| `scenery.ts` | The land mesh (with a hole where the breakable ground is, and where the plateau's tiles have been laid), the plateau's tiles (`DormantGround`), the sea, the islands, the scrub, the loose rocks and the boats (each a dormant thing: `dormantScenery`), the tufts at wall feet (`flatten`), and the physics of the land, with the slopes' hulls under what wakes past it (`slopeUnder`). |
| `flock.ts` | The jackdaws that burst off a roof, the gulls off the cliffs, and the olive leaves a bullet knocks off a tree, fluttering down. |
| `materials.ts` | The materials, and their TSL surfaces (drafted block edges, grooved triglyphs, fluted drums, weathered bronze, smouldering embers, the court's flags, the earth and the rock, the woken scrub). |

## How it's built

- **Columns** are stacked drums: 20-sided frusta, each drum's top polygon the next one's bottom
  (so they bond), an echinus (a hull of three rings with a rounded profile) and an abacus. Each
  column's polygon is turned at random so the facets don't line up. Drums and echinus are their
  own material (`drum`), shaded round (`smooth: 0.5`: the facets, 18° apart, read as one curved
  surface; rims and breaks stay sharp) and fluted: twenty flutes, darker in the channels and
  bright on the arrises, drawn from where a point is round the drum's axis (`pieceFrame()`). Every
  drum of a column has its texture frame on the axis, its x toward the polygon's first corner, so
  the flutes run on from drum to drum, and a broken drum's cells keep them. The flutes are colour,
  not relief (see the requests). Every column has 20 sides, the naos's, the tholos's and the
  votive column's too.
- **Entablatures** (`doric.ts`) are bands round the rectangle of column axes: the long sides run
  over the corners, the short sides fit between them, so neighbours share faces exactly. The
  architrave is two beams side by side joined over the columns; the frieze is triglyphs (their
  own material, `triglyph`: two grooves and two half grooves shaded on their faces, tinted a faded
  blue-grey) and recessed metopes in front of backers; the geison overhangs.
- **Walls** are limestone in running bond with marble crowns and anta capitals. Blocks are
  built 1.2 mm narrower than their place (`GAP` in `kit.ts`): neighbours still bond (the library
  bonds faces up to 2 mm apart), a block that falls doesn't rub its neighbours and stick, and the
  joints show as hairlines. So the courses read from afar, each block is tinted ±9% in value and
  warmer or cooler (`Kit.tint`), shows its own patch of the map (`uvJitter: 1` on the stone, the
  timber and the trees), and the surface darkens a band about 2 cm wide round each face (`drafted`
  in `materials.ts`, 1.2 cm on the marble). That band is measured in the piece's own frame
  (`pieceFrame()`), which a broken block's cells keep: a cell shows the margin where it has its
  block's face, and none on its breaks.
- **Roofs** (`roof.ts`): rafters are cut with vertical joints (prisms) so their segments bond face
  to face; tile panels (1.1 × 0.733, two tiles wide and one course long) lie on the rafter-top
  plane, every panel of a slope sharing one texture frame so the tiles run on across the joints
  (the tile map is laid on a square 2.2 m grid, so one `uvScale` fits it). A marble sima course
  outside the wall plates carries the eave row; upright palmette antefixes stand at the eave
  tiles' joints, tied to the tiles by hand (they touch them only along an edge). Pediments: a
  tympanum in courses, raking cornice blocks whose tops are in the rafter plane (the end tiles rest
  on them), and at each apex an acroterion: a base in two halves on the two slopes and a fan of 5
  or 7 thin petals, each its own convex piece clear of the others, tied to the base by hand (1.0 m
  on the temple, 0.65 m on the treasury and the propylon). The tiles take their map's occlusion
  (`textured(..., { ao: 1 })`): the gaps beside the cover tiles darken.
- **Doors**: bronze leaves with raised frames (stiles and rails, `leafPanels` in `kit.ts`)
  making 2 × 4 panels. The bronze is dark polished metal (metalness 0.9, roughness 0.33) with the
  environment in it; verdigris only in streaks hanging from the top of each plate and frame and in
  a patchy band low down, where the rain runs and splashes.
- **Porch ceilings**: the treasury's porch and the propylon's two have beams from a ledge on the
  cross wall (raised by a course to the architrave's top) to a ledge on the architrave (the
  frieze's backers are thinner there), and lids across them, as the temple's walk has.
- **The tholos**: round courses of arc blocks whose outer faces step every 11.25°, so courses
  turned half a block against each other meet the same facets. The dome's rings of 16, 16 and 8
  shell pieces and the cap bond to each other and to the drum by themselves (16 + 16 + 8 round, 16
  and 16 between rings, 8 under the cap); each piece of the ring of 8 has a corner at the middle
  of its foot, so it follows the ring of 16 under it instead of leaving a crescent of sky under
  each chord. Only the finial, standing on the cap's apex (a point), is bonded by hand.
- **The altar** carries an offering still smouldering: a bed of embers and two layers of charred
  logs (`embers`, five pieces), dark with glowing cracks that breathe slowly. The material glows
  only while a piece lies there (`glow: 'standing'`), never on its breaks: knocked off, they go
  out. While any of it lies on the altar a thin smoke rises and drifts toward the sea
  (`effects.puff`, every 0.3..0.5 s).
- **The temenos wall**: three courses and a coping, old: here and there, over one to four
  blocks, the coping is gone, and in about half of those places a block or two of the course
  under it (in from the ends, so the gap steps); stretches between are 2..7 blocks whole. Some of
  the fallen slabs and blocks lie beside the wall, turned a little.
- **Olives**: a trunk in three lengths, leaning and twisting, with a flared foot; a limb from the
  trunk's head toward each of two or three canopies, forking under it into a branch and a twig;
  and the crown, 5..6 m across: the canopies, broad flattened domes (2.6..3.5 m wide, half to six
  tenths as high, 42 points in rings with the same lumps all the way up), their undersides flat at
  2.3..3 m. The branch's and the twig's ends are flat on that underside, so they press on it (auto
  bonds, nothing floating; an end is pulled in toward the middle until it is wholly under the
  canopy). Neighbouring canopies are cut apart along the plane halfway between them (8 cm gap),
  and each is split with `voronoi` into two layers of cells (4..6), which share faces, so they
  bond to each other without hand bonds and a blast strips them one by one; the lower cells are
  darker, the upper silvery.
  **Cypresses**: a trunk and nine 18-sided frusta of a slim flame profile; each ring off the one
  below by a few cm in a wandering direction (the crown bends), its size wandering between 80% and
  120%, each point by ±5%, two or three gentle side flames on the lower half, dark green (0x2f4a26
  at the foot to 0x3e5a32 on top). Their leaves are their own material (`cypress`, the foliage at
  a smaller scale).
- **Anchors** (they were static): the temple's steps and stylobate, the treasury's and the stoa's
  platforms, the tholos's steps and top, and the ramp, 276 pieces. `platform()` in `doric.ts` makes
  its slabs anchors unless told not to (the altar's and the statue base's aren't), and the kit
  passes `anchor` on (`PieceOpts`). An anchor holds up what stands on it as the ground does, over
  the hollow its ring of slabs hides, needing nothing under it (the library's `PieceOptions.anchor`),
  but breaks as any piece: a blast or rounds break them, and what they break into stands or falls
  as pieces do. They stand on the plateau itself, never on the breakable ground, and the plateau's
  tiles under them never wake (see "Round the sanctuary"). `levers.ts` counts an anchor as the
  ground.

### Spans that shear (`levers.ts`)

The library weighs moments (a span whose weight has moved off what holds it tips), lets go of
what has lost its way to the ground, each connected section whole, gives way at a section's joints
bent more than 4° at rest, and drops a piece propped on its neighbour over a gap through it. Four
things it leaves to this world; each was switched off in turn (what came of it is with each), and
each is needed still.

**A section let go still resting on what stands** (a beam on the next column's abacus) turns
down about that edge into its neighbour over the gap, and the two jam there in the air. So when the
library lets a section go (its `collapse` event, in the same frame, before anything has moved),
each watched span in it (beams, lintels, ceiling slabs and lids, frieze and cornice blocks, raking
cornice and tympanum blocks, the roof's wall plates and the ends of its tie beams: `k.levers.add`)
that rests on something still standing is cut at the far edge of what's under it (found by rays
down from the corners of its foot), square to the span; and so, with the same plane, is everything
in the section standing on it, up through the frieze, the cornice, the plates and the tiles. The
part over the support is made again standing (with its look: `Piece.textureFrame`) and bonds to
what it touches; the part beyond, 3 mm clear of it, is made loose and drops straight down with the
rest of the section. Then the structure is weighed again (`d.reweigh()`). What's under a span
counts only if it stands on the ground, down through what it rests on: the top of a column blown
out at its foot stands, hung from the beams on it, until the library next weighs it, and nothing
is cut to rest on it. The cuts are made lowest first, as many as 3 ms a frame allows: in a frame
that lets many sections go, the rest are made in the next frames where their pieces were when let
go (a few millimetres above where they've fallen to), each on what's been made again under it.
With this off, one flank blast left a bridge or a block hanging over the gap in 2 loads of 4, and
four flank blasts 33..40 stone pieces at rest above 3 m (18..24 with it, two loads each).

**Spans the roof's frame holds up.** Timber carries 600 a m² across its joints, so a wall plate
whose cornice went hangs from the rafters on it, and a frieze or cornice block over a lost column
hangs from the plate. So a watched span is looked at again when what it rests on or abuts goes
(let go, broken or cut) or a bond of it gives way: one with nothing standing under it (no bond onto
anything standing, nothing under its foot), or one with its centre out past what's left under it
and something there to cut away, having rested square on it as built (a plate or a frieze backer
on a sheared stub) or reached out to a neighbour that has gone that way (a tie beam's end whose
middle fell), is let go with what stands on it reaching past where it'll be cut, as the library
lets a section go, and cut the same way. The small roofs (the treasury's and the propylon's:
`falls` in `gableRoof`) watch their rafters and their tie beams' middles too, which hang between
their neighbours as built: one goes once a neighbour has, with nothing under it, so a rafter whose
foot went drops whole instead of hanging from the ridge. The temple's rafters hang from the ridge
side over a gap of one to three columns (they hold its tiles up). With this off, the cornice and
the roof's edge (plates, sima, eave tiles) hung over the gap after one flank blast in 4 loads of 4,
and a cornice block in the middle of the gap after four in 2 of 2.

**Stone that comes to rest hanging, or creeps there.** A blast at a column's foot usually cracks a
drum of the columns either side too (in 17 of 20 loads, one or both): they sit down a few
centimetres onto what's left of it and come to rest standing, as rubble. What's over the gap comes
down onto them, and the library lets it rest: as one section on both (it sags a degree or two, less
than the 4° it gives way at), as the two arms of a V each on the edge of a stack on those columns,
or as a block tipped off a column's top, leaning on its neighbours or wedged against the stub of
what stands. And before it comes to rest it creeps there for a long while: with the rocket's radius
both columns either side are cracked already when the section over the gap is let go, so nothing
under its beams stands on the ground and nothing is cut; it lies on the two columns as they sit
down, and the library waits until what a piece creeps on has stopped (6 s or more). So stone higher
than 3 m is looked at (1 ms a frame) once it has come to rest, or once it has moved less than 15 cm
in half a second (`CREEP`, `SLOW`), what's under it found among the loose pieces near it (those
slower than 1 m/s) as well as what stands: one whose centre isn't at least 5 cm inside where what's
under it holds it up (standing pieces, and pieces whose centre is lower: not the other arm of a V),
and that is propped on a neighbour no lower than itself or has nothing within 1 m under its centre
but what it's balanced on the edge of, is made again as its part over what holds it and the rest,
both loose, so the rest falls, and so is the loose stone stacked on it up to 2.5 m over it (the
frieze and the cornice on a beam, `ENTABLATURE`); with nothing past that to cut away, or nothing
found under it at all, it's knocked loose (pushed, if it's still creeping), on out past what it
rests on or away from what stands beside it (once: wedged again where it was, it stays). The parts
are made in the next frames, in the time the let-go cuts have (`BUDGET`). After one rocket at a
flank column the stone over the gap is down 3..7 s after the blast in 9 loads of 12 (measured
below); with only the stone the library had frozen looked at, the independent check found 11..17
pieces over the gap until 3.75..8.25 s (4 loads), 3..5 of them until about 12 s in 2. This replaces
Phase C's `settle()`, which looked only at the spans it watched, from the corners of a block's foot,
and knocked one with nothing found under it straight down: with it, a bridge, a V or a block hanging
off a column's top stayed over the gap in 3 loads of 6; with neither, 6 of 8.

**What's left on a column alone.** What the cuts leave over a column's abacus ends square at the
abacus's edges. Where the entablature goes on past the column, that's its broken end; but on a
column left between two gaps it was a stack of stubs 2..2.5 m high cut to the abacus's width, a
geison block overhanging and a tile on top (the independent check, at radius 2.3: on a column that
had sat down, in 4 loads of 8 of four flank blasts). So each part remembers where it was cut, and
one that comes to rest (or creeps) over a column that has sat down, or over one that stands alone,
with nothing standing on past the column at its height (looked for from just past the abacus's
other edge: `ABACUS`, `BESIDE`), is pushed off the way its part that fell went: 2.5 m/s, and
tipping that way if it was at rest (`SHOVE`, `SPIN`). One kept there by what stands on past it is
looked at again when something within 2.5 m of it goes (`PERCHED`). A span let go on the top of a
column that carries nothing else but parts stood again here isn't cut there: it goes whole, tipping
off the column, and what's on the column's top is let go, those parts pushed off their way. A part
pushed off as it was made rammed the part falling beside it and held the bridge over the gap up
1..2 s longer (3 loads each way: the bulk down by 4.25..5.25 s against 2.25..3.25), so it's pushed
only when it's looked at again, once the rest has gone. A column left standing alone (two blasts at
radius 2.0 either side of the one at -1.8, 2 loads) still keeps its architrave stubs and a frieze
block, to 7.6 m, where it kept them all with the roof's timbers over them: the stone of the gaps
either side, still leaning on the stubs as they're pushed, holds them.

What it costs: the old version looked over every watched span within 3 m of anything let go or
broken (1..2 ms a call, 8..13 ms in all through one flank blast's collapse) and made every cut in
the frame its section was let go, so the world's `update()` reached 5..8 ms in the worst frame of
one flank blast and 7..11 ms in four (measured in Phase D's first round: then 4..6 and 4..5). A span
is looked at now only when what it rests on or abuts changes (2..6 ms in all through one flank
blast, at most 1 ms a frame), and the cuts wait their turn (each is a `removePiece` and two
`addConvex`, about 0.3 ms, most of it the library's hull): only the frame's first is made whatever
the time, and the parts cut where stone has come to rest are made in that time too, not in the
looks' 1 ms. The worst frame of any blast now is 3.5..5.9 ms (36 loads; 0.1..0.2 idle): the 3 ms
and the 1 ms, and what isn't split (the cuts planned for the sections let go in a frame, and the
step begun before its time ran out). The independent check's 7.3 ms in one load didn't recur. In a
CPU profile of four flank blasts, `Levers.update` took 48 ms in all, against 80.

### How it breaks

- **A column** (a rocket at its foot takes 2..4 drums; the columns either side usually lose a
  drum's worth to it too and sit down a few centimetres onto what's left, standing, or come down):
  the drums above and the capital drop, rolling where they land (`drum` breaks in 3 at most). The
  entablature over the gap comes down, sheared at the abacus edges of the columns that stand, or of
  those sitting down once it has slowed on them: mostly within 3..7 s of the blast, a block or two
  sliding off a column's top last. A column that sat down keeps a stack of what was on it beside the
  entablature going on past it, now and then a block askew. With it the wall plates, the sima and
  the eave tiles over the gap come down. With the rocket's radius that's all of the roof that goes
  (7 loads of 7 looked at from above, 3 of them the check's): the rafters there stay, hanging from
  the ridge side and carrying the rest of the tiles. A smaller blast (radius 2.3) leaves the
  columns either side standing, and then a strip of the south slope one or two panels wide usually
  opens from the eave to the ridge (the independent check: 5 loads of 7), a few panels left lodged
  steeply between the rafters still hanging: a rafter whose foot went is let go there, and the
  panels on it with it. A white cloud of marble dust hangs for a few seconds.
- **The flank** (four rockets along it): no column stands from -8.4 to 4.8, and those that sat
  down there end at their abacus (in 1 load of 8, one with an architrave stub and a frieze block on
  it), and the roof over the gap comes down, both slopes: its trusses lose their south ends. What's
  left of them lies across the cella's walls and the naos's inner colonnades, the tiles on them. The
  corner column at 7, 2.2 m from the last blast, is cracked by it: it stands with its corner in a
  third of the loads, sits down under its corner of the entablature in a third, and comes down in a
  third.
- **The corner column** brings down the corner of the entablature and of the pediment, the
  raking cornice and the end tiles, and the south slope's eaves over the last bay or two (in 1 load
  of 6, that bay's roof down to its truss); the rest of the roof stands (but see the known issues).
- **Walls** lose blocks in running bond; a hole wider than two blocks lets the courses over it come
  down (cut at the hole's edges when they're let go together), the crown and the attic with them.
- **The treasury and the propylon**: a porch column brings down that corner of the porch, and the
  roof's frame over it falls with what held it (rafters and tie beams whole; the tiles off it).
- **The tholos**: its ring entablature over a lost column comes down as the temple's does; the
  dome stands on its drum until the drum goes.
- **Trees**: a hit in an olive's crown strips the canopies and limbs and the trunk stands; leaves
  that fall whole burst where they land. A cypress hit at its foot falls whole.
- **What goes over the cliff** tumbles down the rock and splashes into the sea.

### Materials

| Name | From | Notes |
|---|---|---|
| `marble` | concrete preset | support 8 (dry-laid: nearly nothing hangs), compression 300, strength 50 (a falling section holds together in the air and comes apart as soon as it rests on anything, instead of hanging off a corner), minSize 0.32, fragmentSize 0.6 and maxPieces 11 (blocks land as blocks, and a big collapse stays near budget), minBodySize 0.16 (smaller thrown bits are particles), rubbleLife 12, uvJitter 1, surface `temple_marble` (roughness 0.85, normals × 1.15) with drafted edges. |
| `drum` | marble | Column drums and echinus: maxPieces 3 (drums land as drums), the marble at uvScale 0.6, specks pulled halfway to the map's mean, normals × 0.8, twenty flutes. |
| `triglyph` | marble | The frieze's triglyphs: the marble's surface with grooves shaded on their upright faces. |
| `ruin` | marble | support 5, weaker; ochre surface colour. The stoa. |
| `limestone` | brick preset | support 12 (a hole wider than two blocks lets the courses over it come down), strength 50, maxPieces 4 and minBodySize 0.18 (a wall comes down in blocks and halves), uvJitter 1, surface `temple_limestone` at uvScale 0.4 (pores and shells at 2..3 cm) with drafted edges. |
| `terracotta` | material() | shatters, reach 1.4, support 18 (a tile barely hangs off one neighbour), strength 25, maxPieces 6, dustSize 0.15 and rubbleLife 5 (a third of a panel counts as small rubble and is cleared), `landing: 4` (a panel, 0.12, breaks where it lands at 4 m/s or more, however light). The map's occlusion at 1. Also the amphorae's sounds. |
| `timber` | wood preset | support 600 (pegged and lapped, a frame carries far more across its joints than dry stone: see the known issues), Poly Haven `rough_wood`, roughness × 1.5, uvJitter 1. |
| `bronze` | metal preset | A TSL surface: dark metal vec3(0.2, 0.12, 0.05), metalness 0.9, roughness 0.33; verdigris vec3(0.17, 0.27, 0.22) only in streaks hanging from the top of each piece (noise along the map's v, smoothstep 0.55..0.8) and in a patchy band below 1.75 m; raised edges a little brighter. Shields, door leaves and their frames, and the bronze props' sounds. |
| `foliage` | material() | `temple_foliage`, tinted per cell, uvJitter 1. minBodySize 1.0 (what a blast reaches flies as leaves, not as chunks), minSize 0.6, maxPieces 3, rubbleLife 2.5, impact 1; `dustAmount` 0.12 (little dust where a crown comes down). |
| `cypress` | foliage | The same leaves at uvScale 1.5 (smaller, so a cypress doesn't read as grass at 5 m). |
| `bark` | wood preset | Poly Haven `bark_willow_02`, uvJitter 1; strength 6e4, impact 60, reach 0.55 (a blast reaches it less far: a hit in an olive's crown strips the canopies and limbs, and the trunk stands). |
| `embers` | material() | The altar's offering: charcoal with glowing cracks (emissive by noise, breathing with time), `glow: 'standing'`. |
| `paving` | groundPresets.paving | The court's flags: reach 0.45 (a blast lifts them a little further round it than the preset's), minBodySize 0.25 (what a blast breaks smaller goes as chips, not as plates that land back in the hole on edge), the flags painted in its top (`flags()`), uvScale 0.83, breaks `temple_marble_broken`. |
| `fill` | groundPresets.fill | The rubble under them: `temple_fill`, inside and out. maxPieces 16, minBodySize 0.75 and `keepSmall` (Phase F): what a blast or a bullet reaches goes as a spray of grit, not as lumps that fall back into the hole and plug it; what's beyond its reach stands however small, so a crater's sides hold. |
| `earth` | groundPresets.earth | The hilltop's earth: its top the land's look (`landLook`), its sides and breaks `temple_earth` (dry crumbs and clods); reach 0.45, maxPieces 20, minBodySize 0.6 and `keepSmall` (what a blast reaches flies as a spray of soil, a clod or two at most, and the rest of the slab stands whole round the hole: no wedges at the rim), `landing: 2` (clods crumble where they land). |
| `rock` | groundPresets.paving | The bedrock under the earth: impact 80, reach 0.25 (a blast barely reaches it: craters stop on it), 10 cells a slab, density 2.5; bedrock on top, cliff rock in its sides, breaks `temple_marble_broken` tinted 0xd8ccb8. |
| `scrub` | foliage | The slopes' olive scrub, woken: the olives' leaves drawn as the scrub is (`scrubLook()`: each bush's green its tint, darker underneath, mottled), uvJitter 0. |
| `boulder` | concrete preset | The loose rocks, woken: the cliffs' `marble_rock_02`, density 2.6, maxPieces 6, broken `temple_marble_broken`. |
| `sail` | material() | A boat's sail, woken: light cloth (density 0.15, impact 2, maxPieces 4), torn by what reaches it. |

The marble's and limestone's supports and strengths are much lower than DESIGN.md's (45/40,
9e3/1.2e4): with those, corners hung off their neighbours after a column went, and falling sections
stuck in place as rigid cantilevers.

## The breakable ground (Phase E, tuned in Phase F)

- **Where** (`COURT`, `FIELDS` in `layout.ts`): the court before the temple, from the foot of its
  steps (round the ramp) to the gate, x 8.7..31.4, z -11.2..5.1, in three areas; and the hilltop
  where the player walks, in four: south of the temple to the temenos wall (x -14..31.4, z
  3.8..23.1, in two), the strip north of the temple (x -16..8.7, z -16.5..-11.8) and between the
  court and the stoa (x 8.7..33.1, z -19.6..-11.2). What mustn't sink stands on the plateau itself:
  the temple's steps and stylobate, the ramp, the treasury's and the stoa's platforms, the tholos,
  the propylon and the temenos wall; a strip of the land's own, 0.6 m wide, is left at the foot of
  the temple's steps and along the wall, where the tufts grow. What stands on the ground bonds to
  its slabs and goes into a crater with them: the altar, the stelai, the statue's base and the
  exedra (and the statue on it), the votive column, the pedestals, the fallen drums and blocks, the
  trees; the props on it (lions, tripods, amphorae) wake and drop in. The cliffs and the far land
  stay fixed.
- **Layers** (`LAYERS`): in the court 0.3 m of marble flags (`paving`) over 0.7 m of rubble
  (`fill`), slabs of 2.2 m; in the fields 0.45 m of earth (`earth`) over 0.55 m of rock (`rock`),
  slabs of 3 m; all on the bed 1 m down, drawn as bare rock and struck as it (`bed: 'rock'`). 422
  slabs (150 of the court, 272 of the fields). The court throws its chunks harder than the fields
  (`toss` 0.55, the preset's 0.4), clear of the hole.
- **Its look**: every slab maps its textures from the world's origin (`textureFrame` at 0, 0, 0),
  so a surface reads where it was laid from its texture coordinates (a metre a unit; the flags at
  the marble's 0.83), the look runs on across slabs, areas and the land round them, and it stays on
  the chunks a blast throws.
  - The earth's top is the land's own look (`landLook` in `land.ts`, the land mesh's too: a hole is
    cut in the mesh over the areas, its lines along their edges), so a field can't be told from
    the land round it; its sides and breaks are the terra rossa under the grass (`temple_earth`:
    dry crumbs and small clods of soil, Phase F's take; the first, stony soil with pale pebbles,
    read as speckled red stone on a crater's faces and the clods), and a clod keeps its grass on
    top.
  - The rock: bare bedrock on its top (a crater's floor, as the land's rock patches), the cliffs'
    rock in its sides; broken, a pale fresh limestone.
  - The flags are painted in the court's top (`flags()` in `materials.ts`): courses 1.2 m wide along
    x (a joint either side of the temple's axis), flags 1.2..2 m long, each course's joints shifted
    from the next, each flag its own patch of the marble and its own shade, dust in broad patches,
    a dark hairline and a worn band in the joints, and a square of earth round the olive in the
    court. Their sides are plain marble, their breaks the marble's own. The rubble: `temple_fill`.
- **The bed and the cut** (`ground.ts`): the plateau's body under the areas is boxes, their top at
  the bed (`plateau()`, cut along the areas' edges); the rest of the plateau is the tiles' boxes,
  their top at the land's 0 (see "Round the sanctuary"). `pits()` draws what a crater shows past
  the slabs: the bed as bare rock (under the whole plateau, a little lower outside the areas), and
  where the ground ends against what isn't ground (the land, a step, a platform), the cut through
  the earth and the rock from the bed up. `groundAt` is the bed inside the areas and where a tile
  has been laid, the terrain elsewhere. A bullet strikes the cut as
  it's drawn, earth over rock (`pitSide` in `index.ts`: in the court too, not its flags and rubble;
  checked with the gun's trace at 0.1..0.9 m down and 8 rounds, `pitside.mjs`), and the floor as
  rock.
- **What went**: the paved way's limestone flags (static, 3 cm proud of the land) are gone: the
  court takes its place and the props stand at 0. Tufts aren't planted on the ground (they'd hang
  over a crater): the strip at the steps and the wall keeps them.
- **A rocket into it** (fired from 8 m; Phase F, `craters.mjs`): in a field, a crater 2.0..2.9 m²
  open and 0.45 m deep, walls of soil down to the rock, which a blast barely reaches (its `reach`
  0.25); the earth flies as a spray of soil (cells under 0.6 m are particles), a clod or two at
  most lying by the rim, crumbling where they land; it adds 15..53 pieces (7 craters). In the
  court, the flags round the hit are thrown clear and lie round it (half within 2.5..6 m, the
  farthest 5..11 m) and the rubble under them goes as grit: 2.4..3.6 m² open, 1.5..2.4 m² of it
  deeper than 0.3 m, down to the bed (1 m) in the middle; it adds 45..105 pieces (18 craters).
  Before (Phase E's settings, the same spots): 2 court craters of 6 kept chunks standing in the
  hole 0.3..0.5 m over the top, and with only the flags tuned, 1..3 of 6 a lump of the rubble's
  0.6 m cells, thrown up and fallen back; 2 field craters of 4 kept a clod standing in them
  0.3..0.5 m over the top, with thin wedges of earth on edge at the rim.
- **The player** walks down into a field's crater (to -0.45) and out the far side without a stop,
  and stands in the court's hole at 0.3..1.0 m down in each of the 18 (Phase E's settings: held at
  the top by a chunk in 2 of 6).
- **The gun** chips both: a fresh court slab gives way at round 13..21 (the spread puts the first
  rounds on two slabs), then a chunk most rounds; 70 rounds at one spot broke something with 46..52
  of them, 20 s held across the court 228 of 278. A fresh earth slab gives way at round 5, then the
  earth goes as a pit to the rock with soil walls, a trench where the view sweeps (29 of 70, 113 of
  280: rounds into the rock under it mostly mark it). Into a crater's bed a bullet strikes as rock,
  as it's drawn (`bed`; the court's struck as its rubble before Phase F). Since Phase F the
  library cuts what a bullet breaks in a ground as a bite (`docs/changelog/phase-f/pile.md`): 70 rounds at
  one spot leave a pothole through the flags with the rubble showing, or a pit to the rock with soil
  walls, the chunks out round it.
- **Footsteps**: stone on the flags and the rock, gravel on the earth, the rubble and the bed.

## Round the sanctuary

The rest of the plateau and what's on the land round it stand as scenery (drawn meshes and fixed
bodies, no pieces) until something reaches them, then are built as pieces (`Destruction.addDormant`;
made dormant in `build()`, once what stands on the plateau is built, by `dormantScenery` in
`scenery.ts`): a blast within 1.25 of its radius of its box, a round's ray entering its box, or a
rocket's flight through it (`wakeAlong`). None of it is among the pieces at load.

- **The plateau** (`PLATEAU`: x -34..40, z -30..30) outside the breakable ground's areas is a
  `DormantGround`: tiles about 6 m across, cut along the areas' edges (`cuts`), each a fixed box 4 m
  deep, its top at 0, until a blast reaches it (rounds strike it as the scenery it is). Then it's
  laid as the fields are, earth over rock on the bed 1 m down (`earth`, `rock`, 3 m slabs), the land
  mesh cut away over it, and `groundAt` gives its bed there (`plateauBed`). The tiles under what
  stands on the plateau (the platforms, the tholos, the gate, the wall, the trees: any standing
  piece with its foot at the plateau's top) stay as they are and never wake (`dormant(d, stay)`),
  so the structures never sink. A laid tile's sides against those still dormant are drawn as the
  cut, earth over rock (`pitMaterial()`).
- **The olive scrub** (1,400 bushes): no body, so a round or a rocket passing through a bush's box
  wakes it; woken, the hull of its points set on the land (`scrub`, drawn as the scrub is). A round
  into it sheds leaves as an olive's crown does.
- **The loose rocks** (260): woken, a boulder of the cliffs' marble rock set on the land
  (`boulder`).
- **The two boats** far out: woken, the hull (`timber`) afloat on a fixed body at the waterline,
  and its sail (`sail`) on it.
- **The tufts** aren't pieces: a blast flattens those within 1.2 times its radius (`flatten`).
- **The slopes** past the land's physics hulls get hulls (the land's 4 m cells) under what wakes
  there (`slopeUnder`), so a bush or a rock comes down onto the slope, not into it.

What doesn't break: the land off the plateau (its slopes, the cliffs, the hills and mountains
inland), the sea and the islands.

## The gun on the sanctuary (Phase E)

Every material says what a bullet sounds like on it (`bullet` in `audio.materials`):

| | Sound | Look (`materialKind`) |
|---|---|---|
| `marble`, `drum`, `triglyph`, the court's `paving` | `bullet.concrete` at 1.1 (hard stone, brighter) | stone: chips, a hole |
| `ruin` | `bullet.concrete` | stone |
| `limestone` | `bullet.brick` at 0.95: poros is soft, a dry crack and a burst of crumbs | brick |
| `rock` (under the earth, and the bed under both grounds) | `bullet.concrete` at 0.9 | stone |
| `terracotta` | `bullet.brick` at 1.2: fired clay cracks rather than tinkles | brick (the library's fix of 2026-10-17: its bullet sound says so, though it shatters): red-orange chips and a puff, no glitter. It breaks at the first round, so no hole |
| `timber` | `bullet.wood` | wood |
| `bark` | `bullet.wood` at 0.85 | wood |
| `bronze` | `bullet.metal` at 0.85: bronze rings lower than steel | metal: sparks, a dent |
| `foliage`, `cypress`, the woken `scrub` | `bullet.dirt` at 1.3: a soft rustle and thud through leaves | dirt |
| `embers` | `bullet.wood` (at the material's 1.3) | wood |
| `earth`, `fill` (at 1.1) | `bullet.dirt` | dirt: clods, a pock |
| `boulder` (a woken rock) | `bullet.concrete` | stone |
| `sail` | `bullet.dirt` at 1.4 | dirt |

The ground outside the areas is struck as dirt (its steps are gravel), until a blast lays it: then
as the fields' earth and rock; the sea takes bullets unseen
and unheard (`water`: where the terrain is under the sea's level). Chips and dust are the
materials' own colours (the ground's: white marble, pale rubble, brown clods, pale rock).

Rounds (power 6) to break a median piece: marble and drums 4, limestone, triglyphs and the ruin 3,
timber 2; terracotta, leaves, embers and the olives' limbs at the first; trunks up to 4; the bronze
door leaves up to 29 (their frames 2): they dent and spark and hold out longest. 70 rounds held at
one spot: 43..48 broke something on the tholos's limestone, 32 on a column's drums (it came down
in drums), 49 on the stoa's ruin (its column came down), 12 on the treasury's bronze door (dents),
61 on an olive's trunk (cut through, the crown down). Five rounds at a flank column cut a drum, and
that bay of the colonnade comes down (126 pieces loose at once). The props have their shards now
and break, under a blast's heart (within 0.85 of its radius) or enough rounds (as many as a piece
of their material half their size takes: `propRounds` in the library); not measured here since.
Before, the amphorae skittered (up to 6 m/s), a tripod was knocked over, the lions and the statue
only took marks.

## The scenery

- **Land**: one mesh over ±1.7 km, 1 m apart near the middle and coarser outward (90 m at the
  edge), from `terrain()` in `layout.ts`. The plateau is flat at 0; the coasts (west and north,
  wavering, meeting in a rounded point) drop in cliffs with ledges, buttresses and gullies to the
  sea; inland the ground falls about 20 m, rises into dry hills at 300..1000 m (60..170 m high) and
  behind them mountains at 1.2..1.7 km (150..410 m more), as DESIGN.md has them. Both come down
  toward the coasts (the hills within 350 m of them, the mountains within 700 m), so the land
  meets the sea in cliffs about 40 m high, not in walls of 200..400 m cut off where the coast
  runs. The camera sees 2 km (`far: 2000`); the fog (clear blue, complete at 1.9 km) leaves the
  mountains pale but shaded, ridge behind ridge. Its material: dry grass (`temple_ground`, a little greener or more straw, lighter or
  darker, at 10..20 m) with bare rock (`marble_rock_02` at a 3 m tile, tinted toward the bedrock's
  0xd6cfc0) in patches with ragged, soft edges, more of it near the cliff tops, and in spots along
  the sacred way and round the temple where feet wore the ground; steep faces triplanar
  `marble_cliff_01` at two scales with streaks of `marble_cliff_03`; wet rock and foam at the
  waterline; far off a coarser ochre ground with dark scrub in clumps. (`landLook` in `land.ts`:
  the breakable ground's earth shares it.) Over the breakable ground the mesh has a hole, its
  lines run along the areas' edges.
- **Sea**: at y = -62, as designed (`destruction.killBelow` is 10 m under it, so what goes over
  the cliff reaches the water before the library takes it out). The sea is shaded by hand
  (`seaShading`): two drifting layers of swell, the sky reflected from the HDRI (turned as the
  background is) by Fresnel (held down to 45% once the view is more than a few degrees down onto
  the water: the pale low sky mirrored there turned the open sea grey), a sun glitter, turquoise
  at the cliff foot, deep blue (0x123f66) a little way out, and haze toward the horizon's own
  colour from about 1 km out, no more than 0.6 until the last half degree (`HAZE`). It's drawn on
  a plane as far as the land reaches (so the cliffs and the far coasts go into it) and, beyond, on
  a shell round the camera where every ray below the horizon is shaded as the sea it would meet,
  so it runs to the horizon.
- **Haze**: the sea fades with distance toward the sky just over the horizon behind it, read once
  from the HDRI's pixels into a 256-step strip round the horizon, averaged over the first few
  degrees up and ±11° round (`horizonStrip`). Sampling the map's horizon row directly smeared its
  detail into radial streaks wherever the haze was thick; the far sea's grazing reflections blend
  to the same strip for the same reason. The map is sampled at level 0 (its seam drew dotted lines
  with a derived level). And the noon air shimmers low over the ground and the sea past 80 m
  (`look.haze`, strength 1, under 1.5 m).
- **Islands**: five long low islands 1.1..1.8 km out to the west and north (14..66 m high),
  drawn as silhouettes in the sea shell, so they keep their size as you move: lit on the side that
  faces the sun, scrub in patches, and hazed toward the horizon strip's colour, more at the
  waterline than at the crest.
- **Physics**: the plateau is fixed boxes 4 m deep (their top at the bed under the breakable
  ground, `plateau()` in `ground.ts`; at 0 elsewhere, the tiles' boxes until they're laid); past
  it, fixed hulls follow the cliffs and slopes, so what's thrown off the edge tumbles down the
  rock. 907 of them: cells of 8 m where the land is
  gentle (beside the sanctuary only where it's all but flat), 4 m where it isn't; down the cliffs
  only along the coasts the sanctuary overlooks, and only to the water; each cell a column to 2 m
  under its lowest corner, cut into bands no taller than 10 m. The old ones (1,104 on a 4 m grid,
  down to 14 m under the sea, cliff columns 40..58 m tall) made the solver's cells 32 m; with the
  solver's grid in levels the two cost the same (below), and the new ones are fewer and short.
  Past them, the slopes get hulls only under what wakes there (`slopeUnder`).
- **Cliffs**: the coasts wander in coves and headlands (±12 m), the faces have stronger
  buttresses and gullies, the ledge part way down wanders along the coast, and the ochre streaks
  are no longer level bands.
- **Sky and fog**: `temple_sky_1k.hdr`, Poly Haven's pizzo_pernice_puresky graded toward a
  deeper blue above the first few degrees (`scripts/assets/packs/temple/sky.py`; the zenith comes
  out about #2c608f on screen); the sun light at the HDRI's own 53° (no `sky.elevation`). The fog
  is a clear blue (0xb4c6d8) to 1.9 km, and the grade's saturation 1.15.
- **Life and clutter**: olive scrub in clumps of three to five bushes on the slopes inland (darker
  underneath), loose pale rocks along the cliff tops and outside the temenos, tufts of thyme and
  dry grass (fans of blades) along the temenos wall, round the platforms, bases and the tholos (all
  instanced, and not physical: keep them low; none on the breakable ground), two small sailing boats far out, gulls gliding in
  circles off the cliffs (`Gulls` in `flock.ts`). The scrub, the rocks and the boats are dormant,
  and a blast flattens the tufts it reaches (see "Round the sanctuary").

## Assets (public/packs/temple)

Textures `temple_marble`, `temple_marble_broken`, `temple_limestone`, `temple_roof_tiles`,
`temple_ground`, `temple_foliage`, `temple_earth`, `temple_fill` (GPT Image 2.5, made seamless) and Poly Haven `marble_rock_02`,
`marble_cliff_01`, `marble_cliff_03`, `rough_wood`, `bark_willow_02` (`marble_rock_01` is in the
pack, unused: the design's first pick for the bedrock); the sky `temple_sky_1k.hdr` (Poly Haven's
`pizzo_pernice_puresky_1k.hdr`, graded by `sky.py`); props `statue`, `tripod`, `amphora`, `lion`;
sounds (cicadas, coast, marble breaking and drums landing, stone grinding, collapse, tiles,
bronze, foliage, birds, gravel steps, sea splash, and since Phase F the goddess's ring and the bay's
echo of a burst). See `public/packs/temple/CREDITS.md` and the
makers' reports in `assets-src/packs/temple/*-report.md`. Screenshots judged while building:
`assets-src/packs/temple/shots/`. Phase E made two textures for the breakable ground,
`temple_earth` (terra rossa with pebbles) and `temple_fill` (marble and limestone rubble in lime): two
GPT Image 2.5 images, $0.40 by estimate (`ledger.jsonl`, `"by": "phase-e temple ground"`). Phase F
made a second take of `temple_earth` (dry crumbs and clods of soil: the first read as speckled
stone), one GPT Image 2.5 image ($0.20 by estimate), and two sounds, `bronze.ring` and `bay.echo`
(six Stable Audio takes, one of them a redo of a take that came out a single boom, $0.23, and six
QA calls, $0.06): `"by": "phase-f temple"`.

## Reactions

The sanctuary answers the gun as it answers a rocket (`onBlast`, and since Phase F `onShot` for
each bullet that strikes and `onBurst` once the trigger's let go), scaled to the gun: a burst's
`loud` is 0.25 + its rounds / 40, at most 1 (a rocket's), so a tap of the trigger is a quarter of a
blast and a burst of 30 rounds (2 s) a whole one. A burst sets off each reaction once, however many
rounds it has.

- **Cicadas** (`ambience.cicadas`, in `audio.ambience` at the settings' 0.2, fainter up high) fall
  silent at a blast and at a burst's first strike (`hush()`: `rt.ambience`, `setVolume(0, 0.25)`),
  and come back over 10 s after (15..30 s) × `loud` of quiet from the blast or the burst's end
  (`update()`). Measured (`cicadas.mjs`): a single round, silent 0.3 s after it, coming back from
  7 s, full by 17 s; a burst of 28, silent 0.3 s in, coming back 22 s after it ended, full 10 s on.
- **Jackdaws** burst off the roof (temple, treasury, tholos) nearest a blast within 25 m, or at a
  burst's third strike nearest where it strikes or the player within 30 m (a burst into the sky:
  as it ends, nearest the player), at most every 40 s: `birds.scatter` and a flock of 22 birds
  wheeling off over the sea. The flock is drawn from the start, every bird shrunk to nothing, so
  its material isn't made in the frame of the first blast.
- **The bay echoes** a blast of radius ≥ 2, or a great deal of stone landing at once (a `landed`
  section over 25 in mass): `explosion.far` 400 m out to the west, asked for 1.2..1.8 s later
  (`play({ delay })`, weighed when it's due), to which the engine adds the 1.2 s from 400 m.
  `audio.settings` gives it near 120 and rolloff 0.6 (with the pack's falloff it was too faint at
  400 m to play at all). A burst it throws back as `bay.echo` (this pack's: the far rattle of a
  burst off distant cliffs), from the same place 1..1.5 s after the trigger's let go (and the 1.2
  s), at 0.35 + 0.65 × `loud` (the pack's near 160, rolloff 0.6), one echo of either kind every 3
  s at most. Recorded (`soundrec2.mjs`): a burst of 14 into the sky peaks at -20 LUFS (momentary)
  standing, its echo comes 2.4 s after it at about -30 over a bed of -33.5; a long burst's 2.6 dB
  louder.
- **The goddess rings when she's shot** (`ring()`): a bullet striking the statue plays
  `bronze.ring` (this pack's: a ping and the deep hum of hollow bronze) at 0.72..0.8 (deep), a
  tripod at 1.3..1.45; once a second at most each, half as loud while still ringing from the last
  (4 s): 70 rounds at her rang 5 times (two runs). A ring alone peaks at -24.6 LUFS (momentary)
  from 7 m, a burst's shots at -20; her strikes are the bronze's own `bullet.metal` at 0.85, sparks
  and dents. Two voices.
- **Leaves flutter down off a shot olive** (`Leaves` in `flock.ts`): each round into an olive's
  crown (or a woken bush of the scrub) knocks 6 leaves out of the face it struck (10 when it
  broke a cell), at most 40 at once and 20 a second more (pool 160): each tumbles as it falls
  (0.6..1.1 m/s, gliding side to side,
  drifting toward the sea on the breeze), dark grey-green on top and silver underneath so they
  flicker, lands flat on what's under the strike (not the tree), lies 5 s and shrinks away. 14
  rounds into a crown: 55..57 leaves; 28: 37..40 (most of the rounds passed through once the
  cells they struck had gone). Drawn from the start, shrunk to nothing, as the birds are.
- **Marble dust where stone lands**: a section or a heavy piece of marble landing at more than 3
  m/s (the library's `landed` event) raises a white puff (`effects.puff`, its size by the mass; a
  few a second at most), and is heard as one thud (`land: 'marble.impact.large'`, louder and lower
  the heavier) instead of each block's strike.
- **Leaves burst**: a cell of leaves that falls whole (a canopy whose limb was blown away, a
  cypress felled) bursts where it lands: it's taken out, with a spray of leaf-coloured chips, a
  little pale-green leaf dust and `foliage.break`.
- **Tiles break where they land** (`terracotta.landing`: the library's own breaking, its
  `maxImpacts` a readback shared by material), each break heard as `tile.shatter`, which has a 0.2
  s cooldown within 6 m: in a collapse the marble's sounds carry it, not a continuous crash.
- **Bronze rings**: only the statue and the tripods ring (`bronze.clang`, the tripods higher)
  when they strike something (and `bronze.ring` when shot, above); doors and shields make the
  material's own sounds (`metal.impact.small`), and `bronze.clang` has a 0.8 s cooldown within
  12 m, two voices.
- **Splashes**: a loose piece that reaches the sea is taken out (looked for among
  `d.loosePieces` every 0.1 s); a block or a drum (mass over 0.05) throws up a white plume
  (`effects.puff`) and `sea.splash` as it goes.
- **The offering goes out** when it's knocked off the altar (its glow and its smoke stop).
- **Props fall with their stands**: the goddess on her base and the tripod on the votive column
  wake when what they stand on goes (the library's; the world's nudges are gone).
- **Smoke and dust**: the blast's cloud is white marble dust that clears in about 6 s
  (`look.smoke: { color: 0xf0ece4, life: 0.55, opacity: 0.8 }`; the library's brown billow hid a
  struck building for 8..10 s), and all dust is mixed from pale stone colours, the material's own
  counting 0.6 (`look.dustPalette`). Leaves, timber, bark, bronze and ash raise less of it
  (`dustAmount`; leaves least, 0.12 since Phase F: a third of the dust over a crown coming down).
  A round into leaves still raises the strike's own powder (the known issues).
- **Sounds by material**: the marbles share the base pack's `brick.impact.small` and `brick.debris`
  a little higher (`pitch`), the limestone too; the amphorae (props) sound as terracotta. The
  court's flags sound as the marble, the rock under the earth as stone a little lower, the earth
  and the rubble crunch (`steps.rubble`). A bullet's sound on each: above, "The gun on the
  sanctuary".
- **Footsteps** are gravel and dry grass on the ground (the earth and the rubble in a crater too),
  stone (`steps.asphalt`) on the steps, the stylobates, the court's flags, the rock in a crater, a
  crater's bare floor (the bed) and any standing block (`footsteps.surface`), rubble on rubble.

## Tuning

- How much falls: `support` and `strength` in `materials.ts`; which spans shear (`k.levers.add`
  in the builders, `SHEARS` in `levers.ts`).
- Look: `look` in `index.ts` (fog, exposure, bloom, hemisphere, grade, smoke, dust, haze); the
  sky's grade in `sky.py` (`ZENITH`); sea colours, swell and `HAZE` in `scenery.ts`; land colours
  in `landLook` (`land.ts`, the breakable earth's too); the hills and mountains in `land()` (`layout.ts`); the flutes in
  `drumMarble()`, the embers in `embers()` (`materials.ts`), the altar's smoke in `update()`.
- Trees: `CYPRESSES`, `OLIVES` in `trees.ts` (canopy count, size and height in `olive()`, their
  shape in `canopy()`). Cliffs: `westEdge`, `northEdge`, `cliffProfile`. Terrain colliders:
  `physics()` in `scenery.ts` (`BAND`, the cell sizes).
- Stone come to rest hanging: `HIGH`, `HOLLOW` and `BALANCE` in `levers.ts`; when creeping stone
  counts as come to rest: `CREEP` and `SLOW`; what's left on a column alone: `SHOVE`, `SPIN`,
  `ABACUS`, `BESIDE`; the levers' time a frame: `BUDGET` (cuts and spans let go) and `LOOK` (stone
  come to rest).
- The breakable ground: where (`COURT`, `FIELDS`) and how deep (`LAYERS`) in `layout.ts`, the
  slabs' size (`cell`), how hard the court throws its chunks (`toss`) and the beds in `layGround()`
  (`ground.ts`); its craters by the materials' `reach` (`paving`, `fill`, `earth`, `rock`), what
  flies as spray and what stays by their `minBodySize`, `keepSmall` and `maxPieces`; the flags'
  courses and lengths in `flags()` (`COURSE`, `FLAG_LENGTH`, `OLIVE_BED`).
- Round the sanctuary: the plateau's tiles (`tile`, 6 m, in `buildScenery`; `PLATEAU` in
  `ground.ts`), how far a blast flattens the tufts (1.2 times its radius, `onBlast`), and how the
  woken scenery breaks (`scrub`, `boulder`, `sail` in `materials.ts`).
- The answers to the gun: how loud a burst is (`loud` in `onBurst`), the cicadas' quiet
  (`hush()`), the birds' reach and wait (`scatter()`), the echo (`bayEcho()`), the goddess's ring
  (`ring()`); the leaves (`LEAVES`, `SHED`, `BREEZE` and their fall in `Leaves`, `flock.ts`).
- Piece budget: `maxPieces` and `minBodySize` in `materials.ts`; the world's budget in
  `destruction` (`index.ts`: `maxPieces` 7,250, what it loads with and 1,500 more: past it rubble
  at rest dissolves, the library's). It loads with about 5,750 pieces (the ground's 422 slabs among
  them); four flank blasts 1 s apart leave about 6,100..6,300; each crater in the ground adds
  15..100, and 20 s of the gun held across the court or a field 360..390.

## Measured (display :101, the GPU shared with other agents' Chromes)

### Phase F: the world answers the gun

Display :101, port 5331's dev server (it served every edited file: checked with curl), the GPU
shared with other agents' Chromes and the machine busy (a load of 15..79; three runs lost to the GPU
running out of memory, and a pair at a load of 70 thrown away): frames came at 25..30 ms on average
standing, not a quiet GPU's 16.7, and Brick Street's the same at the same time. Scripts:
`scratch/phase-f/temple/`
(`lib.mjs` and `helpers.js`; `craters.mjs` rockets into the grounds, `gunground.mjs` the gun into
them, `cloud.mjs` the dust over a crater, `pitside.mjs`, `tiles.mjs`, `reactions.mjs`, `leaves.mjs`,
`cicadas.mjs`, `soundrec2.mjs` and `loud.sh` the echo's and the ring's loudness, `sea.mjs`,
`checks.mjs`, `collapse.mjs`, `perf.mjs`, `budget.mjs`, `thumb.mjs`; `out/`). The screenshots judged
are kept in `assets-src/packs/temple/shots/phase-f/`.

- **Stands**: 5,752 pieces at load, 0 loose and no standing piece lost for 10 s (2 loads, and 4
  more looked at after 2 s), no console errors or warnings; no pipelines made after the card through the reactions (the birds,
  the leaves, the ring, the echo), a rocket into the court and the gun.
- **The signature collapse** (four flank blasts 1 s apart, the last check's `collapse.mjs`): loose
  16/0/0 and 75/0/0 at +10/+20/+40 s (the second at a load of 65, 12 frames a second): it comes down
  as before (Phase E 31/0/0, its last check 8/0/0); nothing past 120 m, none under the ground.
  Brick Street's four blasts, in turn: 483/473/279 and 787/476/0. The frames from the first blast to
  +10 s: mean 39.6 and 80.1 ms, worst 234 and 272 (Brick Street 41.6 and 28.0, worst 118 and 122).
- **Frame times** (`perf.mjs`: 8 s standing at the start, then the trigger held 10 s at the main
  wall 6 m off while the view sweeps 0.6 rad across; the two worlds in turn):

  | ms a frame | standing: mean / median | firing: mean / median | worst, frames over 40 ms (of ~330) | rounds that broke, pieces added, loose at most | world's update |
  | --- | --- | --- | --- | --- | --- |
  | temple, the tholos's limestone (4 runs) | 24.6..29.3 / 22.0..31.0 | 28.9..32.1 / 29.0..30.5 | 84..216, 48..73 | 54..62 of 133..140, +140..276, 100..208 | 0.30..0.38 |
  | `nyc` brick (4 runs) | 25.1..30.4 / 24.7..30.5 | 30.5..33.0 / 28.9..32.1 | 117..140, 79..93 | 90..105 of 137..139, +388..709, 96..291 | 0.35..0.42 |

  The temple costs what Brick Street costs, standing and under the gun; its reactions add nothing
  that shows (the world's `update()` 0.3..0.4 ms a frame while firing, as Brick Street's).
- **The court's craters** (`craters.mjs`, 18 rockets, three loads; before, the same spots with
  Phase E's settings): see "The breakable ground". The dust over a court crater, now and before
  (`cloud.mjs`): the same cloud, 210 particles left at 8 s against 400.
- **The budget** (`budget.mjs`): `maxPieces` 7,250; after four flank blasts (6,138 pieces, 1,026 of
  them rubble) set 300 under the count, the rubble went down to it in 20 s (299 pieces, all rubble),
  the pile looking the same from 20 m.
- **The rest**: rounds into the sea struck nothing (`sea.mjs`, 14 of 14, nothing heard but the gun);
  a court crater's floor strikes as rock, its side against the land as earth over rock; roof tiles
  strike as `brick` (`tiles.mjs`: red-orange chips and a puff, no glitter).

### Phase E: the breakable ground and the gun

Display :101, port 5331, the GPU shared with other agents' Chromes (busy: standing at 60 fps capped,
frames came at 20..25 ms on average while the gun runs were taken, and two runs were lost to the
GPU running out of memory and thrown away). Scripts and screenshots:
`scratch/phase-e/temple/`
(`collapse.mjs`, `ab.mjs`, `crater.mjs`, `walk.mjs`, `close.mjs`, `gun.mjs`, `fire.mjs`, `decals.mjs`,
`sig.mjs`, `load.mjs`; `out/`). The screenshots judged are kept in `assets-src/packs/temple/shots/phase-e/`:
the views before and after, rockets into a field and the court from the player's height and from
above, standing in the craters, bursts at stone, bronze, trees, the ground and the props, a sweep
across a field, the marks, and the ground's edges and flags close.

- **Stands**: 5,752 pieces at load (5,402 before: +422 slabs, -85 of the paved way's static flags);
  0 loose and no standing piece lost for 10 s after load (3 loads); no console errors or warnings.
  It loaded in 7.9..8.4 s (7.2 s before, the same afternoon).
- **Idle and a collapse, before and after** (`ab.mjs`: both built, served to one Chrome in turns,
  vsync and the frame cap off; Brick Street the same code both times, for the noise; 4 pairs):

  | ms a frame | temple before | temple now | `nyc` "before" | `nyc` "now" |
  | --- | --- | --- | --- | --- |
  | idle 8 s, median | 2.0..2.5 | 1.7..2.7 | 2.2..2.4 | 1.9..4.3 |
  | idle, mean | 2.28..2.9 | 2.32..2.99 | 2.68..3.19 | 2.02..4.07 |
  | four flank blasts to +10 s, mean | 2.83..3.57 | 2.79..4.38 | 3.29..5.37 | 3.61..5.72 |
  | the same, worst / frames over 40 ms | 44..95 / 1..15 | 39..55 / 0..3 | 46..195 / 2..6 | 50..238 / 1..12 |

  The same within the noise (Brick Street's own spread, its code unchanged, is wider). Vertices
  drawn 367k → 380k; four materials more (four draws, and their shadow and depth passes). Capped,
  with Brick Street measured at the same time: idle median 17.1 ms before and after (Brick Street
  16.8 and 17.5); the four flank blasts' worst frame 67 → 87 ms, 21 → 44 frames over 40 ms (Brick
  Street's four blasts 51 → 73, 12 → 66: the GPU busier the second time).
- **Signature collapses** (fresh loads, loose at +10/+20/+40 s): one flank blast 7/0/0, the corner
  column 1/0/0, the treasury's porch 1/0/0, the propylon's 0/0/0, the tholos's 0/0/0, four flank
  blasts 31/0/0 (5/0/0 before; Phase D's 5..26 at +10 s). None broke a slab of the ground.
- **Craters and the player**: above, in "The breakable ground" (four rockets fired from 9 m; the
  player walked through each, 4 s each way, feet every frame: down to -0.45 in a field and out the
  far side with no stall, the eye easing up at most 0.15 m a frame).
- **The gun** (`fire.mjs`: 70 rounds at one spot, then 20 s held while the view sweeps 0.6 rad
  across; Brick Street's wall right after):

  | | burst: broke | sweep: broke | pieces | loose at most | fastest, farthest | sweep: mean, worst, frames over 40 ms (26 s) |
  | --- | --- | --- | --- | --- | --- | --- |
  | the tholos's limestone | 43 of 70 | 163 of 278 | 5,752 → 6,117 | 182 | 13 m/s, 15 m | 29.6, 159, 128 |
  | the court | 52 | 228 of 278 | 5,752 → 6,145 | 17 | 7.5 m/s, 4.6 m | 23.7, 148, 44 |
  | a field | 29 | 113 of 280 | 5,752 → 6,113 | 2 | 2.3 m/s, 3.1 m | 25.4, 76, 49 |
  | `nyc` brick, at the same time | 50 | 216 of 279 | 7,886 → 8,920 | 477 | 17 m/s, 36 m | 29.4, 130, 133 |

  Standing before each, frames came at 22..25 ms on average: the gun on the temple costs what it
  costs on Brick Street's wall, and on the ground less. Nothing flung (no piece over 13 m/s), no
  pipelines made after the card, 10 s after each sweep nothing loose.

Phase D's measurements follow.

Phase D's second round, after the independent check: 36 loads of the temple and 8 of Brick Street,
taken in turn. Each load counted at +10, +20 and +40 s after its last blast; "past 120 m" and
"under the ground" (wholly 5 cm, or 1 m, under `groundAt` where there's ground, not the sea) look at
every loose piece and rubble every 0.25 s. The scripts are the check's (`check.mjs`, `gap.mjs`),
with a count of what's left over each flank column's top added.

- **Stands**: 0 loose for 10 s after load (16 loads); no console errors or warnings and no failed
  requests in any of the 36. It loads in 6.5..8.2 s, Brick Street in 5.3..6.3 at the same time.
- **A blast at a mid-flank column with the rocket's radius** (`demo.blast(-4, 1.6, 2.1, undefined,
  [0, 0, 1])`, 12 loads): it takes the column at -4; one or both columns beside it sit down onto a
  cracked drum, or fall. Stone over the gap (between the abacus edges, above 6.2 m, not standing):
  at +3 s, 0..4 pieces in 7 loads and 9..16 in 5; at +5 s, 0..2 in 10; none from 3..7 s on in 9
  loads, from 8.75 s in 1, and in 2 one block at rest there until it's cleared as small rubble at
  16..18 s (the one looked at lay on the walk's ceiling by the cella wall). The independent check,
  before this round: 11..17 pieces until 3.75..8.25 s in 4 loads, 3..5 of them until about 12 s in
  2. At radius 2.3 (4 loads) the columns either side stand and the gap is clear by 2.25..3.25 s.
  Loose: 1..35 at +10 s, 0..1 at +20, 0 at +40.
- **Four flank blasts** (-8.4, -4, 0.4, 4.8, 1 s apart; 6 loads at the rocket's radius, 6 at 2.3):
  no column stands from -8.4 to 4.8. With the code as it is (8 loads), none that sat down there
  carries more than an architrave stub and a frieze block, and that in 1 load; the check found
  stacks to 7.8..8.7 m in 4 loads of 8 at radius 2.3, and here, before a column left standing
  between two gaps was seen to, 1 load of 6 kept one with its whole entablature over it. The roof
  over the gap is down, both slopes. Loose: 5..26 at +10 s, 0 at +20, 0 at +40. Stone at rest above
  3 m: 12..35 pieces (the corners' and the walk's ceiling's among them). Pieces at rest over 1 m
  with nothing within 1 m under their middle: 21..49 (the check's: 20..52), tiles and 4..18 timbers
  of the trusses left lying across the cella's walls and the naos's inner colonnades (see the known
  issues), and 2..8 marble pieces (the check's: 1..9).
- **The corner column** (`demo.blast(7, 2.2, 1.5, 2.4, [0.7, 0, 0.7])`, 2 loads): the stone over
  its gap is down by 2.75 s; loose 1..3 at +10 s, 0 at +20 and +40.
- **The treasury, the tholos and the propylon** (a porch column each, 2 loads each): loose 0..5 at
  +10 s, 0 at +20 and +40.
- **Nothing flung or sunk**: no piece past 120 m in any load (the farthest loose or rubble 39 m from
  the middle: an amphora fragment lying there as built), none under the ground. Brick Street, at the
  same time: none past 120 m (the farthest 35..84 m), 0..14 cells 5 cm under the sidewalk, 0..4 a
  metre under.
- **Frame times**, Brick Street (four blasts at its ground-floor front, 8 loads) measured in turn:
  - Idle at the start: median 16.7..17.4 ms, 90th percentile 18..33 (Brick Street 16.7..23.1,
    19..33); three loads, two of them the temple's, at 27..28 ms while the GPU was busy.
  - The first blast's worst frame: 30..70 ms of four flank blasts, 36..56 of one (Brick Street
    28..71).
  - A big collapse (from the first of the four flank blasts to 10 s after the last): worst frames
    37..66 ms, 0..22 frames over 40 ms, mean 17..28 in 11 loads, and 95 ms, 182 frames over 40, mean
    41 in one taken while the GPU was busy (it took 8.2 s to load) (Brick Street 44..110, 2..46,
    17..29).
  - The world's own `update()`: 3.5..5.9 ms in the worst frame of any blast (36 loads; 0.1..0.2
    idle). The first round: 4.1..5.8 in one flank blast, 4.3..5.2 in four; the check: 3.5..5.2, and
    5.7 and 7.3 in two loads of one flank blast.
  - (Phase C) The solver's step on the GPU (timestamp queries) with ~490 pieces loose: about
    2.2..2.4 ms, its collision 1.1..1.3 ms; with 35..70 loose, collision 0.75..0.8 ms. Standing:
    0.11 ms.
- **Cliffs**: blocks dropped past the brink tumble down the rock (ledges, faces) and splash into
  the sea at -62 within 4..5 s.
- **The far land**: from the north and west cliff tops and the temple roof, the hills come down to
  cliffs about 40 m high at both coasts; the mountains behind, 1.2..1.7 km out, show their ridges
  pale in the haze.

## Known issues and library requests

- **The weighing routes loads by bond hops, not by where things stand.** In Phase C a corner
  blast (the south-east column) overloaded a side bond between the cella's east cross wall and its
  south wall that carried 310 units as built (most of the east end's roof, routed through it) at
  1.22 times that, past the limit of 1.125, and the door, blocks of its wall and the east porch's
  attic came down 5..6 m from the blast; with timber at its old support (150), the same blast
  brought down the whole cella roof, bay after bay over 2.6 s (timber is at 600 here, which stops
  that). Now a single flank blast lets go of the east door, 9 m off (its leaves, jambs and lintel
  and the wall over it, 31..52 pieces, in each of 12 loads), and in 3 of them of a few beams and
  lids of the north walk's ceiling, 10 m off: they come to rest where they stood, so it doesn't
  show, but they're let go and frozen again. The independent check confirmed it (with the rocket's
  radius in every load: 20..40 bronze, 8..11 limestone and 20..28 marble pieces let go more than 7 m
  from the blast; at radius 2.3 the door stays, and in 2 loads of 10, 6 pieces of the north walk's
  ceiling go), and after the collapses the door's jambs stand with nothing bonded under them, the
  lintel and the courses over the door at rest in place. The library could weigh loads by where
  they bear (or let a world give a structure more headroom than `reinforce()`'s 1.5).
- **A section bridging a gap rests there.** The library judges a section at rest by its centre of
  mass over its supports, and gives way at its joints only bent more than 4°: a dry-laid span
  sagging a degree or two across a lost column, on the columns either side that sat down, rests
  there, and so do the arms of a V on stacks over those columns, and a block tipped off a column's
  top wedged against what stands; and before any of it comes to rest it creeps there on the
  columns sitting down, for 6 s or more. `levers.ts` cuts or knocks loose stone that comes to rest
  so or creeps there (above), half a second after it slows: after one rocket the stone over the gap
  is down 3..7 s after the blast in most loads. An option to give way at a section's joints in
  tension (or a lower bend for dry-laid materials) would let it go as it lands; and the library
  could say what holds a loose piece up (it knows what each touches), where the levers look for it
  with rays.
- **What's left on a column that sat down** beside the entablature going on past it stands as a
  stack, some of it askew (each block's centre over what holds it up); a block or two sliding off
  it is the last of a single blast's stone to fall, at 5..9 s. A column left standing between two
  gaps keeps its architrave stubs and a frieze block: pushed off, they're held by the stone of the
  gaps still leaning on them.
- **Roof frames rest whole.** After a big collapse the trusses let go (tie beams, king posts,
  rafters) whose ties still lie across both cella walls come to rest there, their middles over the
  naos (a check piece by piece counts 4..18 timbers with nothing within 1 m under their middle,
  above; they lie on the walls and on the naos's inner colonnades). Over a gap in the colonnade the temple's rafters hang from
  the ridge side with their feet in the air, the plates under them gone: timber's support of 600
  holds them, which keeps one flank blast from opening the roof bay after bay. A few standing tie
  beams on the north side lose their bonds to the walls under them in the weighing and stay where
  they lie, held by the frame.
- **Flutes and grooves are colour only**: `FragmentMesh` sets the surface's `normalNode` itself
  (its normal map in the face's frame), so a surface can't bend its normals by `pieceFrame()`: a
  hook for a normal (or height) in the piece's frame would let flutes and the triglyphs' grooves
  catch the light.
- **The open door leaf is tied to its jamb by hand.** A piece on a hinge now comes to rest and
  isn't counted loose while it hangs at rest, so it could hang on a hinge; but a leaf on an upright
  hinge keeps turning slowly once a blast pushes it, and counts as loose while it does (Harbor
  Yard's, `docs/changelog/phase-d/README.md`).
- `'landed'` doesn't fire for a section landing on loose debris (the library's note), so some
  heavy landings are heard as their blocks' strikes.
- **A round into leaves raises the soil's powder**: leaves strike as `dirt` (their soft
  `bullet.dirt`), and the demo's strike throws four puffs of a dirt strike's powder each (the
  effects have no kind for leaves), so 14 rounds into a crown raise a pale cloud round it while
  the leaves come down; the world's `dustAmount` doesn't reach a strike's powder.
- **The leaves pass through things**: they fall to the floor found under where the round struck
  (what stands there or the ground) and lie there; one drifting over a step or a block on the way
  passes through it.
- **How many rounds a prop takes isn't measured**: the props have shards now and break (a blast's
  heart or enough rounds); until then the amphorae skitter and roll under the gun and the lions
  take marks.
- **The heavy gun and the colonnade**: five rounds at a flank column cut a drum (marble's `impact`,
  a drum 0.68 m), and the bay over it comes down as a rocket would bring it: the gun is the quicker
  way to drop a column now. Held 20 s on the ground it adds 360..390 pieces that stay (cells left
  standing round the holes; the library's "Pieces added by the gun stay").
- **The ground's craters**: a crater's faces are flat Voronoi cells (soil walls in a field read as
  a dug pit with straight sides); a flag or two thrown round a court crater still comes to rest on
  edge (the library's thin chunks). The rock under the earth is hard (`reach` 0.25): rockets leave
  a field's craters on it, 0.45 m deep, and now and then throw a slab of it out whole, a grey plate
  by the rim; the gun digs into it slowly (28 rounds a slab). The court's hole goes to the bed
  (1 m) in its middle (Phase E: a jump got out of it).
- **The cut where the ground meets the steps** shows earth over rock under the temple's lowest
  step (the cut is the land's, wherever the ground ends), not a foundation.
- **19 materials** (the ground's four and the woken scenery's three added): one draw each, and
  each material's mesh holds its own 600k vertices.
