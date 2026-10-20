# Dust Town props: report

Four props from DESIGN.md §5, all made and in `public/packs/western/models/` (with `index.json`).
List and prompts: `scripts/assets/packs/western/props.mjs`. Raw files, prompts and settings:
`assets-src/packs/western/props/raw/<name>/`. Previews (front, back, collider):
`assets-src/packs/western/props/previews/`.

## Calls and cost

| What | Endpoint | Calls | Each | Total |
|---|---|---|---|---|
| Concept images (one take per prop, all used) | `openai/gpt-image-2.5/flare/text-to-image`, high | 4 | $0.04–0.05 | ~$0.19 |
| Image to 3D (detailed PBR textures) | `tripo3d/p2/image-to-3d` | 4 | $1.20 | $4.80 |
| **Total** | | 8 | | **~$4.99** |

All eight are in `assets-src/packs/western/ledger.jsonl` (`"by":"props"`) and in
`assets-src/packs/western/props/calls.jsonl`. No regenerations. I used Tripo P2 rather than Meshy, as
docs/making-a-world.md advises. On fal it costs $1.20 a model against Meshy's $0.80, so it is not
cheaper there, but it reconstructed the wagon's spokes and the chair's slats as real open geometry.

## What was made, and how good it is

| Prop | Size x × y × z (m) | Tris | Mass | Verdict |
|---|---|---|---|---|
| `wagon` | 2.32 × 1.71 × 5.20 | 19,799 | 0.7 | **Good.** It is the best of the four. The bed is bleached grey planks with traces of faded red paint, iron corner straps and bolts, and a seat on springs with iron hand rails. It has four twelve-spoke wheels with iron tyres; the spokes are open (you see through the wheels), and the rear wheels (1.37 m) are taller than the front (1.13 m). It reads well in three.js under the goegap sky. Flaws: the wheels sit wide (about a 2.0 m track and 2.32 m across the hubs, where a farm wagon is about 1.5 m and 1.9 m), though the bed is the right 1.1 m. The tongue tip is 0.23 m off the ground, not resting on it; it reads as held up by the front gear. The unseen right side got an invented diagonal dark strap, and under the seat inside the bed there is a sloping board. |
| `safe` | 0.63 × 0.95 × 0.60 | 3,960 | 0.6 | **Very good.** The body is black and worn at the edges. The door has a faded dark-red panel with a thin gold pinstripe border and curled corners, a brass dial and a T-handle, hinges, a stepped plinth and castors. It has no lettering; the dial has tick marks too small to read. The back (which the concept couldn't show) has a plain raised square plate. Tripo's metal map marks the black paint as about 0.8 metal; with a near-black colour that looks the same as black paint, so I left it. |
| `pump` | 0.26 × 1.30 × 0.78 | 4,949 | 0.06 | **Very good.** A rusty, pitted black cast-iron pitcher pump bolted to a grey checked timber post, with a curved handle ending in a ball. Clean silhouette. The collider is top-heavy: the post's base is narrow while the spout and handle span 0.78 m, so once woken it topples easily. That suits a prop. |
| `rocking_chair` | 0.59 × 1.00 × 0.84 | 7,920 | 0.012 | **Good.** It is unpainted silver-grey weathered wood with a curved top rail, turned arm posts, stretchers and long rockers, and it casts a proper slatted shadow. The back has seven flat slats rather than the round spindles the prompt asked for (the concept drew slats); they are open, so you can see through the back. |

Orientation: every prop faces -Z (three.js) with +Y up and its origin at the bottom centre of its
bounding box. I checked this with orthographic views from each side, not just the previews.
- **wagon**: the tongue points to -Z.
- **safe**: the door faces -Z (`yaw -90`).
- **pump**: the spout points to -Z (`yaw 180`).
- **rocking_chair**: the seat faces -Z (`yaw 180`).

Nothing needed `paintOut`: none of the models invented lettering or badges.

## Notes for the builder

- **Pack:** `props: ['/packs/western/models/']`; the models arrive in `build(d, models)` as `models.wagon`,
  `models.safe`, `models.pump` and `models.rocking_chair`.
- **Facing:** fronts are -Z. With nyc's `yaw(a)` helper (rotation about +Y), `a = 0` faces -Z, which is
  the north row looking at the street. `a = Math.PI` faces +Z, the south row looking at the street.
  `a = ±Math.PI / 2` points the front along -X or +X, along the street.
- **Materials (sounds):** the wagon and rocking_chair use `timber`; the safe and pump use `iron`, as the design says.
- **Wagon:** the origin is the centre of the box that includes the tongue, not the centre of the bed.
  - The bed runs from z -0.70 to +2.54 (centre +0.92), and its top is at y 1.59.
  - The front hubs are at z -0.34 and the rear hubs at +1.93.
  - The tongue runs from about z -0.9 to -2.6.
  - Wheel planes are at x ±1.0, and the hubs stick out to ±1.16.

  Its collider is one convex hull, so it fills a wedge from the bed's front down to the tongue tip:
  debris landing just above the tongue rests on air. Keep barrels and crates out of the 1.7 m in
  front of the front wheels. For "(-27, 0, +4.5), 20° off the street", use `yaw(Math.PI / 2 + 0.35)`
  or `yaw(-Math.PI / 2 - 0.35)`, depending on which way the tongue should point.
- **Safe:** for the spot against the bank's back wall at (+5.5, 0.40, +18.6), use `yaw(0)` so the
  door faces the street. It is 0.60 deep, so it spans z 18.3 to 18.9; keep 2 cm clear of the
  wall's inner face.
- **Pump:** the post is about 0.2 m square, and the spout reaches about 0.39 m in front of the
  centre. Turn it so the spout is over the trough (spout = -Z).
- **Rocking chair:** the collider's bottom follows the rockers' curve. Placed `loose: true` (as
  the design has it), a chair may rock a little before it settles; I haven't checked this in the
  solver. Leave `loose` off if you want it perfectly still until something hits it.
- The props are about 3.5 MB of GLB in all (the wagon is 1.9 MB with 2k textures; the rest use 1k
  textures).

## What I'd redo, with more budget

1. **Wagon:** a second concept seen from the right-hand side, to fix the invented strap and the board
   inside. I'd also ask for a narrower track ("wheels close under the bed, track about 1.5 m"), and
   a tongue drawn lying flat on the ground.
2. **Colliders:** a wagon (and to a lesser degree the pump and chair) would want two or three hulls,
   which the library's `PropModel.collider` (one hull) can't take. That's a library change (below),
   not a redo.
3. **Safe:** nothing worth a regeneration. A pipeline option to clamp a prop's metalness, for
   painted parts, would make it slightly more correct.

## Requests (not made)

- **Library:** compound prop colliders (`PropModel.colliders: V3[][]`, several convex hulls on one
  body). The wagon (bed, axles, tongue), the rocking chair (seat and rockers) and the pump (post,
  head) would then collide as they look.
- **Asset pipeline (`process-props.py`):**
  - a per-prop non-uniform scale, which would narrow the wagon's track without a regeneration;
  - per-prop limits on the metal/roughness maps, such as metalness ≤ 0.1 on wood and on painted
    iron.
