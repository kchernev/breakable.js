# Dust Town textures: report

What the textures agent made for Dust Town, how good each piece is, and what I'd redo.

## Made

- Six texture sets as 1k WebP triplets (`<set>_diff_1k.webp`, `_nor_gl_1k.webp`, `_arm_1k.webp`) in
  `public/packs/western/textures/` (5.9 MB in all).
- The sky: `public/packs/western/hdri/goegap_1k.hdr` (Poly Haven, CC0, 1.4 MB).
- The lists: `scripts/assets/packs/western/textures.mjs` (prompts) and `textures.py` (processing).
- The raws, each with a `.json` of how it was made, are in `assets-src/packs/western/textures/raw/`.
  The previews (2×2 colour, 2×2 lit, and a crop where four tiles meet) are in `.../textures/previews/`.

| Set | Raw | One tile | Mean colour (untinted) | Rough / metal | Verdict |
|---|---|---|---|---|---|
| `western_siding` | take 1, 1024×1536 | 0.90 m, 6 boards of 15 cm | 0xb8b2ab | 0.82 / 0 | Good |
| `western_timber` | 1536² | ~0.9 m of wood, mapped to 1 m | 0x9e9282 | 0.83 / 0 | Good |
| `western_tin` | 1536² | 9 ridges (0.684 m at 7.6 cm) | 0x8b847f | 0.45 zinc, 0.85 rust / 0.85 zinc, 0.1 rust | Good |
| `western_adobe` | 1536² | ~1.75 m of wall, mapped to 2 m | 0xc6a076 | 0.92 / 0 | Fair to good |
| `western_dirt` | 2048² | ~3.5 m of ground, mapped to 4 m | 0xc8a77c | 0.95 / 0 | Good up close |
| `western_splinter` | 1024² | ~0.45 m, mapped to 0.5 m | 0xd9c69d | 0.78 / 0 | Good |

## Each set, honestly

**Siding.**
- How it's made:
  - The lap lines are found and the middle 6 boards cut out lap to lap.
  - The boards' length wraps where the outer nail columns meet.
  - Each board then slides along by its own amount.
  - The height is a true lap profile, in pixels of 0.88 mm: each face rises 12 px to its thick lower
    edge, then drops onto the next board.
- What it looks like: in the render the laps read clearly, in sun and in shade.
- Take 0 failed. Every board was painted on the left and bare on the right in long runs. Unslid, that
  tiles as vertical bands; slid, as a wall of brick (staggered 45 × 15 cm light and dark blocks).
  Take 1 asked for small flakes spread evenly and fixed it.
- Weak points:
  - The raw is narrower than its 6 boards are tall, so the flakes and grain are stretched about 1.3×
    along the boards. It doesn't show.
  - About a third of the paint is gone, not half as the design asked.
  - The nails are scattered, not in stud lines, because of the slide.

**Timber.**
- Silver-grey to grey-brown, raised grain, deep checks, grain top to bottom.
- Weak point: three knots and three nail holes per tile. They repeat noticeably on big flat timber
  surfaces (the barn walls), but are fine on posts, beams and planks.

**Tin.**
- How it's made:
  - The model drew about 10 ridges in the frame, not 13, so a 13-ridge tile couldn't be cut.
  - Each row is resampled so the crests fall exactly 1/9 of the tile apart, which also straightens them.
  - The corrugations' baked shading is divided out of the colour. A true cosine profile (18 mm deep at
    7.6 cm) makes them in the normal map, so they light correctly from any side.
  - Nails sit on the crests and rust streaks run in the valleys.
- In the render it reads as old galvanised iron.
- Weak points:
  - In full sun it's a fairly bright, clean silver.
  - There's one row of nails per tile, so a nail line every 0.68 m down the roof.

**Adobe.**
- Changes in processing:
  - The model added four eroded patches with mud bricks showing. At one tile per 2 m they would make a
    regular grid of spots over the chapel, so all four are filled with plaster from elsewhere in the
    image (Poisson clone).
  - The first render looked like cardboard, because all its relief was fine grain. It now has a
    made-up, tiling, hand-smoothed undulation (5–30 cm) in the height, which catches the light like
    mud plaster.
- Weak point: it's plain. There is no eroded patch, drip or base wear; the geometry and the breaks
  have to give the character.

**Dirt.**
- Even and patternless, with no seams.
- I set its mean to the design's dirt colour 0xc9a77c rather than the street's 0xd3b994: at
  0xd3b994 it rendered nearly white under the design's sun.
- Not checked: how the 4 m repeat looks over the whole 70 × 50 m ground and the desert beyond.
  Expect some visible repetition from height at long range.

**Splinter.**
- Pale torn pine fibres with grey weathered streaks and amber resin.
- The library multiplies an `insideTexture` by the material's `inside` colour. So this map carries
  the colour itself (near the design's 0xe0caa0), and `inside` should be white.
- I tried a neutral grey version first, so that `inside` would give the hue. It clipped a quarter of
  the pixels.

**HDRI.**
- It's goegap 1k, as the design picked: the sun is at 46.8° elevation.
- Note for the builder: the rock pile and peak in the photo rise 12–20° above the horizon at some
  azimuths, not "just above" it. The haze skirt or the mesas must cover that much, or use the fallback.

## How I checked

- I looked at every preview.
- I rendered planes of each set in Chrome (WebGPU, display :102) under the design's light:
  - goegap with environment 0.65 and background 0.8
  - sun 0xfff1dc × 4.0 at azimuth 1.30, with shadows
  - the hemisphere light from §3.2
  - AgX at exposure 1.05
- Views were from 3 m to 11 m, sunlit (south-facing) and shaded (north-facing), and from above for
  the roof. The page was temporary and is deleted.
- The whole scene renders very pale with these settings. That is in the brief (bleached), but if the
  town looks washed out, try sun 3.2–3.5 or exposure 0.9 before changing any texture.

## Using them (for the builder)

```ts
const base = '/packs/western/textures/';
// Siding: uvScale 1 / 0.9. One textureFrame per wall with its origin on a lap line (the sill top at
// y 0.30): v = 0 and every 0.15 m is a lap shadow, so the course joints hide in them. Image top = up.
textured('western_siding', { base })
// Timber: uvScale 1, grain along v (lay beams along local y, planks along local z, as §2.1 says)
textured('western_timber', { base })
// Tin: metalness 1 is needed: textured() defaults metalness to 0, and the map multiplies it.
// uvScale 1 / 0.684 (= 1.46) for 7.6 cm ridges; uvScale 1 gives 11 cm ridges. Ridges along v.
// If it looks too new, roughness 1.15 dulls it (the option multiplies the map)
textured('western_tin', { base, metalMap: true, metalness: 1 })
// Adobe: uvScale 0.5, and one shared textureFrame per wall. Without it every 1.4 m block shows the
// same middle of the tile, and the joints show as seams
textured('western_adobe', { base })
// Ground: one tile per 4 m (repeat(m, sizeX / 4, sizeZ / 4)). It is the dirt colour untinted. A
// paler street is color: new THREE.Color(1.06, 1.08, 1.12) (linear multipliers); the full 0xd3b994
// would be (1.12, 1.26, 1.47), which renders nearly white
textured('western_dirt', { base })
// Broken wood: inside white, since the map is the colour
{ inside: 0xffffff, insideTexture: inside('western_splinter', 2, { base }) }
// Hay: 0xe6c870 alone on the grey timber gives a drab olive (about 0x8f7335). For the hay colour:
textured('western_timber', { base, color: new THREE.Color(2.3, 2.0, 0.73) })  // uvScale 3
```

## What I'd redo

- **Siding**: a wider raw (1536 wide, 8 boards) so the boards aren't stretched along their length,
  and a little more bare wood (the design asked for half).
- **Timber**: one knot, not three, for the barn walls. Or a second, knot-free take for large surfaces.
- **Dirt**: a second, coarser ground set, or macro variation in the ground shader, to break the 4 m
  repeat over the desert.
- **Adobe**: maybe one rare eroded patch, placed by the builder as a separate decal-like piece rather
  than in the tile.

## Budget

| What | Images | Estimate |
|---|---|---|
| 6 sets, take 0 (siding 1024×1536, timber/tin/adobe 1536², dirt 2048², splinter 1024²) | 6 | $0.67 |
| Siding take 1 (redo) | 1 | $0.04 |
| **Total** | **7 of my 8** | **≈ $0.71** |

All seven are in `assets-src/packs/western/ledger.jsonl`. fal lists GPT Image 2.5 high at $0.053 for
1024², $0.041 for 1024×1536 and $0.055 for 2560×1440. The 1536² ($0.12) and 2048² ($0.21) figures
are my overestimates by pixel count. The HDRI was free.

## Added in phase E: the street's ground

Two more sets for the breakable street (`src/demo/worlds/western/scenery.ts`), one take each, both
used as made ($0.12 each by pixel count, in the ledger):

| Set | Raw | One tile | Mean colour | Rough / metal | What for |
|---|---|---|---|---|---|
| `western_earth` | 1536², take 0 | ~0.9 m, mapped to 1 m | 0xa47a5a | 0.95 / 0 | The earth under the street: a crater's floor and its lower sides, the earth's clods, the drawn bed and pit walls (times 0xccc0b4 there: browner in the sun) |
| `western_dirt_broken` | 1536², take 0 | ~0.9 m, mapped to 1 m | 0xc09c70 | 0.96 / 0 | The packed dirt where it breaks: a crater's rim, the street's clods, the slabs' sides |

Both are made like `western_dirt` (`earth()` and `dirt_broken()` in `textures.py`): the overlap
cut, the mean set, lumps up and the gaps between them down. The dirt crust over the earth reads in a
crater's side as a pale band over red-brown. Neither repeats visibly at the sizes a crater shows.

## Library requests (not made)

1. **Tint through a mask.** A per-piece tint colours the whole surface, so the siding's bare grey wood
   takes the building's paint colour too (oxblood wood, mustard wood). A `BreakableMaterial.tintMask`
   (say, a channel of the arm map that limits the tint) would let the paint carry the colour while
   the bare wood stays grey.
2. **`textured()` with `metalMap`** (src/demo/textures.ts) should default `metalness` to 1. With the
   default 0, the metalness map is multiplied by 0, and a material that asks for `metalMap: true`
   silently isn't metal.
