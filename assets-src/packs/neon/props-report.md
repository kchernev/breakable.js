# Neon Alley props: report

Five props, all in `public/packs/neon/models/` (`index.json` lists them). Each is a GLB in metres
with y up, its front facing -Z, its origin at the bottom centre, a 12-point convex collider (standing
on four points) and a mass. The scooter's, the crates' and the bin's paint is tintable: each copy
takes its own colour (`addProp({ tint })`, see `props.ts`). (They were five props and nine
recoloured copies, 8.8 MB in all, until the prop pipeline could tint per copy; now 3.5 MB.) They have been loaded and placed in the running engine (in Brick
Street, through `loadPropPack`), shown standing, thrown by a blast and settling. The night previews
of the finished files are `props/previews/night_*.png`. The base previews (`<name>.png`, `_back`,
`_collider`) are rendered before `props-post.py` runs, so they show the cart's wheels before
their spokes were painted, and the paint grey (untinted).

## What was made

| Name | Size x × y × z (m) | Mass | Triangles | Made by | Quality |
|---|---|---|---|---|---|
| `scooter` | 0.81 × 1.24 × 1.85 | 0.11 | 13,858 | GPT Image 2.5 → Tripo P2 | Good. A clean, believable step-through scooter on its centre stand, with mint panels and off-white trim. Tripo drew pseudo-text on the licence plate, which is blanked. The thin mirror stalks will shimmer at a distance. |
| `cart` | 2.21 × 2.10 × 1.32 | 0.16 | 15,838 | GPT Image 2.5 → Tripo P2 | Good after fixes. The proportions, the red canopy, the wooden body, the steel counter, the wok and the pots all read well. Tripo made the spoked wheels into pale discs, and spokes, hub and rim are now painted on them (`spokes`). A few out-of-plane triangle fins near one hub show up close. The bulb under the canopy glows (emissive, strength 6). |
| `crates` | 1.26 × 0.93 × 0.45 | 0.02 | 616 | procedural (`crates.py`) | Very good for its cost. Two stacks of three, one blue and one red, stacked a little unevenly. The slots, hand-holes, ribs, lip, scuffs and grime are in the textures. They look a bit new. The slots are painted dark, not cut, so you can't see through them. |
| `crate` | 0.41 × 0.31 × 0.61 | 0.0015 | 124 | procedural (`crates.py`) | Very good. One open red crate. It is light, so blasts throw it far, which works well as clutter. |
| `bin` | 0.57 × 1.07 × 0.67 | 0.015 | 7,919 | GPT Image 2.5 → Tripo P2 | Good. A 240 L wheelie bin with a ribbed front, the lid closed, and no markings. The lid is a little lumpy. |

Paint (`paint` in `props.mjs`, made by `process-props.py`): the scooter's mint panels (hue 95–150°,
saturation from 0.02: they're barely saturated, and the cream trim is warmer, so it stays out), the
red crates (the stack's blue ones keep their colour), the bin's green. `props-night.py` renders the
tints as the game gives them (`previews/night_scooters.png`, `night_plastics.png`).

## How it went

- Concepts: one take each for the scooter, cart, crates and bin. All four were clean, with no text,
  the whole object in view and a plain background, so none needed a retake.
- 3D: Tripo P2 (the user's preferred generator). The scooter, cart and bin came out usable the
  first time. The crates did not. The sides Tripo couldn't see came out red-on-blue, with smeared
  hand-holes and no slots, and the thin walls crumpled when decimated. Crates are simple boxes, so
  I built them procedurally instead. That cost nothing and gave exact geometry. Tripo's crates are
  kept in `props/raw/crates/rejected/`.
- Fixes after Blender (`scripts/assets/packs/neon/props-post.py`, with the settings in `props.mjs`):
  - `blank`: the scooter's plate. The base `paintOut` took the black mudguard around the plate as
    the paint and would have turned the plate black, so the plate's UV rectangle is filled with its
    own white instead.
  - `spokes`: both cart wheels. Each wheel's plane and circle were fitted to the mesh (they lean out
    7°). Spokes, hub and rim are then painted onto a dark disc by each texel's 3D position.
  - (`glow`, the cart's bulb, and the colour `variants` were here too: the bulb's map is
    `process-props.py`'s own `glow` now, and the variants gave way to `paint` and tints.)
- The cart's size is set by height (2.1 m). Set by its 1.9 m length, it stood only 1.8 m tall, with
  the counter at hip height. Now the counter is at 0.94 m and the canopy's underside at about
  1.8 m.

## Budget

| Call | Count | Estimate |
|---|---|---|
| GPT Image 2.5 concepts (`openai/gpt-image-2.5/flare/text-to-image`, high) | 4 of 4 | ~$1.00 (~$0.25 each) |
| Tripo P2 image-to-3D (`tripo3d/p2/image-to-3d`, detailed PBR texture) | 4 of 4 (1 rejected: crates) | ~$2.00 (~$0.50 each; billed in $0.01 credits, the exact rate wasn't visible) |

Total about $3.00. Every call is in `assets-src/packs/neon/ledger.jsonl` (by: "props") and
`props/calls.jsonl`.

## For the builder

- `props: ['/packs/neon/models/']`. All models arrive in `build()` by name.
- Turn them as `nyc/props.ts` does: `rotation: yaw(a)`, where yaw 0 has the front facing -Z.
- Materials, for their sounds (from the design): scooters and cart `signbox`; crates, crate and
  bins `awning`.
- `scooter`: the long axis is z, with the front wheel at -z. Tint the copies differently and turn
  them 30–40° to the facade. The collider's footprint is about 0.8 × 1.85 m.
- `cart`: the long side faces -Z, with the handles at -x and the wheels at +x. The wheel hubs stick
  out to z ±0.66.
  - At S4, serving +z: yaw π.
  - At N7, serving -z: yaw 0.
  - The bulb sits at about (0.17, 1.6, 0) in the cart's frame. It glows by itself with bloom. If
    you spend one of the four point lights on a cart, put a warm one (0xffc080) there.
- `crates`: the row runs along x with a long side to the front. Stand them against
  a facade with yaw 0 (north row) or π (south row).
- `crate`: single crates to scatter loose near the cart and the crate stacks. They weigh 1.5 kg,
  so blasts send them flying.
- `bin`: the ribbed front faces -Z, with the wheels and hinge at +Z. To put the back to the wall,
  use yaw 0 on the north row (facade z = +3.75) and yaw π on the south row.
- Cost: about 98k triangles for seven scooters, 32k for two carts, 24k for three bins, and almost
  nothing for the crates. One draw per model part, whatever the tints.

## What I'd redo

- Cart wheels: replace the wheel geometry with a procedural wheel (rim, hub, spokes) instead of
  painting over Tripo's disc. That would remove the fins near the hub.
- Crates: more wear (faded tops, dirt in the slots, a cracked rim on one) so they look used.
- A fifth prop would be worth a generation if the budget allows: plastic stools and a folding table
  (street dining), or gas cylinders beside the carts.
