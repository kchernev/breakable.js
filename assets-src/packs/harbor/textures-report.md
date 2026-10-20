# Harbor Yard textures: report

Six texture sets and the sky. Six GPT Image 2.5 images (high quality), one take each, no redos.
Lists: `scripts/assets/packs/harbor/textures.mjs` (prompts) and `textures.py` (processing). Raws
and prompts: `textures/raw/`. Previews (2 x 2 tiles, lit by the normal map, and a full-size crop
across the wrap): `textures/previews/`. `previews/check_*.jpg` are renders of the maps on boxes and
panels under the HDRI with fog (a three.js WebGL page with standard materials and AgX: close to the
demo, but not the demo).

## What there is

All in `public/packs/harbor/textures/`, 1k WebP: `<set>_diff_1k`, `_nor_gl_1k`, `_arm_1k`.

| Set | Tile | uvScale | Tint / notes |
|---|---|---|---|
| `harbor_container` | 6 ribs = 1.71 m | **0.585** (28.5 cm ribs; the design's 0.5 gives 33 cm) | Paint neutral at 0.7 linear: the tint is the colour. Ribs run up the side faces (v is up), rust streaks run down. Extra: `harbor_container_rust_1k.webp` (rust mask, see below) |
| `harbor_cladding` | 4 ribs = 1 m | **1.0** (25 cm ribs) | Box profile (narrow ribs, wide pans), a different sheet from the containers'. Neutral pale: tint `0x8f9a94` walls, `0x7c8288` roof |
| `harbor_steel_painted` | 1 m | 1.0 for members; **0.35 to 0.5 on tanks** | Neutral pale paint, chips to primer and rust blooms. Crane `0xd0a848`, frame `0x5c6a72`, tanks white |
| `harbor_yard_concrete` | 2 x 2 slabs of 4 m = **8 m** | ground: `repeat(m, sizeX / 8, sizeZ / 8)` | Joints at the tile's edges and middle: line a tile edge up with the quay edge. Dry concrete is 0.6 sRGB; `color: 0xd6d7d5` gives the palette's `0x7f817e`. Roughness 0.74 (damp), the puddle 0.07 to 0.2: keep the roughness map and turn on `look.reflections` |
| `harbor_pallet_wood` | 1 m | 1.0 | Grain along the frame's x (u on top, bottom and the faces facing z). A board along z needs its texture frame turned 90° about y, or its grain runs across it |
| `harbor_roller_door` | 9 slats = 0.75 m | **1.333** (8.3 cm slats) | Slats run across the faces (v is up). Neutral at 0.6 linear; tint `0xa8acaa`. B (metalness) is 0.6 on clean zinc and 0 in the grime: `metalMap: true` with `metalness: 1` makes it read as metal |

The `arm` maps: R occlusion (from the profile: dark in the corners of the ribs), G roughness,
B metalness (0 everywhere except the roller door).

Rust under a tint: the tint multiplies the whole colour, so rust spots on a navy or green box come
out near-black. To keep them rust-coloured, the container material can divide the tint back out
where the mask says rust (FragmentMesh multiplies `colorNode` by the piece's `tint` attribute). Not
tried in the engine:

```ts
import { attribute, mix, texture as sample, uv, vec4 } from 'three/tsl';
const base = '/packs/harbor/textures/';
const skin = textured('harbor_container', { base, metalness: 0.15 });
const diffuse = sample(skin.map!, uv()).rgb;
const rust = sample(texture('harbor_container_rust', false, base), uv()).r;
skin.colorNode = vec4(mix(diffuse, diffuse.div(attribute('tint', 'vec3').max(0.03)), rust.mul(0.9)), 1);
```

Variety: give each container's texture frame its own random offset (0 to 1.7 m along its length
and up), or every box shows the same rust spots in the same places.

## The sky

`public/packs/harbor/hdri/kloofendal_overcast_puresky_1k.hdr` (Poly Haven, CC0, 1024 x 512).
A soft overcast. Its brightest patch, which `sky.ts` turns to `azimuth`, is a glow about 23° up; the
brightest texels all sit in it, so the turn is stable. Its horizon is linear (0.68, 0.72, 0.81),
so at `background: 0.8` it shows as about `#c2c9d4`, lighter and bluer than the design's fog
`0x9aa5ad`. Far scenery will show as grey shapes against a paler sky. If the fog should melt into the
horizon instead, try a fog colour close to `0xb4bcc6`. 1k is enough: the sky has no sharp detail.

## How good each is (honest)

- **harbor_container: good.** It reads as a weathered container in the check render, in every
  tint. The ribs' profile is made from a trapezoid fitted to the image, so the normals are clean.
  Weak points: only 6 ribs a tile, so the rust spots repeat every 1.71 m (7 times along a 40 ft
  box). Faint light and dark lines along each rib's sloping faces are image shading left in the
  colour; under a tint they look like worn edges. Rust goes dark under dark tints unless the mask
  is used.
- **harbor_cladding: good.** Clean and simple, clearly a different sheet from the containers'.
  It's quite clean, by design (a warehouse in use). The streaks that hung from the top of the
  image were evened out, so the tile doesn't repeat a band.
- **harbor_steel_painted: fair.** It looks right on the crane leg after I faded the many small
  chips, which had speckled it like a sponge. On an 8 m tank, 1 m of rust blooms repeats in a
  visible grid. Use a larger tile there and a lower normalScale, or make a tank texture (below).
- **harbor_yard_concrete: good, with caveats.** Wet slabs, tyre tracks, oil and one puddle that
  reflects. Every 8 m the same puddle and the same tyre track come round again: plain from above,
  softer at eye level in the fog. The joints are drawn, not taken from the image (its joints were
  9 cm black bands), so they're clean, even lines. Tyre marks and oil count as damp too, so they're
  a little glossy. The image's fine relief is a bit pebbly for trowelled concrete:
  `normalScale` 0.5 to 0.7.
- **harbor_pallet_wood: good.** Rough-sawn spruce with knots and nails. Grey smudges repeat at 1 m,
  which is barely visible on 1.2 m boards.
- **harbor_roller_door: fair to good.** The slats and grooves read well. The galvanised spangle is
  coarse and contrasty, and a few vertical streaks repeat every 0.75 m.

## What I'd redo (2 of the world's 12 images are left: props used 4, textures 6)

1. A tank texture: white paint, long rust runs from a top seam, 3 m frame. The tanks are the
   largest single painted surfaces in the yard.
2. Concrete: a second 2048 take, laying 3 x 3 slabs from both (a 12 m tile with more distinct slabs
   and two puddles). A 1k map over 12 m is 11.7 mm a pixel, so it may want a 2k map.
3. Container: a wider image (2048 x 1536) for 8 or 9 ribs a tile, so the rust repeats less.

## Calls

| Set | Image | Estimate |
|---|---|---|
| harbor_container | 1536 x 1536 | $0.25 |
| harbor_cladding | 1536 x 1536 | $0.25 |
| harbor_yard_concrete | 2048 x 2048 | $0.40 |
| harbor_steel_painted | 1024 x 1024 | $0.17 |
| harbor_pallet_wood | 1024 x 1024 | $0.17 |
| harbor_roller_door | 1024 x 1024 | $0.17 |
| **Total** | 6 images | **~$1.41** |

The estimates are on the high side. fal lists the endpoint's price only in "units", and the props
maker's ledger lines use $0.06 a concept. My ledger lines use the field `cost` (the others use
`costUSD`). I left them as they are rather than rewrite a file the other agents append to.
The HDRI download was free.

## Phase E: the breakable apron

- `harbor_gravel` (1024 x 1024, take 0; ledger $0.25, an estimate): crushed grey stone under the
  yard's slabs, the apron's lower layer and its bed, seen in a crater. `gravel` in `textures.py`:
  the stones stand out of the grit (the height from the luminance's high-pass). Good at once:
  angular stones in mid and dark greys with a few pale and bluish ones, no soil, tiles cleanly.
- `harbor_slab_broken`: no generation. The base pack's `gen_concrete_broken` raw, copied, processed
  as the base set is (`concrete_broken`), with the ends of the reinforcement's bars painted in
  (`slab_broken`: two rows, 0.065 and 0.235 m down, a bar every 0.2 m, rust round each and a stain
  run down from it). The second image this phase allowed wasn't needed.
