# Market Town: textures report

What the texture maker made for Market Town, how good each item is, and how to use it. You can see
every set together in `textures/previews/overview.jpg` (2 × 2 tiles of each, lit by its normal map).
Each set also has its own `<set>_2x2.jpg` (colour) and `<set>_lit_2x2.jpg`. The generated sets have
`<set>_seam.jpg` too: a full-size crop where four tiles meet.

## Spend

- 6 GPT Image 2.5 images (1024², high), one take per set. Nothing was redone. That's about $1.20 at an
  estimated $0.20 an image, logged in `ledger.jsonl`.
- With the props maker's 4, the world has used 10 of its 12 images. 2 are left.
- Poly Haven sets and skies are free (CC0).

## What's in public/packs/medieval

Every set is three 1k WebP maps: `<set>_diff_1k.webp`, `<set>_nor_gl_1k.webp` and `<set>_arm_1k.webp`.
Use them with `textured('<set>', { base: '/packs/medieval/textures/' })`.
`uvScale = 1 / tile`.

| Set | Source | Tile | uvScale | For | Mean colour | Verdict |
|---|---|---|---|---|---|---|
| `medieval_oak` | generated | 1 m | 1 | oak (frames, posts, rafters, joists) | #938c86 silver-grey | good |
| `medieval_limestone` | generated | 1.5 m | 0.67 | limestone (ashlar, coping, steps, cross) | #d3c4a3 honey-cream | good, with one caveat (below) |
| `medieval_limestone_broken` | generated | 0.8 m | 1.25 | limestone and rubble `insideTexture` | #c2b7a3 | good |
| `medieval_daub_broken` | generated | 0.8 m | 1.25 (the design says 1.6) | plaster `insideTexture` | #83603c | good enough |
| `medieval_hay` | generated | 1 m | 1 (the design says 1.2) | hay | #9e7f51 golden | good |
| `medieval_canvas` | generated | 0.5 m | 2 (the design says 1.5, which makes a coarser weave) | cloth (awnings) | #d5d0c8 near white | good |
| `medieval_limewash` | Poly Haven `medieval_wall_01`, recoloured | 2 m | 0.5 | plaster (use this one) | #dbd8ce near white | good |
| `medieval_wall_01` | Poly Haven | 2 m | 0.5 | plaster as photographed (beige with orange stains) | #c9b090 | kept for comparison |
| `castle_wall_slates` | Poly Haven | 2.5 m | 0.4 | rubble | #8a7e65 | good, but it repeats (below) |
| `clay_roof_tiles_03` | Poly Haven | 2.6 m | 0.385 | tile | #8d5536 terracotta | good |
| `old_planks_02` | Poly Haven | 2 m | 0.5 | boards (doors, shutters, counters, crates, decks) | #615546 worn brown | good |
| `cobblestone_floor_001` | Poly Haven | 2.4 m | repeat the ground mesh's maps 1/2.4 per metre | the ground | #797569 grey | good up close, repeats from above |
| `rocky_trail_02` | Poly Haven | 2 m | 1/2 per metre | dirt roads out of the gate and the south-west gap (optional) | #876b52 dry tan earth | good |

Skies, in `public/packs/medieval/hdri/`:

| File | Size | Notes |
|---|---|---|
| `kloppenheim_06_puresky_1k.hdr` | 1.1 MB | the design's pick. Its brightest point is at 218.5° longitude and 7.8° elevation. |
| `kloppenheim_06_puresky_2k.hdr` | 4.3 MB | the same sky, and visibly sharper. At 70° FOV a 1k sky is about 5× magnified on a 1080p screen, so the small clouds over the gate are soft at 1k and crisp at 2k. **I recommend the 2k one** (`hdri: '/packs/medieval/hdri/kloppenheim_06_puresky_2k.hdr'`). |
| `syferfontein_6d_clear_puresky_1k.hdr` | 1.1 MB | the alternative: clear, with a sharp sun disc at about 6° and a warm haze band on the horizon. |

## Notes for the builder

**Orientation**
- `medieval_oak` has its grain running down the map (along v). Build timbers long along their local y,
  as the design says.
- `old_planks_02` has its boards running along v too.
- `clay_roof_tiles_03` has its rows running along u, and **image up is up the roof**. Each row's butt
  and its shadow are at the bottom of the row, which I checked from the normal map. With the
  library's box projection, a slab's top face gets u = local x and v = -local z. So build the slab
  with local x along the ridge and local +z pointing down the slope toward the eaves. If the tiles
  look upside down, flip the slab's z.

**Tints multiply the map, and the map's mean is above.** Approximate multipliers that land on the
design's target colours:
- **Oak (#938c86):**
  - silver-grey 0x8a8070: tint 0xf0e8d6;
  - mid brown 0x6b5240: tint 0xba9679;
  - tarred 0x4a3a2e: tint 0x806a57.

  The design's timber colours are the target colours, not the tints. Used directly as tints, they
  come out far too dark.
- **Plaster on `medieval_limewash`:** use the design's washes directly as tints (0xf3ead8, 0xe8cf98,
  0xe9c9b8, 0xd9dccb). That gives cream, ochre, pink and green-grey. On `medieval_wall_01` they'd all
  come out tan, which is why the limewash version exists.
- **Limestone:** tint white ±6 % per block. The map is already the design's honey colour 0xd9c9a8.
- **Canvas:** it averages 0.83, so stall dyes come out about 17 % darker than the hex values. Use
  slightly brighter tints if they look dull.
- **Roof tints:** the design's 0xffffff, 0xe8c8b8, 0xd8a890 and 0xc8c0a0 work as tints on
  `clay_roof_tiles_03`.

**Repetition: use `textureFrame`.** The library projects each piece's maps from its own centre. So
every same-sized block shows the same patch of the map:
- **Limestone ashlar:** each block shows the same lichen spots in the same place. Give each block a
  `textureFrame` with the block's rotation and its position shifted by a seeded random offset of up to
  a tile. The block edges are real joints, so a jump in the texture at each block is right.
- **Rubble (`castle_wall_slates`) and plaster:** use one frame per wall, aligned with the wall, so the
  map runs on across blocks and panels and the wall reads as one surface. The rubble has a few pale
  stones that show every 2.5 m. That's fine on a wall, but avoid same-frame repeats on neighbouring
  blocks.
- **Cobbles (the ground):** distinctive stones repeat every 2.4 m. That's fine at eye level, but from
  the wall walk a grid shows. Break it up with something at a larger scale: patches of `rocky_trail_02`
  or a darker decal near walls and stalls, or a low-frequency vertex tint on the ground mesh.

**Normals and roughness**
- The generated sets' normals are derived from colour. Bumpiness, as the mean normal z: oak 0.90,
  limestone 0.95 (nearly flat dressed stone), broken limestone 0.88, daub 0.87, hay 0.86, canvas
  0.95. Raise or lower them with `normalScale` if they look off in the sun.
- Roughness means: oak 0.79, limestone 0.82, hay 0.86, canvas 0.88, daub 0.92.
- `cobblestone_floor_001`'s arm map shipped with an all-black occlusion channel. It's set to 1 here,
  which doesn't matter for `textured()`: that only reads G (roughness) and optionally B.

## Honest assessment, and what I'd redo

- **medieval_oak**: the best of the six. It's seamless and silver-grey, with straight vertical grain,
  long checks that the height map makes deep, and adze facets. The two peg holes repeat every metre
  along a timber, but they sit at u 0.24 and 0.85 of the tile, so most timbers centred on uv 0 never
  show them. I'd keep it.
- **medieval_limestone**: seamless, with claw tooling, pits and a few lichen spots. It came out too
  saturated (#ceb17f), so processing desaturated it to 60 % and moved its mean to honey-cream.
  The weak points:
  - faint ochre blotches repeat at the 1.5 m tile;
  - the derived height makes the pits read slightly like travertine.

  If anything gets redone, I'd regenerate this with "no lichen, very even colour" and let tint jitter
  do the variation. But it holds up with per-block `textureFrame` offsets.
- **medieval_limestone_broken**: convincing fracture facets and grit. The source has a little baked
  light, shadows under the facets from the upper left, which delighting doesn't remove. That's
  invisible on small broken faces. Keep.
- **medieval_daub_broken**: clay clods, straw and hazel rods. The rods are short separate segments,
  not continuous woven wattle. That's fine on broken faces seen for seconds. Keep.
- **medieval_hay**: dense golden stalks, mostly horizontal, and seamless. Faint horizontal density
  bands show at 2 × 2 but not on a 1 × 0.45 m bale face. Keep.
- **medieval_canvas**: a real plain weave at about 4 threads/cm, with slubs, near white. Seamless.
  Keep.
- **Poly Haven sets**: photoscans, so their normals and roughness are better than any derived set.
  - **Roof:** I compared `clay_roof_tiles_03` with the other free roofs. `clay_roof_tiles` and `_02`
    are Mediterranean barrel tiles. `roof_tiles_14` and `roof_07` are grey-green. `roof_3` has plain
    mossy tiles but averages olive (#937549), off the palette. So I kept the design's pick. Its tiles
    have a small moulded diamond, which is modern, but it doesn't read from the square.
  - **Plaster:** `medieval_wall_01` is beige-orange, so I made `medieval_limewash` from it: 30 %
    saturation, 85 % contrast, mean #dbd8ce.
  - **Boards:** `old_planks_02` is plain, worn and vertical. `medieval_wood` has iron studs, which
    would suit the gate leaves and the church door if you want a 13th material, but they look wrong on
    crates. I didn't fetch it.
- **Not made**: textures for glass (the design draws its came lattice in code), bronze and iron (the
  base `gen_iron_painted` is used). Tile insides use the base `gen_brick_broken`.

## How to remake

```
FAL_KEY=… PACK=medieval node scripts/assets/generate-textures.mjs     # only makes what's missing; --redo set:0
PACK=medieval python3 -I scripts/assets/process-textures.py           # scripts/assets/packs/medieval/textures.py
python3 -I scripts/assets/packs/medieval/polyhaven.py                 # the free sets, the limewash and the skies
```
