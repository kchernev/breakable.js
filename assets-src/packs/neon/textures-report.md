# Neon Alley: textures report

Six GPT Image 2.5 images (one take each, no retakes), processed into seven 1k WebP sets in
`public/packs/neon/textures/`, plus a puddle mask, plus the sky HDRI. Estimated spend: $1.65 (five
1024² images at about $0.25 and one 1536² image at about $0.40). The fal pricing API reports this
endpoint only in "units", so these are estimates; see `ledger.jsonl`. Two of my eight images are
unused, so the world has used 9 of its 12 so far (3 prop concepts and 6 textures).

Lists: `scripts/assets/packs/neon/textures.mjs` (the prompts) and `scripts/assets/packs/neon/textures.py`
(the processing). Previews are in `assets-src/packs/neon/textures/previews/`. Rebuild with:
`PACK=neon python3 -I scripts/assets/process-textures.py [set ...]`

None of these have been seen in the engine yet, because the world had no code when they were made.
Look at them in the first screenshots.

## The sets

| Set | Tile | Quality | Notes |
|---|---|---|---|
| `neon_tile` | 1 m, 10 × 10 tiles of 10 cm | Good | The raw grid was straight (131 px period, the same in every band). It is cut 10 × 10 from joint centre to joint centre, stretched onto an exact grid, and the wrap falls in the middle of a grout line. Each tile's shade is pulled halfway to the median, because a few dark tiles marked out the 1 m repeat. Height comes from the known grout lines, with a 2.5 px rounded tile edge. Roughness: glaze 0.16, grime up to 0.31, grout 0.8. |
| `neon_concrete` | 2 m | OK | Mid grey (median about 0.49), with stains, efflorescence, pits and two round repair patches. The vertical streaks are toned down about 40% with a tall, narrow flattening. The patches are still recognisable when the tile repeats. Roughness is 0.86, minus 0.12 on stains and plus 0.06 on efflorescence. |
| `neon_render` | 2 m | OK | Near white (median about 0.79), so the per-building tints read true, with mould streaks, damp patches and flaked spots set lower in the height map. The mould streaks still form visible rows every 2 m, even after toning them down: they come from the top of the frame. Roughness about 0.88. |
| `neon_asphalt` | 4 m | Fair | The design's set, with puddles in all the maps: roughness 0.42 − 0.39 × puddle, so 0.03 in the puddles, and flat height there. Puddles cover 17%. **Weak:** they are rounded blobs that repeat every 4 m, so over the alley they form a lattice, and with reflections on they are the brightest thing on the ground. Prefer the next row. |
| `neon_asphalt_dry` | 4 m | Good | The same image with its 9 puddles filled in, each with asphalt copied from the least-puddled offset and feathered in. The fill can't be seen at full size. Roughness about 0.42. Use it with the mask below to place puddles that don't repeat. |
| `neon_asphalt_puddle` | 4 m | Good | One grey map (R = G = B): 1 in puddles, 0 elsewhere, with soft 2 to 3 px edges. It matches `neon_asphalt` exactly. |
| `neon_shutter` | 1 m, 11 slats (9.1 cm) | Good | The model drew 12.5 slats rather than 16. The 11 whole ones are re-laid seam to seam, so both wraps fall on a seam. The baked corrugation shading is 70% removed, and the height comes from a slat profile (a rounded bulge and a groove at each seam). Roughness 0.5, up to 0.8 on rust. Metalness 0.35 on bare zinc and 0 on rust and paint; the paint is told apart from the zinc only by a faint hue, so that split is rough. Up close the slats look a little too round. |
| `neon_metal` | 1 m | Good | Light grey enamel (about 0.70), so the steel and vending-machine tints read true, with rust spots and drips and fine scratches. Processed with the base `iron_painted`. Its scratch detection finds nothing on light paint, so metalness is about 0 everywhere, which suits the design's constant metalness 0.2. |

Sky: `public/packs/neon/hdri/kloppenheim_07_puresky_1k.hdr` (Poly Haven, CC0; 1.3 MB). It is a
cloud deck with a moon gap and a few stars, and dim (median radiance 0.23, the moon about 14). I
compared it with the 2k: the 2k has slightly crisper cloud edges and stars. In this world only a
narrow strip of sky shows, at background 0.4, behind rain and fog, so the 1k is in. If the strip
looks soft in screenshots, the 2k is at
`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloppenheim_07_puresky_2k.hdr` (5 MB).

## How to use them (for the builder)

All sets load with `{ base: '/packs/neon/textures/' }`.

- **Line the maps up across pieces.** By default each piece's texture is centred on the piece
  itself (`Destruction` uses the piece's own pose when no `textureFrame` is given). Then grout
  lines and shutter seams jump at every piece edge, and same-sized pieces show the same patch. Give
  every tile piece of one facade the same `textureFrame` (for example the lot's facade origin, with
  the lot's rotation), and the same for each shutter's slats. The tile map has a grout line at
  u, v = 0, so with uvScale 1 the joints fall on whole 0.1 m steps from the frame's origin.
- `tile`: `textured('neon_tile', { base, normalScale: 0.8 })`, `uvScale: 1`. The glaze is glossy
  (0.16 to 0.3), so with SSR it picks up some neon. If it looks like wet plastic, pass
  `roughness: 1.5` (it multiplies the map).
- `concrete`: `textured('neon_concrete', { base, roughness: 0.75 })` (wet), `uvScale: 0.5`.
- `render`: `textured('neon_render', { base })`, `uvScale: 0.5`, tinted per building.
- `signbox` / `steel`: `textured('neon_metal', { base, metalness: 0.2 })`, `uvScale: 1`, with the
  tints from the design.
- `shutter`: `textured('neon_shutter', { base, metalMap: true, metalness: 1 })`. With
  `metalMap` the map's blue channel (0 to 0.35) is multiplied by `metalness`, and `textured()`
  defaults that to 0, so pass 1. `uvScale: 1` gives 9.1 cm slats; 1.2 gives the design's 7.5 cm.
  The slats run along u (horizontal on a shutter facing ±z or ±x).
- **The street** (scenery):
  - Simple, as designed: `repeat(textured('neon_asphalt', { base }), L / 4, L / 4)`. Expect the
    puddle lattice described above.
  - Better: take colour, normal and AO from `neon_asphalt_dry` and place puddles in TSL.
    - `p = texture(texture('neon_asphalt_puddle', false, base), uvP).r`, where `uvP` is world
      xz / 5.3 m turned by about 0.6 rad, so it doesn't line up with the 4 m colour repeat.
    - Multiply `p` by a world-space noise of about 8 to 10 m, `smoothstep(0.35, 0.65, noise)`,
      so about half the puddles go.
    - Where `p` is high: roughness `mix(armG, 0.03, p)`, the normal mixed toward flat, the
      colour × `(1 − 0.25 p)`, and the ripples × `p`. Gutters as in the design.
  - Load the mask as non-colour data (`texture(name, false, base)`); its RGB are all the mask.
- **The metalness channel of the non-metal sets is not exactly 0.** WebP's chroma subsampling
  leaks up to about 0.1 into blue next to sharp edges (tile grout, puddle rims). The base pack's
  sets do the same. Don't set `metalMap` on those sets.

## What I'd redo, with more budget or time

- **Asphalt**: a take with smaller, shallower, more irregular puddles that hug cracks and edges,
  or none at all, now that the dry set and the mask exist.
- **Render**: a take without streaks that start at the top of the frame (ask for streaks "of
  varying length throughout"), so the 2 m repeat stops showing as rows.
- **Shutter**: ask for flatter, wider slats ("shallow trapezoidal corrugation") and an explicit
  difference between the paint and the bare zinc, so the metalness split is cleaner.
- I'd spend neither spare image until the world is on screen. Night light, bloom and rain hide
  much of this, and a retake should answer what the screenshots show.
