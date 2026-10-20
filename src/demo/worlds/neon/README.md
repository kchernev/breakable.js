# Neon Alley

A narrow alley at night in a dense East Asian-inspired megacity, in the rain. Tile-clad concrete
towers and rendered shophouses, 4 to 8 storeys, stand 7.5 m apart. Their fronts carry neon glyph
signs, blade signs, lightboxes, AC units, drain pipes and roller shutters. A glass footbridge
crosses at level 3, lantern strings and power cables sag between the facades, a lantern gate
stands at the mouth, and an end block with a lit arcade closes the far end. The wet asphalt
reflects the neon, and breaks: a rocket craters it, the machine gun chips it. The alley answers the
gun as it does a rocket: signs and lamps are shot dark, shutters rattle, steam pipes gush, a long
burst browns the street's power out. `?world=neon`.

The plan it follows is `DESIGN.md` (same folder). Where this differs from it, it says so below.

## Files

| File | What |
|---|---|
| `meta.ts` | The card (order 3). |
| `index.ts` | The definition: sky, look, audio, dust and chips; `build()` puts it all up. |
| `layout.ts` | The constants (facades at z ±3.75, storeys 3.6 / 3.0 m, slabs 0.24, walls 0.3, the breakable street's `GROUND`), the lot list, and `Frame`, which maps a building's local lx / ly / lz into the world. |
| `buildings.ts` | Type A towers (`towerA`), type B shophouses (`shophouse`), the end block (`endBlock`), and what is put on their facades: signs, AC units, drain pipes, lit windows and curtains, caged balconies, rooftop tanks, condensers, head-houses, washing lines, masts and billboards; each type A building's base (`bases`: its ground-floor supports, for life.ts). |
| `signs.ts` | Neon tubes, flat signs, blade signs, the big blade's crown, lightbox panels and billboards. |
| `glyphs.ts` | The made-up stroke script and the pictograms, and the glyph atlas (a canvas) the lightboxes show. |
| `street.ts` | Shutters, awnings, the lantern gate, lantern strings and power cables (`slings`: what life.ts hangs once they're struck), the bridge, the vending machines, the transformer box, the pipes in the slot, and the clutter at street level (stools, gas cylinders, boxes). |
| `materials.ts` | 14 of the 16 breakable materials (the street's two are in `wet.ts`). |
| `glow.ts` | Which glowing pieces are lit and how much, and the lightboxes' atlas places (see Light). |
| `scenery.ts` | The night sky, the street drawn past the breakable one (and under it: the bed's earth and water, the pit's sides), the ground in the world, the towers behind both rows, their billboards, the skyline and its beacons, the avenue (its shopfronts, awnings and traffic), the lane north, the passage east; a fixed box in the world for each building and billboard but the far skyline's. |
| `wet.ts` | The wet street: its shader (`wetStreet`: asphalt, puddles, rain rings, gutters, drains, manholes, and where rounds struck it), its materials and its slabs (`groundMaterials`, `layGround`: see The street), and the signs, lit shops and lanterns as it reflects them (see Light). |
| `props.ts` | Where the scooters, carts, crates and bins go, and each copy's paint. |
| `life.ts` | The reactions (to rockets, to the gun: `onShot`, `onBurst`), the four point lights, the push that tips a dropping shophouse facade out, the end block's face over the alley (and the billboard on it) let go with its arcade's front, the gate let go once a post no longer holds it, the struck cables that hang from the facades, the vents (the manhole's steams from what's under it), and the footsteps by what's underfoot. |

## How it's built

- **Type A** (10 towers and the end block): a concrete frame clad in tile. Slabs butt against a tile
  band at every level and bond to it (in panels of at most about 2.2 m up to level 2, about 3 m from
  level 3 up, where nobody sees them; the ground slab and the band under the facade are static,
  never broken or moved, so each is one piece, or two on the end block); between the bands each
  floor is tile columns and bays of spandrel, glass and head. Ground-floor columns come in two
  lengths, with a fascia between them and a lit shop or a roller shutter under it. Concrete back and
  side walls, an interior column on lots wider than 7 m. The two corner lots (N4, N5) have a facade
  module turned onto the lane for 5 m. Every tile piece of a facade shares one texture frame, so the
  grout runs on across pieces. Most have a bundle of three pipes up a ground-floor column. Floors 1
  and 2 have a steel mullion and transom in every pane. Behind about half the unlit windows hangs a
  curtain or a blind (an unlit `lamp` panel standing on the slab), so the upper floors read as
  rooms, not holes. Their roofs carry a stair head-house (a lit door, an antenna), a row of
  condensers along the front and a washing line; N3, N5 and S3 have rooftop billboards too. N4's and
  N5's side walls on the lane, past the facade module, carry AC units, a drain pipe and a small
  blade.
- **Type B** (5 shophouses): Brick Street's walk-up. A free-standing render facade (piers in two
  lifts a floor, sills, lintels, steel-framed sash windows, a security grille on floor 1) on a
  steel beam over the shop, tied in only through the side walls; the slabs stop 2 cm short of it
  (their panels as type A's; the static plinth under the facade is one piece).
- **Lit shops**: glass with a door, two ceiling panels (lamps at 4 × their light), a back wall
  that glows with the shop's light (a lightbox on a blank of the atlas: an even glow, at 1 ×), two
  menus on it, a faint glowing sheet on the floor inside the window, and inside either a noodle bar
  (counter, three red stools, two hanging lamps: a dark shade over a warm diffuser at 6 ×; S1 always)
  or a shop (counter, shelves of glowing goods in coloured rows, a chiller with a cool white door).
  Each lights the wet street before it (wet.ts, 0.5).
- **Street clutter**, put after the props where nothing stands: stools outside the noodle bars,
  gas cylinders by the shop doors, stacks of cardboard boxes by the shutters. Every roof has a
  water tank or condensers.
- **End block**: 8 floors facing -x, with an arcade through its two lower floors (4.8 m wide)
  under three concrete transfer beams at level 2, on tile arcade columns, with a lamp strip along
  its ceiling and a 6 × 3 m billboard on its face. Its face is 18 m wide, the alley 7.5: from level
  2 up its bands break at the bay lines nearest the alley's edges (z ±3.33), where its bays do, so
  the face over the alley comes away whole from what's behind N7's and S8's end walls.
- **Signs**: tubes are hexagonal prisms with a flat face on their backing, shortened 2.5 cm at each
  end (less on short strokes, so small signs keep every stroke). 9 blade signs plus the big one on N4 (8 segments, 12 m, magenta faces, cyan edges, an amber
  ring on top). Each blade segment is also bonded to the floor slab behind the facade, as a real
  blade is bolted through. Flat signs go on fascias, on spandrels of floors 1 to 4, and down
  columns; they reserve their place on the facade (`Taken`), so nothing overlaps. A flat sign's strokes are laid from the left of someone
  facing it (`facePlane`): on the north row that is the frame's far end, so its glyphs and
  pictograms aren't mirrored. The roof billboards behind both rows face the alley the same way.
- **Lightboxes** show the glyph atlas mapped per piece: each panel gets a texture frame at its
  face's corner and an atlas scale and offset in the glow buffer, so a blade face shows a column
  of whole glyphs and a billboard rows of them, and a cracked panel keeps its glyphs.
- **The script** (`glyphs.ts`): every glyph is two parts, a narrow one beside a wide one or one
  over another, as a radical and a component are, all straight strokes at least 1.1 units of 4
  long (a tube under about 5 cm isn't made). No lone verticals, rings, arcs or dots, which read as
  `1`, `I`, `0`, `O`, `C` or `?`; no closed box (with the post-and-slants part it read as 扣), no
  plain triangle (`A`, `Δ`), zigzag (`S`, `Z`, `5`), box off a post (`9`, `P`) or grass radical
  (艹). The right and bottom parts carry shapes no real script has (a frame open on its left with
  two crossing slashes, a triangle split by a flagged mast, a diamond on a stand, a pennant post
  with an arrowhead, a pierced zigzag), so no pairing makes a real character. Before changing a
  part, draw all 39 pairings and look at each. Pictograms keep their strokes long enough for tubes
  too.
- **Vending machines** (4, in front of S6, stepping over its door): a body in the machine's colour with a lit header, a
  warm white window with twelve cans in three coloured rows behind glass, six lit buttons, a coin
  panel and the pickup slot. They stay pieces, not a prop with an emissive map: a blast breaks the
  glass and spills the cans, which go dark, and there's no model to make one from without a paid
  generation.
- **Lanterns**: a ten-sided barrel between dark lacquered caps, a short tassel under it, shaded
  round (`smooth`). Strings hang at y 6.4, not the design's 6.2: 6.2 is the top of the floor-1
  windows, so a string would hang from glass; 6.4 is on the heads and lintels above them.
- **Round things** (pipes, gas cylinders, the conduits, the rooftop tanks) are shaded round
  (`smooth`); the sheet-metal boxes (AC units, condensers, tanks, sign bodies) each show their own
  patch of the metal's wear (`uvJitter`).
- **The footbridge**: glass sides (the same pale glass), a cool lamp strip under its roof (in the
  glow buffer; it goes dark when it falls), a cyan neon line along both sides of the deck and a
  magenta one along the roof's edges.
- **The transformer box** (N5's lane wall): an amber status lamp and a yellow neon warning bolt on
  its face, two conduits up the wall and a bundle of two along the slab edge at level 2 to the
  alley's corner, so it reads as what feeds the signs.
- **The street** breaks: wet asphalt over a concrete base in 2.5 m slabs between the facades (see
  The street).
- 7,953 pieces and 23 props at load (`demo.stats().pieces`: 7,976, under the 8,500 aimed at with
  the breakable street; 7,844 before it, 132 of them now the street's slabs; it was 8,443 with the
  buildings' slabs in 2.2 m panels everywhere); nothing comes loose at load. Past 9,500 (about
  1,500 more than at load: `maxPieces` in `index.ts`), rubble at rest shrinks away (the library's
  budget): the end block's and N7's four rockets each, a second apart, peaked at 9,722 pieces and
  were back to 9,500 by +50 s, nothing moving.

## Light

- Sky `kloppenheim_07_puresky_1k.hdr` for the light (environment 0.3). The background is the same
  sky recoloured at load (`nightSky` in `scenery.ts`): its clouds kept, lit from below by the city,
  sodium near the horizon and violet higher up, at 0.13. A blue moon at 0.35 that casts no shadows
  (they don't show in the alley at night; it saves the shadow pass). Fog 0x121a30 from 20 to
  150 m, bloom 0.85 / 0.55 / 0.55, rain 0.9. No screen-space reflections (see below).
- **What glows**: `neon` (tint × 7), `lightbox` (the atlas: glyphs near white over the tint × 0.25,
  × 2), `lamp` (tint × 1.5 behind blinds, brighter at the top), `lantern` (a deep red or amber,
  brightest where the paper faces you, darker along its ten ribs round its centre). All × the
  street's `power`, and (but the lanterns) × the piece's own light.
- **Glowing while standing**: `neon`, `lightbox` and `lamp` have the library's `glow: 'standing'`:
  a piece glows while it stands, never on its broken faces. The lanterns instead read
  `pieceState()`: lit while they stand or swing on a string shaken loose, out once at rest (rubble)
  and inside. The tint is `pieceTint()`, the lanterns' centre `pieceFrame()` (their frame is
  unturned and centred on the barrel).
- **Per-piece light** (`glow.ts`): a storage buffer of 4 floats per body slot. x is how lit a piece
  is: 0 for the curtains and blinds (unlit `lamp` pieces beside the lit windows), a lamp's or lit
  panel's level, times a stutter for now (`dim`: the flickering hotel sign's envelope, a hanging
  sign's stutter, a sign or lamp the gun struck), which gives its own level back after. y, z, w are
  where a lightbox face samples the glyph atlas. The cells of a broken piece take its values (and
  its sign, whatever they're made of, so a round into a raceway's cell counts against its sign);
  only the changed slots are uploaded. It also tracks which lit pieces fell, for the reactions and
  the wet street, and puts out for good what the gun shoots dark (`out`: the piece, or what of it
  still stands lit if it broke). It reads the body slot through the fragment mesh's `pieceInfo`
  attribute: the library has no accessor for it (see Known issues).
- **Four point lights** (no shadows, 14 m, decay 2): magenta 30 under the big blade, cyan 20 under
  the bridge, amber 18 at the gate, cool white 24 in the arcade. Each follows the power and fades
  when less than 30 % of what it hangs on still stands, or once what it shines for is shot dark
  (the big blade, the bridge's neon, the gate's board, the arcade's lamp strip); it stutters with
  that sign as the gun strikes it. Sparks use the effects' own flash lights.
- **The ground** (`wetStreet` in `wet.ts`, for the street's slabs and the street drawn past them:
  see The street): the dry asphalt's colour, normal and occlusion at 4 m. Puddles
  cover about a third of the alley: the puddle mask turned 0.6 rad at 5.3 m and widened (sampled
  blurred), where a 9 m noise lets them be, plus shallow sheets where a 2.6 m noise runs high, both
  gathering along the middle and the gutters. Wet everywhere: roughness 0.16 to 0.24 (the map's,
  blurred), 0.03 in puddles; the asphalt's grain at 0.3, flat in the puddles; faint rain rings in
  0.4 m cells; gutters (a dark wet channel faded in over 15 cm, roughness 0.22), drains every 6 m
  and two manholes in the same shader. It's lit as if it faced -z: its normal, made in the world's
  frame, was handed to `transformNormalToView`, which turns it again by the mesh's frame, and the
  drawn street was a plane turned flat. Its colours and the look were tuned under that light, so
  the slabs and the street past them keep it (`wetStreet`'s `normal`); lit by a true up normal, the
  slabs came out grey-blue, the reflections washed out (`phase-e/street-lit-up-rejected.png`).
- **The street's reflections** (`wet.ts`). The demo's screen-space reflections don't reach the
  street here: a flat mirror ground showed nothing of the signs, only the rain near the eye (as
  white dashes). So the ground shader reflects the lights itself. Each sign, lit shop and lantern
  is a glowing upright strip (its ends on the ground, from what height to what height, its
  colour); each frame the shader gets the 48 within 30 m of the eye that count most (bright, tall,
  wide), since every street pixel loops over them. For each street pixel, the reflected ray is
  checked against each strip: where it passes, how high it is there, with a spread that grows with
  roughness and distance, much more along the view than across it (hardly any across in a
  puddle). So a sign shows as a streak down the street, sharper in the puddles, × Fresnel. The sum
  is compressed (2.5 × (1 − e^(−sum / 2.5))) and broken up by two noises and the rain rings, so a
  puddle under many lights brightens in streaks and never fills with a flat colour. A lantern
  string was one wide strip: in a puddle it mirrored as a flat red slab; each lantern is its own
  narrow strip now (0.35 m, 0.25). The strips follow the street's power and dim as their pieces
  fall. The ground's material roughness is kept at 0.42 or more.
- **No screen-space reflections**: tried again with this phase's settings (`reflections: {
  strength: 1 }`: rays to 100 m at half resolution) on the street with its roughness let into their
  range (puddles 0.03, wet asphalt 0.16 to 0.24) and `wet.ts` off: the street came out grey, with
  the rain reflected as white dashes, a dithered pattern from the half-resolution pass, hardly any
  of the signs' colour, and green smears in the glass (`assets-src/packs/neon/fix-3/
  street-wet-vs-ssr*.png`, `wet.ts` on the left). So `wet.ts` stays and the reflections stay off.
  The tile's roughness is clamped at 0.45 (as the shutters'), and the glass is a pale dielectric
  (0x3a5060, roughness 0.12, opacity 0.55), so a lit room shows through it. The glass writes depth
  now (three's default), so a blast's dust drifting over a facade fades over the panes as over the
  wall.
- **Shutters**: metalness 0.4 and roughness at least 0.45 (at metalness 1 and the map's low
  roughness, the reflections speckled them with every sign's colour); the corrugation is in the
  normals.
- **The towers behind** (`towerMaterial`): a dark body (0x161c2a) with paler spandrel bands at
  each floor and a parapet line under the roof; windows 1.6 × 3.2 m cells (0.9 × 2.5 m on the
  corner blocks' lower 10 m, seen close from the start), the glass 70 % of the width and 1.5 m
  tall; one in ten lit, each at its own level, brighter at the top, with a curtain or blinds; LED
  bands in 7 m dashes at 1.2 on some, none at street level. Their hashes take shifted integer
  cells (TSL's hash takes a uint: negative cells all hashed the same, which lit whole faces). The
  roof billboards each start from their own place in the atlas, so no two read alike.
- **The avenue** (behind the start): a band of shopfronts at street level across it and on the
  corner blocks (`shopfrontMaterial`: 4 m cells from a small data texture, lit rooms with mullions
  and a counter or shelves under a fascia of glyphs, grey shutters, or dark), awnings over some
  (one instanced mesh), and three scooters on its curbs.
- **Dust and smoke**: the blast's cloud cool grey (`look.smoke`, 0x8c949e, gone a little sooner in
  the rain: life 0.75), and all dust mixed from cool greys with the materials' own colours counting
  for more (`look.dustPalette`, blend 0.6): the default tans read as brown smoke under the night
  light (`fix-3/smoke-warm-vs-cool.png`). Tubes, glass, sheet metal and paper raise little dust
  (`dustAmount`).

## How it stands and falls (final values)

| Material | Changed from the design | Why |
|---|---|---|
| `tile` | support 120 (design 90); fragmentSize 0.4, maxPieces 6, dustSize 0.1 | At 90 three rockets along a ground floor brought the whole facade down from top to bottom. Bigger, fewer fragments and less dust: the big collapses had 9,000 pieces and 6,600 particles. |
| `concrete` | support 120 (design 100); dustSize 0.1 | The same. |
| `render` | support 15 (design 40); strength 6e3, impact 15, dustSize 0.1 | At 40 (and 25) a type B facade spanned the hole over its blown beam as an arch and stayed up whole. At 15 it gives way over the hole. Its joints give once it falls, so it tears up as it lands. |
| `neon`, `lightbox` | maxPieces 4 | Fewer bits when a sign breaks. |

A shophouse facade's pieces come loose a few at a time when its beam goes, and each settled where
it stood, held up by the pieces beside it, even with weak joints. So `peelFacades` (life.ts) gives
each render piece of a front that drops a push out into the alley, more the higher it is (0.25 m/s
plus 0.12 a metre above level 1), as a facade with nothing holding its top back would lean out.
Checked again with this phase's library (piles come to rest sooner, a section turns over the edge
it's out past): a blast on S7's beam puts 7.7 to 11.2 m³ of its render in the street with the push
(4 runs) and 6.8 to 10.0 without (5 runs), and leaves 0.4 to 3.3 m³ lying on the building line over
the shop against 1.8 to 5.3 (`phase-d/s7-beam-push.png`, `s7-beam-no-push.png`). The library does
most of it by itself now, but the push still lays more in the street, so it stays.

**The end block's face over the alley.** The face is 18 m wide, the alley 7.5, and the face's ends
stand behind N7's and S8's end walls, 9 cm in front of it. Coming loose as one strip once the
arcade went, it was held up there by those ends, the billboard on it dark at 8 to 10 m
(`fix-4/end-strip-held-push-alone.png`). So its bands break where its bays do at the alley's edges,
and the face over the alley comes away alone. Last phase `peelFacades` also cut what came loose
over the alley free of the rest of its section and pushed it out; with this phase's library that's
no longer needed, and it's gone. Four rockets at the base, the billboard lying in the alley at the
block's foot at +40 s: with the cut and the push, 7 of 8 runs (in the other it hung at 8.6 m to the
end); without them, 3 of 3; without them and with `dropFront` (below), 8 of 8.

The two front arcade columns alone came out three ways with the library left to it (8 runs): the
front transfer beam held up from the slabs behind and the face on it, the bay standing and the
billboard lit (4); the beam and part of the face going, the rest jammed in its slot between the
bays beside it with the billboard dark at 9 to 11 m (3, `phase-d/arcade-two-columns-library-jammed.png`);
or all of it coming down 10 to 20 s later (1). A transfer beam whose columns are gone carries
nothing (the design has this bay drop), and a dark billboard in mid-air reads as a fault. So
`dropFront` (life.ts): once both front columns' feet (their pieces under level 1) are gone, the
beam and what's left of the columns go, and the face over the alley goes as one section, turning
out about its foot at 0.6 m/s plus 0.25 a metre above level 2, fast enough to clear its slot (at
0.3 and 0.1 it jammed, 1 run). It lies down the alley from the block's foot by +6 to +10 s, in 19
of 19 runs; the floors behind stand as a shell, their lit rooms open
(`phase-d/arcade-two-columns-eye.png`, `arcade-two-columns-above.png`,
`arcade-two-columns-billboard-cut.png`), though in 2 of the 19 part of the bay over the arcade (34
and 43 m³ of about 100) came down after it, as the design has it.

`dropFront` cuts the billboard from the face as well. Held by its joints to the band behind it,
it was left on the level 3 slab, dark at 9 to 10 m, in 3 of 22 runs of four rockets at the base
(a piece or two at 5 m in 3 more), with the buildings behind both rows in the physics or not. Cut
free, it has lain at the block's foot (none of it over 3 m up) in all 24 runs since: 14 of four
rockets at the base and 10 of the two columns.

**The gate.** Its posts are three red boxes each under a tie beam in four and a top beam in five, the
lanterns on cords from the tie beam. A rocket at a post's foot cut its lower two boxes away, and
the top of the post (from 2.6 to 4.8 m) hung on from the tie beam for good, the other post holding
the beams up: the first thing seen from the start (`phase-f/gate-before-30s.png`). So `gateDown`
(life.ts) looks four times a second whether each post still reaches from its foot, bonded to a
street slab, up through its own pieces to the beam; once one doesn't (blown at its foot, chewed
through by the gun, or its slab cratered), the beams, the cords, the lanterns, the board and what
of that post hangs from them are let go as one section, which turns over the post that stands and
lies against it, one end in the street (`phase-f/gate-after-10s.png`, `gate-after-30s.png`; nothing
of the gate over 0.5 m up on that side at +10 s).

**Four rockets along a tower's ground floor take the front bays of every floor and leave the
shell standing** (back and side walls, the slabs' rear rows), as the design's type A item 4 says.
`giveWay` (life.ts), which cracked the rest of a ground floor with a few dozen small blasts once its
front had gone, is gone: watched closely (`fix-3/N7-giveway-old.png`), it never brought a tower
down. It turned the shell loose in place: on N7, 8 m³ of 330 stayed fixed above 2 m, but 220 of the
233 m³ above 8 m was still up there 9 s later, its signs dark (loose pieces don't glow) and a
thousand bodies sitting still for the solver. The library's own weighing doesn't bring it down
either. With the rest of the ground floor's bonds back at their plain strength, 150 m³ stays fixed
above 2 m (127 with nothing done). With the rest of the ground floor crushed to dust, the tower drops
a storey and lands whole (`fix-3/N7-giveway-crush-tried.png`; 160 of the 233 m³ above 8 m stays up
there), since a falling section's joints break only when pulled. With only its front half crushed,
the back half cantilevers it (121 m³ fixed). A whole tower coming down would need the library to
crush what a falling section lands on (see Known issues).

Checked with scripted blasts (screenshots in `assets-src/packs/neon/shots/`, after the first review
in `fix-1/`, after the second in `fix-2/`, after the third in `fix-3/`, after the fourth in
`fix-4/`, with phase D's library in `phase-d/`; phase D ran each of them again, one to four runs
each, and 7 and the end block's four rockets ten or more; with the breakable street, phase E ran
3, 4, 5 and 8 again, `phase-e/`):

1. Upper facade (N3, floor 4): a hole a bay or two wide; the tower stands.
2. One ground-floor column (N7): the column and the fascia over it go; the tower stands
   (`phase-d/n7-one-column.png`).
3. Three along a type A ground floor (S8): its front bays come down into the street, floor by
   floor; the shell stands. A lantern string over it is shaken loose and swings, still lit.
4. A type B's beam (S7): the shopfront and the beam go, and the facade above it leans out and comes
   down into the street in slabs and chunks; the slabs and side walls stand.
5. The bridge (one rocket at its middle): its glass and neon go (dark), and about 1.5 s later what's
   left of its deck, posts and roof comes down into the alley as one section (4 runs,
   `phase-d/bridge-one-rocket.png`). Last phase its ends hung from both facades; with this phase's
   library the whole span goes (why wasn't looked into).
6. The big blade's pier at 6.5 m: the corner above it comes down, and the blade with it.
7. The two front arcade columns: the arcade's front goes, and the face over it comes down into the
   alley with the billboard (`dropFront`, above); the floors behind stand. One rocket at the
   billboard breaks it and the face behind it (`fix-4/billboard-one-rocket.png`; the same this
   phase, one run).
8. Four rockets along N7's ground floor: its front comes down into the alley in a pile reaching
   the far side; the back and side walls stand (`phase-d/n7-four-rockets.png`). Four or six on the
   end block's base: the face over the alley comes down, the billboard with it, and the floors
   above heap across the alley's end (`phase-d/end-four-rockets-eye.png`, `end-four-rockets-above.png`).
9. A lantern string cut at one end (the facade it's tied to blown away): it swings down and hangs
   from the other facade, a diagonal chain of lit lanterns to the street, the lowest under a metre
   up (the strings at x -2 and 17.5, `phase-d/string-cut-hangs.png`).

## The street (the breakable ground)

- **What breaks**: the alley between the facades, from the mouth (x -26, under the gate) to the end
  block's face (30.06), z ±3.75 (`GROUND` in `layout.ts`): wet asphalt 0.18 m deep over a concrete
  base 0.3 m deep, in slabs of 2.55 × 2.5 m (22 × 3 a layer, 132 pieces), on the bed 0.48 m down,
  the earth (`layGround` and `groundMaterials` in `wet.ts`; `Destruction.addGround`). It's laid
  first in `build()`, so what stands in the alley stands on its slabs and goes into a crater with
  them: the gate, the vending machines, the stools, cylinders and boxes, the scooters, carts, crates
  and bins (`clutter` and `placeProps` don't count the slabs as in the way). The buildings stand
  outside it on their own static ground slabs and the band under each facade, so the shops'
  thresholds never move; the lane north, the avenue and the passage east are drawn, as before.
- **The same street, whole**: one shader (`wetStreet`) draws the slabs' tops and the street past
  them (a 240 m plane with the area cut out), so the two meet under the gate without a seam
  (`phase-e/mouth-seam-above.png`). On the slabs the puddles, rain rings, gutters, drains and the two
  manholes go by where on the alley each point was laid (`pieceFrame`), so they stay on the chunks a
  blast throws; only what still stands reflects the signs. The library draws a piece's normals from
  its surface's normal map; `layGround` puts the street's own back on the standing tops (flat in the
  puddles, the rain rings on them), as the plane has them. From the same places, the old street and
  the slabs differ by under 2 of 255 on average, the rain (`phase-e/street-before.png`,
  `street-now.png`, `mouth-before.png`, `mouth-now.png`).
- **A rocket into it** (`phase-e/crater-*.png`): a crater 1.7 to 2.1 m across (2.4 to 3.5 m² open),
  down to the bed in the middle and to the base round it, the chunks thrown out round it (`toss`
  0.55: at the library's 0.4 the big asphalt plates mostly fell back in and hid the hole); +75 to
  +78 street pieces a crater (the cells left standing round it and the chunks), and the panes and
  awnings in reach go as anywhere. The broken asphalt shows its grey aggregate, lighter than the wet
  top, so the rim reads at night. Under it: the earth, darkened, with the rain pooled on it that
  mirrors the signs as the puddles do (`craterWater`; `phase-e/crater-water.png`), and the pit's
  sides where the area ends, asphalt over concrete; both drawn after the street, so where the slabs
  cover them they cost nothing.
- **The player** walks into a crater (onto the base, 0.18 m down, or the bed) and out the far side
  without a stop: the bed is less than a step (0.5 m) down. Steps crunch (`steps.rubble`) on the
  base and the bed (`footstep`), splash (`steps.wet`) on the street.
- **What changed round it**: `groundAt` is the bed in the area; the ground in the world is the bed
  under the area and, round it, boxes reaching 1 m below the bed, so nothing slips under them out
  of a crater; `killBelow` -1.2. The manhole's steam comes from what's under it (a crater's floor,
  rubble: `phase-e/vent-crater.png`); debris landing on the street's pieces splashes, as it did on
  the drawn street.
- **The gun on it**: 70 rounds at the street 6 m off: the first slab gives way at the 6th round, 56
  of 70 break something, down into the base, +96 pieces; 10 s with the trigger held along the street
  chews a trench of broken plates, +220 pieces (+183 standing street pieces;
  `phase-e/gun-street-10s.png`). The street's cells under 16 cm go as spray (`minBodySize` 0.16): at
  the presets' 0.1-0.12 the same 10 s left a strip of standing wedges, +323 pieces. (This phase's
  library bites a pothole instead: see `docs/changelog/phase-f/pile.md`.)
- **The bed is wet earth** (`bed: 'earth'` in `layGround`, the material in `groundMaterials`: the
  crater's floor as the scenery draws it; no piece is made of it): rounds into a crater's floor
  strike as earth, dirt (`bullet.dirt` at 0.85, clods, a pock), into the base's broken sides as
  concrete (`phase-f/bed-floor.png`: three of four into the floor `earth`, one the base's side).
- **Where rounds struck it** (`wet.ts`, `markStrike` from `onShot`): a hole in wet asphalt at night is
  dark on dark, and the demo's mark (a hole, multiplied into what's drawn) hardly showed. So the
  street's shader draws round each strike on its top the pale, dry crushed aggregate a round leaves,
  about 20 cm across, ragged, grainy and matte (no reflections on it), with a dry powder round it to
  40 cm; the demo's hole still darkens its middle. The marks sit in a grid of 0.25 m cells over the
  street (x -46 to 32, z ±12: the alley, past its mouth, the lane's foot), each cell keeping the
  last four that reach into it, so a street pixel reads four (a storage buffer, 1.9 MB, only the
  changed cells uploaded). On slabs they go by where on the alley the point was laid
  (`pieceFrame`), so they stay on a chunk a blast throws; not where a round bit the slab away. From
  4 m at night they read as strikes where before there were black pinpoints
  (`phase-f/marks-eye-zoom.png`, before on the left; `marks-now-zoom.png` close).
- **What it costs**: 132 pieces at load (7,976 in all), two materials (16; the bed's `earth` has no
  pieces, so no mesh). Idle, a collapse's frames,
  its physics steps and its draws are the same as before within the shared GPU's noise (Performance);
  no pipelines made after the card through a crater and 40 rounds into it; no street slab broken by
  what lands on it in any collapse below (asphalt's `impact` 30).

## The machine gun here

What a bullet sounds like on each material (`bullet` in `audio.materials`, at the material's
`pitch`), and so how a strike looks (`materialKind`):

| Materials | Strike | Why |
|---|---|---|
| concrete, the street's asphalt (pitch 0.85) and base | `bullet.concrete` | stone snaps |
| earth (the bed, a crater's floor; pitch 0.85) | `bullet.dirt` | wet earth thuds |
| tile (pitch 1.2), render | `bullet.brick` | glazed tile cracks sharper than render over masonry |
| glass, neon (1.3), lightbox (0.85), lamp (1.15) | `bullet.glass` | tubes and lamps pop higher than panes, acrylic duller |
| steel, signbox (1.25), grate (1.1), shutter (1.2); the scooters and carts (signbox) | `bullet.metal` | sheet rings thinner than steel |
| wood (the gate); awning (1.3), and the crates and bins (props of it) | `bullet.wood` | lacquered wood; plastic knocks |
| lantern (1.4) | `bullet.dirt` | paper on a wire frame thuds |

The chips and dust colours are the world's own (`chips`, `dust`); the street's asphalt chips are its
grey aggregate, and its marks the pale crushed aggregate (The street), so a strike shows on the wet
street at night.

70 rounds at one spot from the street, 6 m off (`phase-e/gun-*.png`): a lit shop's window and the
vending machines' glass go at the first round, then the rounds tear through the menus, counter and
back wall; a shutter is torn open at the first (then the rounds go through into the shop); the gate's
posts at the 2nd, its lanterns at the first; N2's render front at the 3rd (44 to 63 of 70 rounds
break something: a storey's piers and lintels gone, the rooms open; `gun-render-after.png`); tile
columns at the 3rd to 6th; concrete at the 9th; the big blade's lightbox faces at the first, its
sign boxes later; the scooters and carts (props) only dent; the crates and bins skid (a loose crate
0.63 m in 6 rounds), or don't where they stand against a wall. 20 s held across N7's front from
the street brought part of it down in a heap (431 loose at most, the fastest piece 16 m/s, none
past 11 m; `gun-n7-20s.png`).

The shutter's `minSize` is 0.15 (the preset's 0.3): a piece no bigger than 1.5 × its `minSize`
isn't cut, it comes loose whole wherever it's struck, and at 0.3 a 2 m slat (0.28) would be let go
whole by each round; at 0.15 a round holes it where it strikes (`phase-f/shutter-pair.png`).

## Reactions (`life.ts`)

Signs short out in sparks of their colour (at most 6 bursts a second); signs left half hanging
stutter, and the 6 nearest spark every 1 to 3 s. One budget covers every `spark.zap`, from breaks,
the 3 nearest hanging signs and the live cables: 3 a second within 25 m, 1 a second beyond. A paper
lantern that breaks only tears: a quiet, high `wood.impact` (0.3, pitch 1.7; under a blast it's
masked) and a red puff; awnings break with `sheetmetal.impact`. Every blast browns the street's
power out (deeper for bigger, nearer blasts); breaking the transformer box (N5's lane wall, x 5.5,
z 9.7, y 5.4) plays `transformer.blow`, arcs, blacks out on its second bang, stops the buzz, then the
signs come back in steps; the hotel sign on S6 flickers on its own and its buzz follows; up to three
shutters within 14 m rattle; a blast within 9 m of a shutter may start a shop alarm (one at a time,
15 to 25 s); debris landing hard on the street splashes.

**Vents** (the manhole at (12, 0.8), S3's wall exhaust, the slot; the manhole's from what's under
it, a crater's floor once the street there has gone) steam with the effects' `puff`: a
thin cool-grey wisp, a puff every 0.25 s (S3's blowing out into the alley; 1.4 m at 0.5 opacity:
at 1.0 m and 0.22 it didn't show at night, `fix-4/vent-wisp-*.png`), and a jet for 8 s after
a blast within 6 m (a puff every 0.06 s at 3 m/s; `steam.burst` as it starts). Only the nearest
vent hisses (`steam.hiss`, louder while it gushes), within 14 m, stopping beyond 18 m.

**Cables and lantern strings** are steel rods too small to cut: a blast shakes them loose, a round
lets the segment it strikes go whole (the library's, for a piece too small to cut), or a blast
blows away a facade piece one is tied to. Any way (`hangCut`), what's left from each end still tied
hangs there: each segment hinged to the one before (the first to its facade piece) and each lantern
to its joint, all about the level line across the cable, so it drapes, swings and settles; one
still spanning the alley is hinged at both ends and settles back into its sag. The hinges hold
until the facade piece goes. A power cable whose far end is free sparks there every 1 to 3 s while
the street has power. A hung piece at rest (swinging less than 10 cm) isn't counted moving
(`stats.hanging` counts what hangs), so the cables and lanterns hanging after a big collapse (up to
50 pieces at +40 s) no longer hold the HUD's moving count up.

The neon buzz keeps to the 2 nearest lit signs within 12 m and the rain to the nearest awning
within 12 m, the vent's hiss to the nearest within 14 m (past those they're under the rain bed), so
the loops hold at most 7 of the engine's 40 voices at idle (the three ambience beds and four
placed). While the gun keeps firing (8 rounds or more, the last under 0.5 s ago) it drowns the buzz
and the awning's rain: they give their voices to the strikes and fade back in within half a second
once it stops, so under fire the loops hold 4 (70 rounds into N2's front: 7 before, 4 while it
fired, 7 after).
No loop is started while 30 or more voices are playing.

### The gun

`onShot` (each round that strikes something) and `onBurst` (each burst as it ends), in `life.ts`.
Every reaction has its own budget, so a burst of 70 rounds sets off a few of each, not 70. Each was
checked in the page with screenshots (`assets-src/packs/neon/phase-f/`) and counts of what played;
none makes a pipeline after the card.

- **A sign struck** (a tube, a lightbox face, its raceway or backing, a vending machine's front or
  body: any piece of a sign, and the cells cut from it): sparks in its colour where the round struck
  (if it didn't break a lit piece: one that did sparks where it broke, as before) and a `spark.zap`,
  and the whole sign stutters for 0.12 to 0.3 s. After a few rounds (3, and one more for every 30
  pieces of it: the big blade's 74 take 5) it dies: 0.75 to 1 s of hard flicker, dark with bright
  flares, `neon.die` (its buzz stuttering, a pop), then out for good with a last spray of sparks:
  its glow, its streak in the wet street, its buzz, and the point light it stands for
  (`phase-f/sign-hit-dying-crop.png`, `sign-2-dead.png`; the big blade: `blade-strip.png`, its
  magenta light from 30 to 0, stuttering with it on the way). Sparks share the breaks' budget (6
  bursts a second), zaps theirs (3 a second near), `neon.die` 2 a second.
- **A lamp or a lit panel shot** (a shop's ceiling panel, its glowing back wall, a hanging lamp, a
  lit window, the arcade's strip): what of it still glows stutters for 0.1 to 0.35 s and goes out,
  the cells left standing round a shot panel too, so the whole panel dies
  (`phase-f/lamp-wall-pair.png`), with `lamp.pop` (3 a second); a lamp or panel that breaks pops
  where it breaks, in place of a sign's zap.
- **A shutter** rattles in its rails at a round (each at most every 0.7 s, quietly), and at its
  second round a shop's alarm may start (0.6; one alarm at a time, 15 to 25 s).
- **A steam vent** struck within 0.6 m (the manhole, S3's wall exhaust, the slot's foot) gushes for
  6 s with `steam.burst` (`phase-f/vent-crop.png`); **a steam pipe in the slot** shot blows a jet out
  of the hole along its normal for 3.5 s (three pipes at once at most; `phase-f/pipe-strip.png`).
- **A long burst**: once the gun has fired 20 rounds without a pause (1.4 s), the street's power
  browns out as for a blast, a little shallower (0.25 deep, plus up to 0.2 near the middle of the
  alley: the signs, the shops and their streaks in the street dim and stutter for a second,
  `phase-f/brown-pair.png`), and the 2 shutters nearest where it strikes, within 10 m, rattle; again
  every 5 s it goes on. Held 20 s it browned out at 1.4 and 6.5 s, between the blasts' deeper dips.
- **A burst ends** (`onBurst`): after one of 1.5 s or more, a shop's alarm by the shutter nearest
  where most of it struck, within 8 m, may go off (0.35).
- **The street** keeps a pale mark round each strike on its top (The street).

What played (the engine's `play` counted, the sound running in a muted Chrome): 70 rounds into N2's
render front from the alley, 70 `gun.shot`, 70 strikes, 1 brown-out, 3 `shutter.rattle`, 5
`spark.zap`; the trigger held 20 s into the shop fronts 5 m off, the view sweeping, a blast 6 m
off every 5 s (the hooks team's check), 279 of 279 shots played and 273 of 279 strikes, 4
`lamp.pop`, 20 `spark.zap`, 10 `shutter.rattle`, 1 alarm, the voices at 40-41: every shot plays
since the hooks team's fix to the engine, the world's own debris sounds give way.

**Sound by material**: a section of concrete or tile coming down lands with one `concrete.impact`
(render: `brick.impact.large`, sign boxes `metal.impact.large`, shutters `shutter.rattle`), louder
and lower the heavier, instead of its pieces' patter (`land`); glazed tile's chips clink as
`glass.debris` at 0.7 of its pitch. **Footsteps** (`footstep`, `audio.footsteps.surface`): the wet
street's `steps.wet`; dry `steps.asphalt` under a slab or a ceiling within 7 m (in a shop, in the
arcade; not under an awning or the bridge); `steps.metal` (Brick Street's pack) on a sign box, a
grate, steel or a fallen shutter; `steps.rubble` on other rubble, and down in a crater on the
concrete base and the bed.

**The bed**: recorded standing at the start after the pack-settings fix (the city loop now at its
pack's 0.3 × 0.4 here), 20 s from the engine's output: the quietest 40 % at -32.5 LUFS, integrated
-32.1, about the -33 every world's bed is set to; the levels in `audio` stay as the mix set them.

## Assets

- Textures, sky, props and sounds from this world's pack (`public/packs/neon/`, see its
  `CREDITS.md` and the reports in `assets-src/packs/neon/`). For the gun's reactions (phase F):
  `neon.die`, `lamp.pop` and `steam.burst`, two Stable Audio takes each ($0.23 in all, in the
  ledger), judged by their spectra and envelopes (no paid audio check); the first `lamp.pop` take
  hummed on after its pop, so `prep-sounds.py` cuts it to the pop. From the base pack: the broken-face
  maps `gen_concrete_broken` and `gen_brick_broken`, the gate's `gen_wood_painted`, and its
  sounds (explosions, concrete, glass, metal, wood, collapse, dry and rubble footsteps, wind). From
  Brick Street's pack (`packs/nyc/sounds/`, which holds only that): `steps.metal`.
- The earth under the street, a crater's floor: Poly Haven's `rocky_trail_02` (CC0), the same maps
  as Market Town's, copied into this pack (`CREDITS.md`). No paid calls this phase.
- **Props**: five models, the scooter, the crates and the bin with tintable paint (`paint` in
  `scripts/assets/packs/neon/props.mjs`, made by `process-props.py`; the cart's bulb is its `glow`),
  each copy tinted in `props.ts`: scooters red, charcoal, powder blue, butter yellow or the model's
  mint; crate stacks' red stack green or yellow; loose crates blue or yellow; bins grey or blue.
  They were nine recoloured copies on top (8.8 MB of models; 3.5 MB now). `props-post.py` still
  blanks the scooter's plate and paints the cart's spokes after `process-props.py`, keeping the
  colour map's alpha (the paint mask); `props-night.py` renders the tints as the game gives them.
- Made in code here: the glyph atlas, the street's (`wetStreet`, the crater's water) and the towers'
  shaders, the night sky's colours, the grating of the caged balconies.
- The wet asphalt set (`neon_asphalt`, the puddles in its maps) isn't published: its puddles
  repeat every 4 m down the alley. Its raw is the source of `neon_asphalt_dry` and of the puddle
  mask (`textures.py`).

## What to tune

- `look.bloom` and the emission strengths in `materials.ts`: tubes should keep their shape inside
  their halo; lower the bloom before the emission.
- The tile / concrete / render `support` (table above) if blasts take too much or too little.
- `GLOWING` strengths: bright reds go salmon under tone mapping, so the lanterns are a deep red
  (0xc01005) at a low strength; lower still makes them dull.
- `wet.ts`: each kind's strength in `collectStrips` (signs 1.4, lightboxes 0.9, shops 0.5, each
  lantern 0.25), `MAX` and `RANGE` (48 strips within 30 m), the spreads and the knee (2.5) in
  `signReflections`; in `glints`, how much of it the street takes (0.85 outside the puddles, 1.25
  in them) and the breakup, and in `craterWater` how much a crater's water takes (0.7).
- `GROUND` in `layout.ts`: the street's area, its layers' depths (a bed deeper than a step, 0.5 m,
  means a jump out of a crater), its slabs' size (`cell`: bigger, fewer pieces and blockier
  craters) and how far a blast throws its chunks (`toss`). The asphalt's and base's `minBodySize`
  (`groundMaterials` in `wet.ts`): what of them a bullet or a blast leaves standing as bodies and
  what goes as spray.
- The dust colours (cool, light: the neon and the hemisphere light them), `look.smoke`,
  `look.dustPalette` and `dustAmount` in `index.ts`.
- `LIGHTS` in `life.ts`: the four point lights. `WISP` and `JET`: the vents' steam.
- The gun's reactions (`life.ts`): `toKill` (rounds before a sign dies), the long burst's 20 rounds
  and 5 s, each sound's budget; `MARKS` in `wet.ts` (the strike marks' grid and size) and their look
  in `wetStreet` (the crushed aggregate's colour, the powder).
- In `life.ts`, how hard a dropping shophouse front leans out (`peelFacades`: 0.25 m/s plus 0.12 a
  metre) and the end block's face turns out (`dropFront`: 0.6 m/s plus 0.25 a metre; slower, it
  jams in its slot).
- `panel` and `STATIC` in `buildings.ts`: how big the slab panels are, by level.
- Paint: the tints in `props.ts`.

## Performance

Measured with the finished code on the shared GPU, with other agents' Chromes on it, alternating
with Brick Street (`?world=nyc`, four rockets along its biggest building's ground floor) load for
load: 30 Neon Alley loads (six of them the end block's four rockets) and 8 of Brick Street's.

- Idle at the start, median frame: 16.7 to 28.9 ms, 19.3 the median (Brick Street 16.9 to 28.3,
  18.3).
- The first rocket's worst frame: 44 to 175 ms at the end block, 44 to 261 over every case (Brick
  Street 42 to 127).
- Four rockets at the end block's base, from the first to 10 s after the last: 15 to 110 frames
  over 40 ms of 402 to 647, worst 47 to 175 ms, mean 20.2 to 32.8 (Brick Street's four: 18 to 124
  of 358 to 559, worst 75 to 148, mean 23.4 to 36.6). Earlier this phase, over 35 four- and
  six-rocket runs at the end block, the worst frame was 62 to 245 ms. The worst frames are the
  GPU's and swing with the other agents' load, Brick Street's as much.
- `dropFront` looks at the arcade's four column feet each frame, and over all the pieces once,
  when it fires.

**With the breakable street** (phase E): the code before it and with it, each a production build
served to the same Chrome in turns, the GPU shared with other agents' Chromes and at times out of
memory (runs with errors left out).

- Idle at the start, vsync off, 8 s: 3.5 to 5.4 ms a frame on average before (median 3.8 to 4.7),
  3.3 to 3.9 with the street (3.6 to 4.2); Brick Street alongside 2.7 to 3.3 (2.2 to 2.8).
- Four rockets at the end block's base, from the first to 10 s after the last: 24 to 41 ms a frame
  on average before and 29 to 36 with the street, 5 to 167 frames over 40 ms against 87 to 140
  (five pairs in turns; Brick Street's four alongside 20 to 36 ms, 6 to 141): the GPU's load swung
  through all of it. Timed apart, 2 s after the last blast with the frame loop stopped (40 physics
  steps, then 40 frames drawn, each waited out on the GPU): a step 7.3 to 9.4 ms (median) before,
  7.8 to 9.0 with the street, 6.9 to 9.4 with 5 m slabs (44 pieces); a frame drawn 3.1 to 4.4
  against 2.3 to 4.9. The street costs nothing measurable in a collapse.
- Loose at +10 / +20 / +40 s with the street: the end block's four 696 to 1,390 / 118 to 626 / 0 to
  60 (before, the same runs: 977 to 1,123 / 230 to 368 / 0 to 2; see Known issues for its slow
  heap); N7's four 1,054 / 637 / 0; S8's three 662 / 72 / 1; S7's beam 28 / 0 / 6, its front in the
  street. The bridge's deck falls 1.5 to 1.8 s after the rocket under it, with the street or not
  (4 runs each, timed in the simulation's own time). No street slab broke in any of them.
- The gun held 20 s across N7's front from the street: 22.8 ms a frame on average, 49 frames over
  40 ms, the worst 103 ms; Brick Street's wall held the same way, later, the GPU busier: 30.5 ms,
  180, 128 ms.

**With the gun's reactions** (phase F), in turns with Brick Street on display :103, the GPU shared
with up to 17 other Chromes: the machine's load went from 9 to 80 through the day, and runs made
with it over about 15, or with the GPU out of memory, are left out (most of them). The fair ones:

- Idle at the start (8 s, vsync on), four pairs: 21.5 to 29.0 ms a frame on average, median 17.7
  to 31.3 (Brick Street alongside 19.3 to 24.1, 17.0 to 25.8).
- The gun (phase E's check: 70 rounds into a concrete wall 6 m off, then the trigger held 20 s
  while the view sweeps 0.6 rad), two pairs: standing there 20.3 and 26.8 ms (Brick Street's brick
  wall 18.6 and 25.9), the burst 20.7 and 29.6 (18.1, 29.5), the sweep 23.8 and 30.1 (21.1, 32.3),
  39 and 134 frames over 40 ms in the sweep (20, 174), the worst 105 and 116 ms (139, 105). The
  destruction's CPU while sweeping 1.9-2.1 ms a frame on average (Brick Street 2.1-3.9). No
  pipelines made after the card in any of them; no piece let go faster than 20.2 m/s.
- The end block's four rockets (the signature collapse), four runs: loose 859 to 1,331 / 149 to
  748 / 0 to 29 at +10 / +20 / +40 s (before this phase 696 to 1,390 / 118 to 626 / 0 to 60), none
  under the ground, the farthest 37 to 40 m; 95 to 144 frames over 40 ms from the first rocket to
  +10 s, the worst 147 to 199 ms (Brick Street's four alongside: 197 to 873 / 10 to 82 / 0, 28 to
  162 frames, 79 to 209 ms). The end block's heap is several times Brick Street's.
- The world's own code (`update`, timed in the page): 0.2 ms a frame on average standing, through
  that collapse and through 20 s of held fire (p95 0.3-0.4 ms, one frame of 3.9 in the collapse);
  `onShot` 5 µs a round, 0.2 ms at most.

**The loose cap** is the demo's 3000 (the world sets no `maxLoose`). This phase's library
freezes piles sooner, so four rockets at the end block peak at 1,136 to 1,705 loose (39 runs; 2,652
to 2,989 before) and six at 1,728: a cap of 2000 changes nothing there. Eleven rockets a second
apart (the end block's base, then N7's and S8's ground floors) peak at 2,604 to 3,030. A cap of
2000 holds them at 1,998 to 2,040 by taking the smallest pieces out, so the heap ends 900 to 1,300
pieces lighter (9,373 to 9,577 pieces left against 10,402 to 10,641), and the frames are no
better: from the first rocket to 10 s after the last, 74 to 118 frames over 40 ms of 668 to 743
against 66 to 148 of 649 to 841, worst 138 to 261 ms against 159 to 183, mean 27.4 to 30.3 against
24.0 to 31.0 (three runs each, alternated; two each earlier: over 40 ms 198 to 233 against 172 to
217). Both are at rest by +40 s (0 to 2 loose). So it stays at 3000.

## Known issues

- **Whole towers don't come down.** Four rockets take a tower's front bays and leave the shell;
  the design's first plan (four bring the whole tower down) needs the library to crush what a
  falling section lands on, or a structure that has lost its ground floor to give way in
  compression (see How it stands and falls). Library request.
- **`dropFront` lets the arcade's front go by hand.** The library holds a transfer beam whose
  columns are gone, and the face on it, up from the floors behind, or lets part of it go to jam
  between the bays beside it (How it stands and falls). Holding it may be fair for a frame like
  this; the jam isn't. Library request: a section let go in a slot as wide as itself comes down
  through it.
- **A strip of the face can come to rest on end.** In 1 of the last 10 runs of the two arcade
  columns (the one where part of the bay behind came down too), a tall strip of the face over the
  alley landed upright in the alley and stayed standing there, at rest
  (`phase-d/arcade-two-columns-strip-on-end.png`). Not looked into further. The other 9 showed
  nothing like it, nor did the last 6 runs of four rockets at the base (seen in their screenshots;
  in 6 of the 9, counted: nothing lying over 4 m up in the alley but bits on the facades' signs
  and ledges).
- **`glow.ts` reads the fragment mesh's `pieceInfo` attribute** for the body slot of the piece
  drawn (its own per-piece light: the curtains unlit beside lit windows, lamp levels, the flicker,
  the lightboxes' atlas places). The library's accessors give a piece's state, tint and frame but
  not its slot, or values of a world's own. Library request: a `pieceSlot()` node, or a few floats
  per piece a world can write.
- A swinging lantern doesn't show in the wet street (`wet.ts` reflects what still stands).
- The vending machines are pieces, not a glowing prop: no model without a paid generation.
- **The end block's heap is sometimes slow to settle** (library). After four rockets at its base
  (14 runs this phase, the last 6 with the finished code): 867 to 1,296 pieces loose at +10 s, 201
  to 896 at +20 s, and at +40 s none in 7 runs, 1 to 14 in 4, and 55, 104 and 196 in the others:
  pieces lying high in the heap and on the block's floors (195 of the 196 over 3 m up, 8 of them
  moving over 5 cm/s; 103 of the 104 over 3 m up, none moving), not frozen while a few round them
  still creep.
  The one run counted at +60 s had none left (4 at +40). Brick Street's four: 0 at +40 s in all 17
  runs this phase. Before this phase: 1,198 and 24.
- **A few small cells still go through the street** (library: no continuous collision). Tile cells
  14 to 31 cm across now and then go 1 m or more under it and are taken out (since the breakable
  street, 1.2 m down: `killBelow`; 50 m before; S8's three rockets leave 3 or 4 at rest between the
  bed and that, out of sight). With the
  finished code: 0 to 3 in the end block's four rockets (3 in one run of six), 0 to 2 in eleven
  rockets (six runs), 3 in N7's four and 10 in S8's three (one run each), none in the other cases;
  Brick Street's four alongside, 0 to 6 (8 runs). Earlier this phase: 1 to 11 in 8 of 35 end block
  collapses, 10 to 19 in eleven rockets. Before this phase: 50 to 200 a collapse. The bed under the
  street is 1 m deep and the ground round it reaches 1 m under the bed.
- Pieces are still thrown, at up to `maxSpeed` (library): the farthest 39 to 95 m from the centre,
  none past 120 m in any run this phase (before, dozens past 10 km in 7 of 22 runs); later than 4 s
  after the last rocket at most 3 pieces a collapse moved faster than 25 m/s (in one eleven-rocket
  run of the last six, none in the end block's).
- **The gun's reactions go by where a round struck, not by what it hit inside a sign**: a sign dies
  after a few rounds anywhere on it (its raceway or backing included), however many of its tubes
  are left; S3's wall exhaust has no piece of its own (a round within 0.6 m of where it steams,
  which is on a flat sign over an awning, gushes it and counts against the sign).
- **The strike marks** are on the street's top only (the base's broken faces and the bed take the
  demo's hole and pock), and a 0.25 m cell keeps the last four that reach into it: a fifth round
  within a cell clips the oldest mark at the cell's edges (where the gun bites the street away
  anyway).
- **The gate's beams come to rest against the post that stands**, one end in the street, rather
  than flat (they turn over its top); the lanterns go down with them.
- **The street is lit as if it faced -z** (Light): kept, as the look was tuned under it. Lighting
  it from above would need its colours tuned again (`phase-e/street-lit-up-rejected.png`: the slabs
  lit so, before the fix, grey-blue and the reflections washed out).
- Thin asphalt plates now and then come to rest on edge round a crater (library, as on Brick
  Street).
