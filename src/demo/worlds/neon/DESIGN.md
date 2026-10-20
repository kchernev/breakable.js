# Neon Alley: design

A narrow alley at night in a dense East Asian-inspired megacity, in the rain. Tile-clad concrete
towers and older rendered shophouses, 4 to 8 storeys, stand close on both sides. Their fronts carry
neon glyph signs, blade signs, lightboxes, AC units, pipes and roller shutters. A glass footbridge
crosses overhead, cables and strings of paper lanterns sag between the facades, and a taller block
with a lit arcade closes the far end. The street is wet asphalt that reflects the neon. The light
comes from emissive materials and bloom, plus four point lights.

The builder follows this document. The asset makers follow sections 4 to 6. Numbers marked
"start" are first guesses: tune them with scripted blasts and screenshots, then note the final
values in README.md.

Files (src/demo/worlds/neon/): `meta.ts`, `index.ts`, `layout.ts` (the constants below and the lot
list), `buildings.ts` (types A, B, E), `signs.ts` (glyphs, neon tubes, blades, lightboxes, the glyph
atlas canvas), `street.ts` (gate, bridge, cables, lanterns, awnings, shutters, vending machines),
`materials.ts`, `scenery.ts`, `props.ts`, `life.ts` (reactions and the per-piece light buffer),
`README.md`.

meta: `{ id: 'neon', title: 'Neon Alley', blurb: 'A rain-soaked alley in a megacity at night: tiled towers, stacked neon signs, a footbridge overhead.', order: 3 }`.

---

## 1. The place

### Frame and constants

- y up, ground at y = 0 everywhere (`ground: 0`, `groundAt = () => 0`). There are no curbs, as in
  a real back alley: the asphalt runs from facade to facade, with a gutter strip drawn along each
  facade (scenery only).
- The alley runs along x. The facades stand at **z = +3.75 (north row) and z = −3.75 (south row)**,
  so the alley is 7.5 m wide. With buildings 16 to 26 m tall, it is a canyon about 1:3.
- The breakable part spans **x −26 … 38, z −12.75 … 12.75** (64 × 25.5 m). The gate at x = −25.6 and
  the balconies stick out a little.
- Storey heights are the same in every building, so ledges, the bridge and the cables line up:
  - ground floor `H0 = 3.6`, upper floors `H = 3.0`, slab `ts = 0.24`
  - the bottom of level k's slab: `y0 = 0` (the ground slab, static), `yk = 3.6 + 3.0 (k − 1)` for k ≥ 1
  - so level 3 is at y 9.6 … 9.84. The bridge deck uses this level.
- Neighbouring buildings are 0.06 m apart, so each is a separate structure (as in Brick Street).
- Lot-local frame (as in Brick Street's `building()`): `lx` runs along the alley from the lot's
  start, `ly` up, `lz` into the building from the facade. `side` is +1 for north and −1 for south,
  and world z = side × (3.75 + lz).

### Plan (metres; x along the alley, z across it)

```
        z
  +12.75 ┌──────────────── back of the north row (unbreakable back towers from z 14) ─────────────┐
         │  N1 A7    │ N2 B4  │  N3 A8    │ N4 A6  ║lane║ N5 A7  │ N6 B5 │    N7 A6     │        │
         │ −26…−19   │−19…−13 │ −13…−5    │ −5…2   ║2…6 ║ 6…13   │13…19  │   19…30      │   E    │
  +3.75  ├───────────┴────────┴─────▲─────┴──[BB]──╨────╨═[BRIDGE]┴───────┴──────────────┤  A8    │
  gate ┆ │      alley (asphalt, wet, puddles)       x 6.4…8.8 at y 9.6           arcade ──►│ 30.06… │
  x −25.6│  ◆ start (−30, 0, −1)  lantern strings at x −14.5, −2, 17.5 (y 6.4)            │  38    │
  −3.75  ├───────────┬────────────┬──┬────────┬───────┬═[BRIDGE]┬────────┬──────┬────────┤ z ±9   │
         │  S1 B4    │  S2 A7     │sl│ S3 A8  │ S4 B5 │ S5 A6   │ S6 A7  │S7 B4 │ S8 A6  │        │
         │ −26…−20   │ −20…−12.5  │ot│ −11…−4 │ −4…2  │ 2…9     │ 9…16   │16…22 │ 22…30  │        │
  −12.75 └───────────┴────────────┴──┴────────┴───────┴─────────┴────────┴──────┴────────┴────────┘
     x: −26                                         0                                     30     38
  A7 = type A, 7 floors. B = shophouse. [BB] = the big blade sign. ◆ = player start.
```

| Lot | x range | Type | Floors | Depth | Look | Notes |
|---|---|---|---|---|---|---|
| N1 | −26.0 … −19.0 | A | 7 | 9.0 | white tile | blade at x −22.5 |
| N2 | −19.0 … −13.0 | B | 4 | 8.0 | mint render | rooftop billboard facing −x |
| N3 | −13.0 … −5.0 | A | 8 | 9.0 | salmon tile | caged balconies on floors 2, 4, 6 |
| N4 | −5.0 … 2.0 | A, corner | 6 | 9.0 | pale blue tile | **big blade** at x 0.9; lane facade on its east side |
| (lane) | 2.0 … 6.0 | | | | | cross lane north to the unbreakable lane beyond z 12.75 |
| N5 | 6.0 … 13.0 | A, corner | 7 | 9.0 | pale green tile | bridge's north end; transformer box on its lane wall |
| N6 | 13.0 … 19.0 | B | 5 | 8.0 | cream render | |
| N7 | 19.0 … 30.0 | A | 6 | 9.0 | ochre tile | 4 bays; rooftop water tanks and billboard |
| S1 | −26.0 … −20.0 | B | 4 | 8.0 | pink render | noodle bar with awning |
| S2 | −20.0 … −12.5 | A | 7 | 9.0 | white tile | |
| (slot) | −12.5 … −11.0 | | | | | 1.5 m dark slot: pipes, cables, steam vent |
| S3 | −11.0 … −4.0 | A | 8 | 9.0 | pale blue tile | wall steam exhaust at (−7.5, 3.2) |
| S4 | −4.0 … 2.0 | B | 5 | 8.0 | pale yellow render | food cart (prop) in front |
| S5 | 2.0 … 9.0 | A | 6 | 9.0 | salmon tile | bridge's south end |
| S6 | 9.0 … 16.0 | A | 7 | 9.0 | pale green tile | 4 vending machines; flickering hotel sign |
| S7 | 16.0 … 22.0 | B | 4 | 8.0 | mint render | rooftop billboard facing −x |
| S8 | 22.0 … 30.0 | A | 6 | 9.0 | white tile | |
| E | x 30.06 … 38.0, z −9 … 9 | A with arcade | 8 | 7.94 (along x) | dark grey tile | faces −x; lit arcade at z ±2.4 under a transfer beam; billboard |

Neighbouring lots end exactly where the next begins. The builder subtracts the 0.06 gap, as
Brick Street does with `W = width − 0.06`.

### The player and the sight lines

- **Start**: feet `[−30, 0, −1.0]`, look `[6, 7.5, 0.5]`. The player stands on the avenue side of
  the alley mouth, just outside the lantern gate. The gate frames the view down the alley.
- **Main sight line (+x)**: the gate, then blade signs that alternate sides at x −22.5 (N), −16
  (S), −9 (N), 0.9 (N, the big blade), 5 (S), 11 (N), 15 (S) and 25 (N). Then the bridge's glowing
  underline at x 6.4 to 8.8 and y 9.6, with the lantern strings and cables crossing between. At the
  end, the end block's billboard (y 8 to 11) above its glowing arcade. Each sign has to read
  against the ones behind it: at most two colours per sign, and neighbours in different colours.
- **From the crossroads** (x 4, z 0): north up the lane between N4's and N5's lane facades, with
  their blade signs and the transformer box. The lane continues as unbreakable scenery into the fog.
  South: the S5 facade with the bridge landing above.
- **Looking up**: a narrow strip of overcast sky lit by the city, cut by cables, with the back
  towers' rooftop billboards (unbreakable) glowing beyond the roofs.
- **Looking back west** from under the bridge: the gate's lanterns, and across the avenue the big
  lightboxes on the far facades (unbreakable).

### Landmarks (breakable)

1. **The big blade** (N4): a vertical lightbox sign 12 m tall, the brightest thing in the alley.
2. **The footbridge** (between N5 and S5, level 3): a glass box on steel, with a cyan neon
   underline. It is the obvious target.
3. **The lantern gate** (x −25.6): red-lacquered wooden posts and beams with five lanterns.
4. **The end block and its arcade** (E): an 8-storey block across the alley's end. Its two lower
   floors are open in the middle under a transfer beam. Taking the beam's supports drops the block's
   middle into the arcade.
5. **The transformer box** (N5's lane wall, y 5.4): breaking it blacks out the neon (section 7).

### Props (where they stand)

- 7 scooters: 2 in front of S1 (x −24 … −21), 3 in front of N3 (x −11 … −8), 2 in front of S6/S7
  (x 15 … 18). They stand 0.6 to 1.0 m from the facade, turned 30 to 40° to it, in groups.
- 2 food carts: S4 front (x −1.0, z −2.6, serving side +z) and N7 front (x 24, z 2.7, serving side −z).
- 6 crate stacks: by shop doors (S1, N2, N6), at the slot's mouth (x −11.75, z −3.2) and two under
  the bridge.
- 3 bins (only if the 4th Meshy generation is spent on them): near the slot and by S8.
- Place them as `nyc/props.ts` does: check the collider bounds against what stands, and try again
  where they would overlap.

### Distant scenery (unbreakable: `scenery.ts`)

- **Ground**: asphalt 240 × 240 m at y = 0, with a fixed physics box under it (friction 0.8; wet
  asphalt is a little slippery). Drawn with `neon_asphalt` and the puddle and ripple shading
  described in section 3. Also drawn: concrete gutter strips 0.35 m wide along both facades at
  y 0.004, dark drain grates every 6 m, and two manhole covers (one is the steam vent at
  (12, 0, 0.8)).
- **Back rows** (canyon walls behind both rows): boxes at |z| 14 … 30, x −45 … 50, 26 to 60 m tall,
  so the sky strip stays narrow. They are drawn with a window-grid material like Brick Street's
  `towerMaterial`, but at night: most windows dark, 15% lit cool fluorescent (0xcfe6ff), 8% warm
  (0xffc890). The grid also has horizontal emissive LED bands every 3 to 4 floors on some towers,
  and AC-unit dots.
- **Rooftop billboards** on the back rows: emissive planes 6 × 4 to 12 × 6 m, facing the alley
  (±z), at 25 to 40 m. They use the glyph-atlas texture (section 3) in the neon palette. They glow
  over the alley's roofs.
- **Far skyline**: towers 60 to 180 m tall at |z| 40 … 150 and beyond both ends, fading into the
  fog. They have red aircraft beacons that blink (update sets a uniform; 1 s period, 0.15 s on).
- **The avenue** (west, behind the start): a road 14 m wide along z at x −44 … −30, and facades
  across it at x −46 with big lightbox billboards. A few headlight and taillight pairs (small
  emissive quads) pass along the avenue every 4 to 10 s, moved in `update`.
- **The north lane beyond z 12.75** (x 2 … 6): unbreakable narrow facades with a few static signs,
  running into the fog.
- **Beyond the arcade** (x > 38): a short lit passage, 20 m of static facades with warm light,
  then fog.
- **Beyond the slot** (x −12.5 … −11, z < −12.75): a dark wall with one lit window.

### Piece budget (target about 6,600; hard ceiling 8,000)

| What | Count | Pieces (approx.) |
|---|---|---|
| Type A towers (10) | ~290 each | 2,900 |
| Type B shophouses (5) | ~170 each | 850 |
| End block E | | 450 |
| Neon and lightbox signs (flat, blades, the big blade, billboards) | | 750 |
| Lit-window panels (35% of upper windows) | | 150 |
| AC units with brackets, pipes, rooftop tanks, frames and masts | | 220 |
| Shutters, shopfront interiors (lamps, counters, menu boards) | | 110 |
| Bridge 52, gate 25, cables 70, lantern strings 40, awnings 60, vending machines 20 | | 270 |
| **Total** | | **≈ 6,700** |

If the total comes out over 8,000, cut in this order: interior columns in buildings 7 m wide or
less; back walls in panels up to 2.4 m; one floor off N3 and S3; lit-window panels down to 25%.
Report `demo.stats()` after building.

---

## 2. How each structure is built, stands and falls

General rules from Brick Street apply. Neighbours share faces exactly: compute positions from the
same numbers, never with offsets. Nothing overlaps. No piece is longer than about 2.3 m; split
anything longer into equal runs (`runs(length) = max(1, round(length / 2.2))`). Ground slabs
(level 0) are `static: true`. Tilted or edge-touching parts are joined with `d.bond`.

### Type A: tile-clad concrete frame (10 towers and E)

This is a concrete frame clad in tile. It fails at the ground-floor columns and comes down in
chunks. It does not peel the way a brick facade does.

- **Slabs** (concrete), level k = 0 … N: panels from lz = t to D (t = 0.30), split
  `nx = round(W / 2.2)` along x and `nz = round((D − t) / 2.2)` deep. For W 7 and D 9 that is 3 × 4
  panels. Unlike Brick Street, **the front panels butt against the band's back face (lz = t)** and
  bond to it, so the facade is tied to the floors (a frame, not a curtain).
- **Band** (tile, `tint` = the building's tile colour): at every level k ≥ 1 there is a band piece
  per bay, `ly yk … yk + ts`, `lz 0 … t`. A lip of the same width runs 0.10 m proud
  (`lz −0.10 … 0`, ts + 0.12 tall) on towers with balconies or signs on the bands. Signs and
  balconies are bonded to it.
- **Upper floor k** (yb = yk + ts, fh = H − ts = 2.76):
  - Columns (tile), 0.45 along x by t deep: at both ends, and at bay lines when W ≥ 8.5 (every
    3.5 to 4 m).
  - Bays: `bays = round((W − 2·0.45) / 2.3)`. Each bay is:
    - a **spandrel** (tile), from yb, 0.90 tall, full bay width, lz 0 … t
    - a **glass pane** (glass), from yb + 0.90, 1.50 tall, width (bay − 0.10), 0.03 thick at
      lz 0.12. It sits on the spandrel.
    - a **head** (tile), from yb + 2.40 to the band above (0.36 tall). It is carried sideways by
      the columns and neighbouring heads, and from above by the band.
    - Optionally two **mullions** (steel, 0.05 × 1.50 × 0.06) at the pane's ends. Use these only on
      E and N7, to save pieces.
  - **Back wall** (concrete): panels of at most 2.2 m, full floor height, lz D − t … D.
  - **Side walls** (concrete): at lx 0 … t and W − t … W, between lz t and D − t, in panels of at
    most 2.2 m. On the corner buildings, the lane side's first two bays from the alley are a facade
    module turned 90° (columns, spandrels, glass, heads), so the lane has windows and a blade sign.
  - **Interior column** (concrete, 0.40 × fh × 0.40), one per floor at (W/2, lz D/2), under a slab
    panel. Its top face touches the panel's underside.
- **Ground floor** (yb = ts, fh0 = H0 − ts = 3.36):
  - Columns (tile, 0.45 × 3.36 × t) at the ends and every 3.5 to 4 m. These are **where the
    building fails**.
  - A **fascia** (tile) between the columns: 2.85 … 3.6, cut into pieces of at most 2.2 m. It
    carries a flat neon sign or a lightbox strip.
  - The **shopfront** under the fascia is one of two kinds (about 50/50, seeded):
    - a lit shop: glass panes of at most 1.8 × 2.6 with a door gap, two `lamp` ceiling panels under
      slab 1, a counter (signbox, 2.0 × 1.0 × 0.6) and a menu lightbox (2 pieces of 1.8 × 0.6) on
      the back wall at y 2.0
    - a roller shutter (see Street parts below)
- **Facade extras**:
  - **AC units** under 25% of the windows: a signbox box 0.80 × 0.50 × 0.30 sitting on two steel
    brackets (0.05 × 0.05 × 0.35) that touch the spandrel face. Bond the unit to the brackets
    (face contact on their tops).
  - A **drain pipe** on one column of every other tower: an octagonal prism (r 0.06) in 1.5 m
    segments, a flat face against the column.
  - **Lit-window panels** in about 35% of the windows: a `lamp` panel (window width − 0.1) ×
    2.2 × 0.02, standing on the slab at lz t + 0.5, tinted warm 0xffd9a8, cool 0xcfe6ff or pale
    pink 0xffc8dc.
  - **Caged balconies** (N3 only, floors 2, 4, 6, middle two bays): a concrete slab 1.0 deep
    bonded to the band lip, a steel railing 1.0 tall, and `grate` cage panels up to the head.
- **Roof**: a concrete parapet 1.0 tall and t thick on all four sides, in pieces of at most 2.2 m.
  On top, 1 or 2 of: a water tank (signbox cylinder r 0.6, h 1.4, on a 4-leg steel stand 0.8
  tall), AC condensers (signbox 1.0 × 0.8 × 0.5), an antenna mast (steel 0.08, 3 pieces of 2 m).
- **How it should behave** (check each with `demo.blast` and a screenshot; tune `support` on tile
  and concrete):
  1. A rocket on an upper facade punches a hole one or two bays wide: spandrels, heads, glass and
     the sign there. Glass breaks further out (reach 3). The building stands.
  2. A rocket on one ground-floor column takes the column and the fascia. The building stands:
     the slabs and bands carry the floors above sideways.
  3. Two or three rockets along the ground floor drop the front 2 to 4 m of the floors above that
     span, floor by floor, onto the street, and the rear stands. The weakest bonds should be the
     band-to-slab and slab-to-slab bonds in the front row. If the front never comes down, lower
     concrete `support` toward 70. If one rocket already drops it, raise it.
  4. Four rockets along a ground floor take down the front 3 to 4 m of every floor; the rear
     frame (back wall, interior column, the slabs' rear row) stands as a gutted shell. (The first
     plan had four or more bring the whole tower down; the frame's support that would take also
     drops towers from single blasts. See README.md.)
- **E's arcade**: ground and first floors are open between z −2.4 and 2.4 for the whole depth.
  A transfer beam (concrete, 0.6 deep, 3 pieces) at y 6.0 … 6.6 spans z −2.85 … 2.85 under level
  2, at the facade (x 30.06) and at x 34 and 37.5. Arcade columns (tile, 0.45 square) stand at
  z ±2.4 … ±2.85 under each beam. Tile the arcade's inner faces. Put a lamp strip along its
  ceiling (lamp material, cool white) and a point light. Two rockets on the two front arcade
  columns should drop the block's middle bay, floors 2 to 8, into the arcade.

### Type B: rendered masonry shophouse (5 buildings)

Build these the way Brick Street builds its walk-ups. The facade is free-standing render masonry,
and it **peels away as a sheet** when its base goes.

- **Slabs** (concrete) **stop 0.02 short of the facade**, as in Brick Street. The facade is tied
  in only at its corners, through the side walls.
- **Facade** (render, `tint` = the building's colour), 0.30 thick: piers, sills (0.9) and lintels
  around 2 windows per floor. Each window is a steel frame of four bars, two glass panes and a
  sash bar. Floor 1 also has a steel security grille of 3 vertical bars (0.03 square) in front.
- **Ground floor**: one wide opening (W − 2 × 0.5) between end piers. A **steel beam**
  (0.30 × 0.40, in pieces of at most 2.2 m) at y 3.0 … 3.4 carries the whole facade above,
  resting on the end piers. Under the beam is either a shutter or a lit shopfront (as in type A).
- **Walls**: render side walls and back wall in panels of at most 2.2 m. No partitions.
- **Roof**: parapet as in type A. N2 and S7 carry a rooftop billboard (section 2, Signs).
- **How it should behave**: a rocket on an end pier or the beam lets the upper facade fall
  outward or straight down as a crumbling sheet, exposing the floors (Brick Street behaviour). The
  slabs and side walls stand. A second rocket into the exposed floors brings the slabs down.

### Signs (`signs.ts`)

Signs are what this world is about. They are many small, light pieces bonded to the facades. When
the wall behind them goes, they hang by their last bonds, swing, spark and fall.

- **Neon tube**: a hexagonal prism (`prism(hexagon(r 0.022), length)`) laid along the stroke, with
  one flat face on the backing plane, so it bonds to the backing face to face. Material `neon`,
  per-piece `tint` from the palette. **Shorten each stroke by 0.025 at both ends**, so strokes
  that meet at a corner don't overlap (real neon has gaps at its bends too).
- **Glyphs**: a stroke font on a 4 × 5 lattice (unit `u` = glyph height / 4, glyph height 0.35 to
  0.6). Each glyph has 3 to 6 strokes from: horizontals (2 to 3u), verticals (2 to 4u), diagonals,
  hooks (two strokes), boxes (four), dots (0.5u), and 8-segment circles (2u across). Generate them
  with a seeded random from a fixed list of about 40 shapes. Use rounded forms, circles and dots,
  so they look like a script but are not a real one. Never draw letters, digits or real characters.
- **Pictograms**, also made of tubes: a bowl with three steam wisps (noodles), a fish (a diamond
  and a tail), a cup with steam, a crescent moon with a star (hotel), a key, and an arrow in a
  circle. Each has 8 to 16 tubes.
- **Flat neon signs** (about 18): a backing raceway (signbox, dark 0x1c1e24, 0.06 deep) touching
  the facade, with the tubes on its face. Rows of 2 to 4 glyphs, or a vertical column of 3 to 5
  glyphs on a column face. Put them on every fascia without a lightbox strip, and on bands and
  spandrels of floors 1 to 4. Never put one across a window. A sign is one or two colours.
- **Blade signs** (9, plus the big blade): they stick out from the facade into the alley, with
  their faces toward the alley's ends (±x).
  - Body: signbox segments 0.25 (x) × 1.5 (y) × 0.7 (z out from the facade), stacked 2 to 4
    high from y 4.2. The back face of each segment touches the facade (a column or a column line),
    so each segment bonds to the facade and to the segments above and below.
  - Faces: a lightbox panel 0.03 thick on both ±x faces of each segment, showing glyphs from the
    atlas.
  - Edges: neon tubes along both vertical edges of each face.
- **The big blade** (N4, centre x 0.9): 8 segments 0.35 × 1.5 × 0.9, y 4.2 … 16.2. Magenta
  lightbox faces, cyan edge tubes, and a crown on top: an amber 8-tube ring 1.0 across standing on
  a signbox plinth. The segments' back faces touch N4's facade column at x 0.6 … 1.2. Put a column
  there on purpose (N4's bay lines are set so one falls at x 0.9).
- **Lightbox billboards** (4): E's face (x 30.06, centred z 0, y 8 … 11: 6 lightbox panels of
  2 × 1.5 on a signbox backing, with a neon frame of 10 tubes), and rooftop billboards on N2, S7
  and N7. The rooftop ones are 3 × 2 m on two steel posts standing on the roof slab and braced
  with `d.bond` to the parapet, facing −x toward the start.
- **The flickering sign**: a moon-and-star pictogram on S6's band at level 3 (y 9.6). Material
  `neonFlicker`, which flickers on its own (section 7).
- **Colours** (per-piece tint), across all signs: cyan 0x22e6ff and teal 0x14ffc8 (35%), magenta
  0xff2bd6 and pink 0xff3a7a (30%), amber 0xffa62b and warm white 0xfff1d6 (20%), red 0xff2a2a
  (10%), acid green 0x7dff4a and violet 0x8a5bff (5%).

### Street parts (`street.ts`)

- **Roller shutter**: a box (signbox, 0.35 × 0.35, in pieces of at most 2.2 m) under the fascia or
  beam. Slats (shutter) 0.40 tall across the opening, cut at most 2.2 wide, at lz 0.12, stacked from
  the ground slab's top up to the box, each on the one below. Guides (steel 0.06 × h × 0.10) at
  each end touch the pier faces and the slat ends. About 8 shutters in the alley.
- **Awnings** (12: every type B shop and 4 type A shops): a sheet (awning material) of 2.4 to 4 m
  in pieces of at most 2 m, 1.2 deep, 0.04 thick, tilted 15° down from y 2.9 at the facade. Two
  tilted steel arms. Join both to the facade with `d.bond(…, 0.01)`, since they touch it only at
  an edge. Stripes come from the material (section 3); tints vary per awning.
- **Lantern gate** (x −25.775 … −25.425, wood, tint 0xb83a28):
  - two posts 0.35 square at z ±3.2, each 4.8 tall in 3 pieces
  - a tie beam at y 4.8 … 5.15, z −3.55 … 3.55, in 4 pieces
  - a top beam at y 5.15 … 5.45 in 4 pieces, with its joints offset half a piece from the tie
    beam's, so each top piece rests on two below
  - a lightbox panel 1.6 × 0.6 (amber glyphs) on the tie beam's −x face
  - 5 lanterns at z −2.4, −1.2, 0, 1.2, 2.4, each hanging from a cord (steel 0.02 × 0.3 × 0.02)
    whose top face touches the beam's underside
- **Lanterns**: a 10-sided barrel hull: rings at y 0, 0.1, 0.3, 0.5 and 0.6 with radii 0.14,
  0.21, 0.24, 0.21 and 0.14, so it has flat caps. Material `lantern`, tints red 0xff3020 (70%) or
  amber 0xffa040. Bond each lantern to its cord with face contact (cap to cord bottom). On strings,
  use `d.bond`.
- **Lantern strings** (3) across the alley at x −14.5, −2.0 and 17.5. They hang from facade to
  facade at y 6.4 (on the heads above the floor-1 windows) with 0.6 m of sag, in 6 tilted steel segments (0.02 thick) along a parabola.
  Consecutive segments are joined with `d.bond(a, b, 0.002)`, and the end segments to the facade
  piece they touch (find it by bounds). Five lanterns hang from the joints by `d.bond`.
- **Overhead cables** (10, seeded): random x, ends at y 5 to 13 on the two facades (the ends may
  be up to 2 m apart in x), sag 0.3 to 1.0 m, 6 segments 0.03 thick, steel tinted 0x15161a,
  bonded like the strings. Keep them clear of the bridge (x 5.8 … 9.4 above y 9).
- **The bridge** (x 6.4 … 8.8, inside both N5 (6.03 … 12.97) and S5 (2.03 … 8.97); z −3.75 … 3.75):
  - deck: 5 concrete pieces 2.4 × 0.24 × 1.5 at y 9.6 … 9.84. The end pieces' faces touch N5's
    and S5's level-3 bands face to face. Make sure the bridge's x range falls on bays whose band
    is there.
  - two steel edge beams 0.2 × 0.36 under the deck edges, 5 pieces each, ending against the heads
    below the bands
  - 6 steel posts per side (0.08 square, 2.4 tall)
  - 5 glass panes per side (1.42 × 2.2 × 0.03)
  - a roof of 5 signbox panels 2.6 × 0.10 × 1.5 on the posts
  - a cyan neon underline: 5 tubes per side on the deck's ±x faces
  - It should stand as built (reinforce sees to it). One rocket on the bridge shatters its glass,
    pops its neon and bends the beams (plastic). The deck tears loose and swings down from one end
    when that end's band or the floor below it goes.
- **Vending machines** (4, in front of S6 at x 9.6 + 0.95i, z −3.73 … −3.03, 0.02 off the facade
  so they are not bonded to it): a lower body 0.9 × 1.0 × 0.7 and an upper body 0.9 × 0.85 × 0.7
  (signbox, tinted red 0xc8202a, white 0xe8eef2, blue 0x2050c0 or green 0x20a060). On the upper
  body's front (+z), a product lightbox 0.78 × 0.7 × 0.03 (pictogram cells from the atlas) and a
  glass cover 0.02 in front of it. A dark steel slot panel 0.6 × 0.25 below. They tip over and
  slide when blasted.
- **Transformer box**: signbox 0.5 × 0.8 × 0.6, grey 0x6a6e70, at y 5.4, z 7.0 on N5's lane wall
  (its −x face; the box spans x 5.53 … 6.03). Two steel conduits run up the wall from it. Keep
  its piece; `life.ts` watches it.

### Materials (`materials.ts`)

13 breakable materials, plus `neonFlicker` (14). Textures from this pack are loaded with
`{ base: 'packs/neon/textures/' }`. The insides `gen_concrete_broken` and `gen_brick_broken` come
from the base pack.

| Name | Start from | Changes, and why |
|---|---|---|
| `concrete` | `presets.concrete` | surface `neon_concrete` (roughness × 0.75: wet outside), `uvScale 0.5`, inside 0xd0ccc4 + `inside('gen_concrete_broken', 1.2)`. Keep `support 100` to start; tune per section 2 (type A, point 3). |
| `tile` | `presets.concrete` | Concrete clad in glazed tile: `density 2.2`, `support 90`, `compression 60`, `strength 3.5e4`, `impact 40`, `fragmentSize 0.30` (tiles come off in smaller, crisper bits), `minSize 0.12`, `dustSize 0.18`. Surface `neon_tile` (`normalScale 0.8`), `uvScale 1.0` (the set is 1 m), inside 0xcfc8be + `gen_concrete_broken`. Tints per building: white 0xffffff, pale blue 0xd6e4f0, pale green 0xd2eadb, salmon 0xf2cbbd, ochre 0xead9a8, dark grey 0x8a8e94 (E). |
| `render` | `presets.brick` | Masonry under painted render: `support 40` (a little firmer than brick, so the sheet comes down whole), surface `neon_render`, `uvScale 0.5`, inside 0xc8b0a0 + `inside('gen_brick_broken', 1.6)`. Tints mint 0xcfe8d6, pink 0xf0c8cc, cream 0xf2e8d0, pale yellow 0xf0e6b0. |
| `glass` | `presets.glass` | Dark night glass that reflects (with SSR): color 0x18222c, roughness 0.03, metalness 0.6, opacity 0.72, `depthWrite false`. Keep `reach 3`, so blast waves blow out windows along the alley. |
| `neon` | `material()` | Glass tubes: `density 2.5`, `strength 1e3`, `support 25`, `impact 1.0` (any knock breaks one), `shatter true`, `reach 2`, `fragmentSize 0.10`, `minSize 0.04`, `minBodySize 0.12` (nearly every shard becomes a particle), `dustSize 0.25`, `maxPieces 6`, `rubbleLife 0`, `friction 0.4`. Surface: white, roughness 0.2, with `emissiveNode = tint × 7 × power × lit` (section 3). Inside 0x9ab0b8. |
| `neonFlicker` | same as `neon` | Its own flicker uniform in place of `power`. |
| `lightbox` | `material()` | Acrylic sign faces: `density 1.2`, `strength 3e3`, `support 40`, `impact 3`, `shatter true`, `reach 1.5`, `fragmentSize 0.25`, `minSize 0.08`, `minBodySize 0.12`, `dustSize 0.2`, `maxPieces 8`, `rubbleLife 0`. Surface: emissive from the glyph atlas: `mix(tint × 0.55, white × 1.3, glyph) × 3 × power × lit`. Inside 0x2a2a30. `uvScale 1.2`. |
| `signbox` | `presets.metal` | Hollow sheet-metal boxes (sign bodies, raceways, AC units, tanks, vending machines, bridge roof): `density 0.35` (hollow, so a vending machine weighs about 0.35 t), `support 600`, `strength 2e4`, `impact 30`, `fragmentSize 0.45`, `minSize 0.25`, `maxPieces 4`, `plastic { yieldStress 6e3, bend 1.0 }`. Surface `neon_metal` (metalness 0.2), `uvScale 1`, inside 0x3a3d42. |
| `steel` | `presets.metal` | Brackets, rails, posts, beams, pipes, cables, cords, mullions, grilles: surface `neon_metal` tinted 0x5a5e66, inside 0x6a6e74, `uvScale 1`. Preset values otherwise. |
| `shutter` | `presets.metal` | Corrugated slats that crumple: `density 0.9`, `support 400`, `strength 1.5e4`, `impact 18`, `fragmentSize 0.5`, `minSize 0.3`, `maxPieces 4`, `plastic { yieldStress 2.5e3, bend 1.5 }`. Surface `neon_shutter` (`metalMap`), `uvScale 1`. Tints: galvanised 0xffffff, green-grey 0xb8c8b8, blue-grey 0xb0bccc. |
| `lamp` | as nyc's `lamp` | Interior light panels and lit-window panels: emissive from the tint (`tint × 2.2 × power`), so one material covers warm, cool and pink. `rubbleLife 6`. |
| `lantern` | `material()` | Paper on a wire frame: `density 0.06`, `strength 600`, `support 25`, `impact 0.4`, `fragmentSize 0.18`, `minSize 0.12`, `minBodySize 0.1`, `dustSize 0.22`, `maxPieces 4`, `rubbleLife 5`. Surface: roughness 0.8, emissive `tint × 2.2 × power × lit`. Inside 0x3a1810. |
| `awning` | `material()` | Canvas or plastic sheet: `density 0.25`, `strength 2.5e3`, `support 50`, `impact 4`, `fragmentSize 0.4`, `minSize 0.25`, `dustSize 0.08`, `maxPieces 5`, `rubbleLife 20`. Surface: roughness 0.35 (wet), with `colorNode` stripes along `uv().x` (white and the tint, 0.25 m bands). Inside 0xd8d8d8. |
| `wood` | `presets.wood` | The gate: surface `textured('gen_wood_painted', { color: 0xb83a28 })` (faded red lacquer over grey wood), inside 0xb89a78, `uvScale 1`. |
| `grate` (optional, N3's cages) | nyc's `grate` | Same alpha grating, on `neon_metal`. Drop it if the material count matters. |

---

## 3. Look

- **Sky**: Poly Haven **`kloppenheim_07_puresky`** (CC0, by Greg Zaal, sky edits by Jarod Guest;
  checked in the API, and the 1k file exists). It is an overcast night sky lit from below by
  artificial light, which reads as a megacity's glow on a low cloud deck. Download
  `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_07_puresky_1k.hdr` to
  `public/packs/neon/hdri/` and credit it.
  - `sky: { hdri: 'packs/neon/hdri/kloppenheim_07_puresky_1k.hdr', azimuth: 0.35, background: 0.4, environment: 0.3, sun: { color: 0x8ea4ff, intensity: 0.35 } }`
  - Azimuth 0.35 puts the "sun" (moonlight, really) down the alley from the east end, slightly
    from the south. It rims the end block, and rain falling toward the player is backlit.
- **Fog**: `{ color: 0x121a30, near: 20, far: 150 }`. Deep blue haze: the far skyline melts, and
  the alley's end stays clear.
- **Exposure** 1.0. **Bloom** `{ strength: 0.85, radius: 0.55, threshold: 0.55 }`. Neon at
  emissive 7 should glow with a halo but keep its tube shape. If tubes turn into blobs, lower the
  strength before the emissive.
- **Hemisphere** `{ sky: 0x2a3a70, ground: 0x2a1834, intensity: 0.35 }`: a blue fill from above,
  and a magenta-tinted bounce from the street.
- **AO** radius 0.5.
- **Reflections** (SSR) `{ strength: 1.0, distance: 40 }`. This is what makes the wet street
  reflect the neon. Check the cost against 60 fps.
- **Grade** `{ saturation: 1.15, contrast: 1.08, tint: 0xeef0ff, vignette: 0.3 }`.
- **Weather** `{ rain: 0.9, rainColor: 0x9fb4d8, wind: [0.6, 0.2] }`.
- **Point lights** (4, no shadows, distance 14, decay 2; start intensities 18 to 25):
  - magenta 0xff2bd6 at (1.2, 5.5, 2.4), under the big blade
  - cyan 0x30e0ff at (7.8, 8.6, 0), under the bridge
  - amber 0xffa040 at (−25.0, 4.2, 0), at the gate
  - cool white 0xbcd8ff at (31.5, 4.5, 0), in the arcade

  Each fades out once its sign or structure has fallen (section 7). One more light, the spark
  flash, stays in the scene at intensity 0 when idle, so adding it never recompiles the shaders.
- **Palette**: shadows deep blue 0x0b1226. Concrete reads blue-grey in this light, and tile reads
  pale where the neon falls on it. Neon cyan, magenta and amber are the accents, red and green
  are sparse. Warm interiors show through the windows.
- **Wet ground**: `neon_asphalt` with roughness from its map (puddles 0.03, damp 0.3), multiplied
  by 0.9.
  - Rain ripples on the puddles: in TSL, rings expanding in hashed cells of 0.4 m that restart
    every 0.6 to 1.2 s, added to the normal only where the puddle mask is high. They are cheap and
    move the SSR reflections.
  - Gutters: darker and smoother (roughness 0.08).
- **Per-piece light (`life.ts`)**: neon, lightbox and lantern pieces glow only while they stand.
  The shared fragment mesh doesn't expose a piece's state, so the world keeps its own storage
  buffer `lit[maxBodies]` (floats, static usage, uploading only the ranges that change). Their
  `emissiveNode` reads `lit[pieceInfo.x]` (the body slot attribute the fragment mesh already
  carries) and multiplies by `1 − pieceInfo.y`, so broken faces don't glow.
  - `update` walks the sign pieces (about 900) and writes 0 for any that are no longer `fixed`.
  - On `fracture`, each new piece's slot gets 1 if it is `fixed`, and 0 otherwise.
  - Fallback if this misbehaves: drop `lit` and rely on `rubbleLife 0` (falling tubes keep glowing
    until they land).
- **Glyph atlas**: a 1024² canvas texture made in code (no image generation): 4 × 4 cells of white
  rounded strokes on black. 10 cells are glyphs from the same stroke font as the tubes, 6 are
  pictograms. The `lightbox` emissive samples it with the box-projected `uv()`, so each panel
  shows different cells. The back towers' rooftop billboards and the avenue's lightboxes reuse it.

---

## 4. Textures to generate (6 sets, GPT Image 2.5, one take each)

All use `tex(...)` and state the frame's real size. Make the images bright and low in contrast,
because the tints and the night light do the colouring.

| Set | What | Frame (real size) | Image | Processing | Used by |
|---|---|---|---|---|---|
| `neon_tile` | Small square glazed ceramic wall tiles: 9.5 cm tiles with 5 mm light grey grout, off-white with faint per-tile variation (very pale grey to very pale blue), glossy glaze, grime in the grout, faint rain-streak stains. A perfectly straight grid. | 1.2 × 1.2 m, 12 × 12 tiles | 1536² | **custom `grid(n=10)`**: find the grout period in x and y as `sidewalk()` does, crop exactly 10 × 10 tiles from joint to joint, remap to 1024. Height: grout lines −, a slight bevel on each tile. Roughness: glaze 0.16, grout 0.8, grime +0.15. AO 0.5. | `tile`, surface (`uvScale 1.0`) |
| `neon_concrete` | Weathered cast concrete wall: grey, dark water stains running down, efflorescence, patched repairs, small pits. No formwork pattern, no joints. | 2 × 2 m | 1024² | **generic** (`rough=0.85`) | `concrete`, surface (`uvScale 0.5`) |
| `neon_render` | Painted cement render on an old building in a humid city: faded very light warm-grey paint, mottled, damp patches, dark mould streaks from above, hairline cracks, small patches where paint flaked to grey cement. | 2 × 2 m | 1024² | **generic** (`rough=0.88`) | `render`, surface (`uvScale 0.5`) |
| `neon_asphalt` | Wet dark asphalt seen from above, with fine aggregate, patched repairs, sealed cracks, and shallow puddles with smooth dark surfaces in the low spots (about 25% of the area). Flat, even light; no reflections in the image. | 4 × 4 m | 1024² | **custom `asphalt`**: wrap with `wrap_cut` and even out the light (`delight`). Puddle mask: `smoothstep` on the blurred (σ 12) low luminance times low local variance. Roughness 0.42 − 0.39 × puddle. Height: high-pass × (1 − puddle), so the puddles are flat. | the ground in `scenery.ts` (repeat L/4) |
| `neon_shutter` | Corrugated galvanised steel roller shutter: horizontal slats at a 7.5 cm pitch, worn grey-green paint over zinc, scratches, rust at the seams, grime. Slats perfectly horizontal and straight. | 1.2 × 1.2 m, 16 slats | 1024² | **custom `slats`**: transpose, find the seams as `wood_painted()` finds board gaps, `lay_boards` 13 slats, wrap with `wrap_rows`, transpose back. Height from the known slat profile (a rounded corrugation per slat, a groove at each seam), not from colour. Roughness 0.5, +0.3 on rust. Metalness 0.35 on bare metal. | `shutter`, surface (`uvScale 1.0`) |
| `neon_metal` | Painted sheet steel, very light grey enamel, weathered: grime, rust spots and short rust streaks, scuffs and a few bright scratches, a dent or two. No panels, rivets or text. | 1 × 1 m | 1024² | **`iron_painted`** (the base function: it finds the rust and scratches by hue and brightness) | `signbox`, `steel`, `grate`, surface (`uvScale 1`) |

Broken-face textures reuse the base pack's `gen_concrete_broken` (concrete, tile) and
`gen_brick_broken` (render). Nothing new is needed for them.

Spend 6 images on textures and 3 on prop concepts. That leaves **3 for retakes** (the bin's
concept, if it is made, takes one). Look at each raw image before processing, and at
`previews/*_seam.jpg` after.

---

## 5. Props (Meshy 7.1; 3 generations, 1 in reserve)

Make the first three. Use the fourth for the bin only if all three come out usable on their first
generation; otherwise keep it to redo the one that failed.

| Name | What | Real size (fit) | Mass (t) | Count, where | Material (sounds) |
|---|---|---|---|---|---|
| `scooter` | A small 110 to 125 cc step-through motor scooter: faded white or pastel plastic panels, black seat, small chrome mirrors, kickstand down, front wheel straight. No lettering or badges (`paintOut` any that appear). | 1.85 m long (`length`) | 0.11 | 7: S1, N3, S6/S7 fronts (section 1) | `signbox` |
| `cart` | An Asian street-food hawker cart: a stainless counter with a cooking well and lidded steel pots, a wooden frame, two spoked wheels on one side, a small canvas canopy on four thin poles, a blank cloth valance. | 1.9 m long (`length`); about 2.2 m tall | 0.16 | 2: S4 front (x −1, z −2.6), N7 front (x 24, z 2.7) | `signbox` |
| `crates` | Two side-by-side stacks of three empty stackable plastic crates with perforated sides, one stack blue and one red. | 1.2 m long (`length`), 0.95 tall | 0.02 | 6: shop doors (S1, N2, N6), the slot's mouth, 2 under the bridge | `awning` |
| `bin` (reserve) | A 240 L wheeled plastic bin, dark green, lid closed, no markings. | 1.07 m tall (`height`) | 0.015 | 3: near the slot, by S8 | `awning` |

Triangle budget 12,000 to 16,000 each, textures 1024 (cart 2048). Concepts on a pure white
background (`concept()`); check them for any text before the 3D step.

---

## 6. Sounds (12 new, 33 takes; 7 left for redos)

New sounds come from `public/packs/neon/sounds/` (`audio.packs: ['packs/neon/sounds/']`).
`ambience.city` replaces the base pack's afternoon one by name.

| Name | Kind / space | Takes × s | Prompt intent | `play` (start) | Used by |
|---|---|---|---|---|---|
| `ambience.rain` | loop / head | 1 × 45 | Steady heavy rain in a narrow city alley at night: dense patter on asphalt, water running in gutters and down pipes, dripping from ledges, close and enveloping. No thunder, no voices. | `bus ambience, volume 0.55, voices 1, reverb 0` | ambience |
| `ambience.city` | loop / head | 1 × 45 | Distant megacity at night: a low traffic hum from wide roads a few blocks away, a far train passing, faint horns now and then, a deep low drone of the city. No voices, no music. | `bus ambience, volume 0.3` | ambience (replaces the base one) |
| `rain.awning` | loop / world | 2 × 12 | Rain drumming on a taut plastic or canvas awning just overhead, with drips running off its edge onto pavement. | `loop, near 2.5, rolloff 1.4, volume 0.5, voices 3, reverb 0.2` | positional, at the 2 nearest standing awnings |
| `neon.buzz` | loop / world | 2 × 8 | Close-up electrical hum of a neon sign transformer: a steady mains buzz with a faint crackle and a high whine. | `loop, near 1.5, rolloff 1.6, volume 0.35, voices 4, reverb 0.1` | positional, at the 3 nearest standing signs; louder at the flickering sign |
| `neon.break` | shot / world | 5 × 2 | A neon tube breaking: a hollow glassy pop and tinkle, a sharp electrical crackle and zap as the gas and electrodes short out. | `near 4, volume 0.75, voices 5, cooldown 0.05, spacing 1.5, pitch [0.9, 1.12]` | `neon.break` |
| `spark.zap` | shot / world | 4 × 1.5 | Electrical sparks: a short burst of arcing zaps, crackles and pops from a shorted cable, with a hiss. | `near 4, volume 0.65, voices 4, cooldown 0.08, pitch [0.9, 1.15], reverb 0.3` | reactions: breaking signs, dangling signs, the transformer |
| `shutter.rattle` | shot / world | 4 × 2.5 | A corrugated steel roller shutter struck hard and rattling: a loud metallic crash, then slats clattering and shaking in their guides. | `near 5, volume 0.7, voices 4, cooldown 0.15, spacing 3, pitch [0.92, 1.08], reverb 0.35` | `shutter` material; blasts nearby |
| `sheetmetal.impact` | shot / world | 4 × 1.5 | A thin sheet-metal box or panel hitting wet pavement: a hollow tinny bang with a short rattle. | `bus debris, near 3, volume 0.45, voices 4, pitch [0.85, 1.2]` | `signbox`, `shutter`, `awning`, `lightbox` impacts |
| `tile.break` | shot / world | 4 × 2.5 | Glazed ceramic wall tiles cracking and showering off a concrete wall: a sharp crack, brittle ceramic shattering, chips skittering. | `near 4, volume 0.75, voices 5, cooldown 0.06, spacing 2` | `tile` break |
| `splash.debris` | shot / world | 3 × 2 | Chunks of concrete and debris landing in shallow puddles on a wet street: heavy splashes with a gritty thud. | `bus debris, near 4, volume 0.5, voices 3, cooldown 0.1, spacing 2, pitch [0.85, 1.15]` | reaction: heavy pieces landing on the street |
| `steps.wet` | slice / head | 1 × 8 | Footsteps in boots on a wet asphalt street, small splashes, a steady pace, clear separate steps with gaps. | `volume 0.32, voices 2, pitch [0.95, 1.05], reverb 0.15` | `footsteps.hard` |
| `alarm.bell` | loop / world | 2 × 10 | A shop's electric burglar alarm bell ringing continuously, a loud metallic bell, outdoors in a street. | `loop, near 6, volume 0.55, voices 1, reverb 0.45` | reaction: blasts near a shuttered shop |

### Which sounds each material makes

| Material | break | impact | heavyImpact | debris | strain | collapse | settle |
|---|---|---|---|---|---|---|---|
| `concrete` | `packMaterials.concrete` | | | | | | |
| `tile` | `tile.break` | `brick.impact.small` | `concrete.impact` | `brick.debris` | `structure.creak` | `collapse.rumble` | `dust.settle` |
| `render` | `packMaterials.brick` | | | | | | |
| `glass` | `packMaterials.glass` | | | | | | |
| `neon`, `neonFlicker` | `neon.break` | `glass.debris` | | `glass.debris` | | | |
| `lightbox` | `glass.shatter` | `sheetmetal.impact` | | `glass.debris` | | | |
| `signbox` | `metal.bend` | `sheetmetal.impact` | `metal.impact.large` | | `metal.bend` | `metal.impact.large` | |
| `steel` | `packMaterials.metal` | | | | | | |
| `shutter` | `shutter.rattle` | `sheetmetal.impact` | `shutter.rattle` | | `metal.bend` | `shutter.rattle` | |
| `lamp` | `glass.shatter` | | | `glass.debris` | | | |
| `lantern` | none (paper) | | | | | | |
| `awning` | | `sheetmetal.impact` | | | | | |
| `wood` | `packMaterials.wood` | | | | | | |

Footsteps: `{ hard: 'steps.wet', rubble: 'steps.rubble', land: 'player.land' }`.

Ambience:

```
[{ sound: 'ambience.rain', volume: 1, high: 1.1 },
 { sound: 'ambience.city', high: 1.6 },
 { sound: 'ambience.wind', volume: 0.5, high: 4 }]
```

Settings: the alley is a hard canyon, so raise the reverb: `explosion.near` and `collapse.rumble`
to 0.6, `glass.shatter` to 0.35.

---

## 7. Reactions (`life.ts`)

`index.ts` wires `onBlast`, `onImpact` and `update` to this module. The first `update` subscribes
to `rt.destruction.on('fracture')`, because the contract has no init hook. All state is in the
module and reset when it is built.

1. **Signs short out**: a `neon`/`lightbox` piece fractures.
   - `rt.effects.impact(at, [0, −1, 0], 0xd8f8ff)` throws sparks and white chips.
   - Play `spark.zap` at the break.
   - The flash light jumps to the piece's tint at intensity 30 and decays over 0.15 s.
   - At most 6 bursts per second.
2. **Dangling signs**: a sign with some pieces still `fixed` and some loose sparks every 1 to 3 s
   at its last fixed piece (`effects.impact` and `spark.zap` at volume 0.5) until it falls or goes
   dark. The sign list (pieces, centre, light) comes from `build()`.
3. **Brown-out**: every blast dips the shared `power` uniform (neon, lightbox, lamp, lantern):
   to 0.35 for 0.08 s, then two or three random flickers, then back to 1 over 0.6 s. The dip is
   deeper the closer and bigger the blast. The whole street's light stutters with the bang.
4. **Blackout**: the transformer box fractures or comes loose.
   - `effects.explosion(at, n, 0.15)`, a bright electrical flash.
   - `spark.zap` three times over 0.6 s.
   - `power` goes to 0 for 1.5 s, and all `neon.buzz` voices stop.
   - Then the signs come back over 2.5 s with a random flicker in sequence. Since there is only
     one uniform, the flicker is global, staggered by brightness steps. The buzz returns.
   - The four point lights follow `power`.
   - Once only.
5. **The flickering sign**: `neonFlicker` runs its own pattern: mostly on, with 2 to 5 fast
   stutters every 3 to 9 s and the odd 1 s outage. Its `neon.buzz` voice follows the same
   envelope.
6. **Shutters rattle**: on a blast, up to 3 standing shutters within 14 m play `shutter.rattle`,
   louder when nearer. The engine's speed of sound staggers them.
7. **Shop alarm**: a blast within 9 m of a shuttered shop has a 60% chance of starting
   `alarm.bell` at its shutter. One at a time; it rings for 15 to 25 s, like Brick Street's car
   alarm.
8. **Splashes**: `onImpact` with `other === null`, `at[1] < 0.3`, `speed > 2.5` and
   `piece.mass > 0.05` plays `splash.debris` (volume by impulse) and makes a small pale puff
   (`effects.dust(at, 0.02, 0xaab8c8)`). At most 8 a second.
9. **Steam**: three vents (the manhole at (12, 0, 0.8), S3's wall exhaust at (−7.5, 3.2, −3.8),
   the slot at (−11.75, 0, −5)) emit a small pale puff every 0.35 s
   (`effects.dust(at, 0.04, 0xd0d8e0)`). A blast within 6 m makes that vent gush for 8 s (a puff
   every 0.08 s, bigger). Check that the puffs rise or drift rather than settle; if they don't,
   keep them small and say so in README.
10. **Lights die with their signs**: each point light is tied to its structure (the big blade,
    the bridge, the gate, the arcade). When less than 30% of its pieces still stand, it fades out
    over 0.5 s with a last flicker.
11. **Ambient life** (scenery, driven from `update`): headlights passing on the avenue, and the
    aircraft beacons blinking on the far towers.
12. **Positional loops** (every 0.5 s): keep `neon.buzz` on the 3 nearest signs that are still
    lit, and `rain.awning` on the 2 nearest standing awnings. Stop a voice with a 0.3 s fade when
    its sign or awning goes, or when it is no longer among the nearest.

`blastRadius`: 2.3 (the default).

Dust and chips:

```
dust:  { concrete: 0x8c8a88, tile: 0xa8a8a4, render: 0xb8b0a4, glass: 0xc8dce8, neon: 0xd8f4ff,
         neonFlicker: 0xd8f4ff, lightbox: 0xe8e8f0, signbox: 0x6a6a6a, steel: 0x5a5a5a,
         shutter: 0x7a807a, lamp: 0xe8eef4, lantern: 0x8a2a1a, awning: 0x9aa0a8, wood: 0x7a6048 }
chips: { concrete: 0x8a8780, tile: 0xe8eef2, render: 0xd0c8b8, glass: 0xbcd8e6, neon: 0xeaffff,
         neonFlicker: 0xeaffff, lightbox: 0xf2f2f8, signbox: 0x40444a, steel: 0x4a4e54,
         shutter: 0x8a908a, lamp: 0xf0f4f8, lantern: 0xc8281e, awning: 0x5a7a9a, wood: 0x6a4a30 }
```

---

## Checks before calling it done

- `npx tsc --noEmit -p .` is clean for `src/demo/worlds/neon/`.
- `demo.stats()` after build: pieces between 5,000 and 8,000, nothing loose at rest after 5 s.
- Screenshots on `:103`:
  - from the start, from the crossroads, and from under the bridge looking west
  - from above (y 40)
  - before and after: one rocket on an upper facade, one on a ground column, three along a type A
    ground floor, one on a type B's beam, one on the bridge, one on the big blade's wall, two on
    the arcade columns
- `demo.profile`: 60 fps standing (with SSR and rain on), no frame much over 40 ms in the arcade
  collapse.
- Sound: count plays by wrapping `demo.audio.engine.play` during the blasts above: `neon.break`,
  `spark.zap`, `shutter.rattle`, `tile.break` and `splash.debris` are all heard, and the buzz and
  awning loops follow the player.

## What the library or demo could add

Done since this plan: the piece's state, tint and frame in its material (`pieceState`,
`pieceTint`, `pieceFrame`, `glow: 'standing'`), a smoke or steam puff (`effects.puff`), emissive
maps on props (`process-props.py`'s `glow`), a start hook (`onStart`), and per-material pitch
(`MaterialSounds.pitch`). Still wanted (README.md, Known issues):

1. **The piece's body slot in its material**, or a few floats per piece a world can write: the
   per-piece light (curtains unlit beside lit windows, lamp levels, the flicker, the lightboxes'
   atlas places) reads it from the fragment mesh's `pieceInfo` attribute.
2. **Crushing**: a tower that has lost its ground floor stands on its walls in compression, and a
   section that drops onto what's below lands whole (its joints break only when pulled), so "four
   or more bring the whole tower down" can't happen; the shell stands.
