# Market Town props: report

Four props, as the design asked: `barrel`, `handcart`, `haywagon`, `basket`, in
`public/packs/medieval/models/` (GLB + `index.json`). Each is one GPT Image 2.5 concept (one take, no
retakes) turned into 3D by Tripo P2, repaired by `scripts/assets/packs/medieval/fix-props.py`, then
processed by the base `process-props.py`. I looked at every concept, the raw models from six sides,
the Cycles previews (`props/previews/`), and the props loaded into the running game (Brick Street's
road, WebGPU, standing and thrown by a blast).

## What each is, and how good

| Prop | Size (m, w × h × l) | Tris | Mass | Verdict |
|---|---|---|---|---|
| barrel | 0.64 × 0.90 × 0.64 | 6,929 | 0.14 | Good. Weathered silver-grey oak, three riveted iron hoops at each end, a plain head. Reads well from any side. |
| handcart | 1.52 × 0.76 × 2.40 | 9,899 | 0.12 | Good after repair. Plank bed with iron corner straps, two spoked wheels with iron tyres, two front legs, long handles. |
| haywagon | 1.83 × 2.11 × 4.20 | 15,839 | 1.0 | Good. Rack-sided wagon, four spoked wheels (rear larger), a short pole resting on the ground, a big hay heap. |
| basket | 0.44 × 0.32 × 0.50 | 9,899 | 0.015 | Good. Round willow basket heaped with red, green and yellow-green apples and a few leaves. |

What's weak, honestly:

- **barrel:** Tripo invented two taps on the side the concept didn't show (the prompt said "no tap").
  I removed them and covered the marks under them with the barrel's own staves taken from 50° round.
  Up close, a slightly different stave pattern shows where the patch is; from a step back it doesn't.
  6,929 triangles is more than a barrel needs: at 4,000, decimation stretched two faces over a dark
  UV-island edge next to the patch, and the extra triangles are what got rid of that.
- **handcart:** As generated, the wheels weren't on one axis: 10 cm apart along the cart and 5 cm in
  height, hanging below the legs. Nothing joined the hubs either. I put the wheels on one axis, level
  with the legs' feet, and added an axle-tree under the bed made from a stretched copy of its own
  shaft. That's fine from standing height but plain from below. The wheels are 0.72 m across, smaller
  than the 1 m asked, and stand about 35 cm out from the bed (a wide 1.5 m track). The collider is
  the hull of the whole cart, a wedge out to the handle tips, so nothing fits between the handles.
- **haywagon:** The hay edges are flat cards that read as hanging hay from a few metres but look like
  flat leaves up close. Tripo's de-lighting had left the hay a pale grey-khaki. I warmed the yellow
  texels toward a dry gold (sRGB about 186, 152, 96) so it sits with the hay-bale texture; the grey
  wood is unchanged. The collider's worst point is 10 cm inside a hay tuft (harmless).
- **basket:** Its footprint is a little oval (0.44 × 0.50). It needs about 10k triangles: at 4k the
  apples turned into faceted lumps. If the triangle total matters, about 6k is the lowest that still
  looks round.
- **All:** Tripo's textures had a flat blue-grey gutter between UV islands, and decimation stretches
  some faces over island edges. `fix-props.py` fills every gutter from the nearest island texel. That
  also keeps mipmaps from greying the edges at a distance.

## The pipeline (to redo or regenerate)

```
PACK=medieval node scripts/assets/generate-props.mjs concept | 3d          (paid; key inline)
PACK=medieval blender -b --factory-startup --python scripts/assets/packs/medieval/fix-props.py
PACK=medieval blender -b --factory-startup --python scripts/assets/process-props.py
```

`raw/<name>/model_tripo.glb` is each model as generated; `model.glb` is the repaired one that
`process-props.py` reads. The boxes in `fix-props.py` were measured on these particular generations:
after regenerating a prop, measure again or drop its entry. If Blender hangs at start (all Blender
processes here did for a while: they wait on `$XDG_RUNTIME_DIR/gvfs`, a FUSE mount that stopped
answering), run it with `XDG_RUNTIME_DIR` pointing at an empty directory.

## What I'd redo

- The handcart concept: ask for wheels close against the bed with an axle visible under it, so the 3D
  model gets it right and needs no repair.
- The barrel: a concept from slightly behind as well as in front (or a prompt that names the plain
  back), so Tripo has less to invent.
- The hay wagon's tufts: a concept with the hay heap more compact at the edges, with fewer
  overhanging wisps.

## Calls and cost

| Call | Count | Each | Total |
|---|---|---|---|
| GPT Image 2.5, high (2 at 1536 × 1024, 2 at 1024 × 1024) | 4 | $0.041 / $0.053 | $0.19 |
| Tripo P2 image-to-3D, detailed PBR textures | 4 | $1.20 | $4.80 |
| **Total** | 8 | | **about $4.99** |

That's 4 of the 4 image-to-3D generations and 4 of the 4 concept images allowed. Each call is in
`ledger.jsonl` (and `props/calls.jsonl`). Tripo P2 at detailed quality costs $1.20 a model, more
than Meshy's $0.80. I used it because the docs say the user prefers it.

## For the builder

- `props: ['/packs/medieval/models/']`; models arrive in `build()` as `models.barrel`,
  `models.handcart`, `models.haywagon`, `models.basket`.
- Each GLB is in metres, +Y up, its origin at the bottom centre (place it at ground height), with its
  front to -Z: the handcart's handles and the wagon's pole point -Z. A turn of `yaw(a)` about Y
  (as in `nyc/props.ts`) points the front along (-sin a, 0, -cos a). For the wagon at (9, -11):
  `yaw(+1.07)` points its pole straight at the gate (0, -16) and `yaw(+0.35)` turns it a little that
  way. The design's -0.35 would turn the pole away from the gate, toward the north-east.
- Sound material: `boards` (the design's choice) suits all four.
- Baskets on stall counters: set `position[1]` to the counter's top face. Barrels standing in groups
  should be at least 0.66 m apart centre to centre (diameter 0.643). Props placed overlapping each
  other or pieces get pushed apart violently on the first step (`nyc/props.ts` shows a bounds check).
- A barrel lying across two others is fine with a quarter turn about X, but then the origin is at
  one end of the barrel, not under its middle: its axis sits 0.32 m above whatever it lies on.
- Masses as the design gave them. A rocket beside a 0.14 t barrel throws it about 20 m (seen in
  the test). A full barrel would weigh about 0.25 t, if you want them to travel less far.
- Triangles, all instanced (one draw per prop type): 14 barrels ≈ 97k, 10 baskets ≈ 99k, 3 carts ≈
  30k, 1–2 wagons ≈ 16–32k, about 250k in all. Brick Street ran at 53–60 fps with a set of them added.
