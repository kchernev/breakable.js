# Sun Temple props: report

Four props, all from one concept take and one Tripo P2 generation each (4 of 4 concept images,
4 of 4 image-to-3D generations; nothing redone). Output: `public/packs/temple/models/{statue,
tripod,amphora,lion}.glb` and `index.json` (4.8 MB together).

How they were made: `scripts/assets/packs/temple/props.mjs`, then `generate-props.mjs concept` and
`3d`, then `process-props.py`, then `scripts/assets/packs/temple/props-post.py` (a free colour grade
of the two bronzes). The previews are in `assets-src/packs/temple/props/previews/`.
`context.png` there shows all four under the world's sky (Poly Haven pizzo_pernice_puresky, sun 53°
up from the south-south-east, AgX), beside marble-coloured blocks the size of the statue base. The
statue and tripod `<name>*.png` previews were rendered before the grade. `context.png` shows them
after it.

All four were also loaded into the running demo through `loadPropPack` and `addProp` (in Brick
Street, since the temple world code didn't exist yet). They draw correctly and face -Z at rotation 0.
A blast threw the statue and the tripod, and they landed and rested cleanly on their hulls. The
lion (2.5 t) did not move.

## What each is, and how good

| Prop | Size (x, y, z) m | Tris | Mass | Verdict |
|---|---|---|---|---|
| `statue` | 1.10 × 2.40 × 0.75 | 19,799 | 0.6 | **Good.** It reads at once as a bronze Athena-type goddess: crested helmet, peplos with deep folds, upright spear, round shield at her left, low plinth. The face and drapery hold up at 3 m. The back is plausible: the shield shows a grip, and the helmet from behind is a little lumpy. The spear is thin but whole. After the grade it is warm bronze with blue-green verdigris. Tripo had made it a flat olive-grey with no metal. |
| `tripod` | 1.06 × 1.50 × 1.06 | 7,918 | 0.08 | **Fair.** Clean and solid, with both ring handles open. It reads as a bronze tripod cauldron from any distance. Two faults. Its fluted square legs on block feet look more neoclassical (a garden planter) than Geometric Greek; that was the concept, not the 3D. The top of one leg also pokes up inside the bowl as a small square post, visible from above or behind. The bowl's inside renders quite dark in dull light. |
| `amphora` | 0.48 × 1.05 × 0.48 | 3,959 | 0.03 | **Very good.** Clean ovoid body, open loop handles, chipped rim, two groups of three dark bands, small ring foot, bright buff-orange clay. On the back, one band has a small step where Tripo joined the unseen side. Lying on its side it looks right too. |
| `lion` | 0.84 × 1.99 × 1.90 | 13,860 | 2.5 | **Good from the front, weaker behind.** A strong seated lion on a squared plinth, with an ochre patina in the mane and grey lichen streaks. It is naturalistic (Renaissance or neoclassical), not Archaic as the design asked. Behind, Tripo invented the mane as rows of pinecone-like scales, and the haunch and tail are soft. The lions face the player, so the back is rarely seen. The plinth is a little greyer than the temple's marble. It is 2 m tall at 1.9 m long, monumental beside the 3.2 m ramp. |

Colliders: 24-point hulls covering 84–96 % of each model's hull volume. Worst vertex is 2–4 cm
outside the hull. The statue's hull includes the spear, so a fallen statue rests propped on the
spear and the shield rim.

## What I'd redo with more budget

- **Tripod**: a second concept asking for legs that flare out a little and run up the outside of the
  bowl to the rim (cast with relief bands, no block feet). I'd also make the ring handles sit right
  above two of the legs, as on the Olympia tripods. One concept plus one generation would do it.
- **Lion**: a concept with stiffer Archaic forms (the Naxian lions of Delos: lean, mane as a smooth
  ruff of flame locks, no flowing mane). I'd ask for the back of the mane to be described too, or
  generate from a side view so the hidden side is smaller.
- The leg stub inside the tripod's bowl could be painted out (a `paintOut` box only fixes texture,
  not geometry). It isn't worth a call.

## Notes for the builder

- Pack: `props: ['/packs/temple/models/']`. Every model stands on y = 0 at its origin (bottom
  centre) and faces -Z at rotation 0. `yaw(a)` turns the front -Z toward (-sin a, 0, -cos a): east
  (+x) is `a = -π/2`, east-south-east is `a = -1.963`.
- `statue` on the statue base's crown at (13, 2.1, 9): `rotation: yaw(-1.963)` faces east-south-east.
  Its footprint (1.10 × 0.75) fits the 1.6 m crown; the plinth is centred on the origin. Material
  `bronze`.
- `lion` ×2 at (12.6, 0, -8) and (12.6, 0, 0): `yaw(-π/2)` faces east. Material `marble`.
- `tripod` ×3, material `bronze`. On the votive column's abacus (0.95 m square, top 8.4), the feet
  are off-centre (the ring handles set the bounds). Shift it by local (+0.07, 0, +0.035) before
  turning so the feet span ±0.46 m and stand on the abacus; at `yaw(0)` the rings run along x. It is
  light (80 kg, per the design): a close blast throws it 15–20 m.
- `amphora` ×7, material `terracotta`. For the one lying by the altar: rotate 90° about x (or z) and
  put its origin at y = 0.24 (its belly radius is 0.241). Props stay fixed until a blast or a strike
  wakes them, so it holds that pose until then.
- The bronze sounds and the `bronze.clang` ring (DESIGN.md 7) come from the material you place them
  with. The props themselves never break.
- If anyone reruns `process-props.py`, they must run
  `PACK=temple python3 -I scripts/assets/packs/temple/props-post.py` afterwards, or the statue and
  tripod lose their bronze grade. A graded file is marked, and a second run leaves it alone.

## Calls and spend

| Call | Count | Estimate |
|---|---|---|
| GPT Image 2.5 concept (high) | 4 | ~$0.20 each |
| Tripo P2 image-to-3D (detailed PBR) | 4 | ~$0.50 each |
| Total | 8 | **~$2.80** |

These are estimates: the fal usage API isn't open to this key. They are logged in
`assets-src/packs/temple/ledger.jsonl` (`"by":"props"`) and, by the generator, in
`assets-src/packs/temple/props/calls.jsonl`. No 429s or 5xx came back, so nothing was retried.
