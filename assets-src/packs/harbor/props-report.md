# Harbor Yard props: report

Four props, one concept and one image-to-3D take each (GPT Image 2.5, then Tripo P2), cleaned up in
Blender. Output: `public/packs/harbor/models/*.glb` and `index.json`. Pipeline:
`scripts/assets/packs/harbor/props.mjs` (the list), then `scripts/assets/process-props.py`, which
runs `scripts/assets/packs/harbor/finish-props.py` after it.

(Later: the four recoloured drum copies were dropped for one drum whose paint is tinted per copy
(`paint` in props.mjs, `addProp({ tint })`); the drum and the reel collide as 16-sided prisms that
roll, the vehicles as two parts each. The notes below on copies and hexagons are as first made.)

## What was made, and how good it is

| Model | Size w x h x l (m) | Triangles | GLB | Mass | Verdict |
|---|---|---|---|---|---|
| forklift | 1.39 x 2.10 x 3.80 | 19,799 | 1.7 MB | 4.5 | Very good |
| yard_tractor | 2.56 x 3.33 x 5.60 | 19,800 | 1.7 MB | 8 | Good |
| drum (blue) | 0.58 x 0.88 x 0.58 | 4,952 | 0.5 MB | 0.12 | Good |
| reel | 1.02 x 1.40 x 1.40 | 5,900 | 0.5 MB | 0.5 | Acceptable, after fixes |

- **forklift**: Clean geometry from every side: overhead guard bars, mast channels and chain, seat,
  steering wheel, tyres with tread, and forks down. Faded red-orange paint with scuffs, no lettering
  anywhere. Tripo invented a plausible counterweight back with a dark grille panel. It's scaled by
  height (2.10 m at the guard), which makes it 3.80 m long with its forks rather than the design's
  3.6.
- **yard_tractor**: It reads well as a terminal tractor: an offset cab with dark glass and a simple
  interior, an amber beacon, an exhaust stack, the fifth wheel on its frame, and a tank box. The
  concept came out with a tandem rear axle (6x4) rather than the two axles asked for. Small parts
  (mirrors, wiper, steps) are a bit soft. The cab's back is a plain black panel.
- **drum**: Good shape (rolling hoops, chimes, two bungs) and texture (chalky paint, rust at rims
  and hoops, streaks, shallow dents). Two small round rust pits on one side read a little like
  holes. One missing wall triangle was filled. The copies keep the rust and the bare steel. Only
  the paint's hue moves, matched to the blue's fade, so they sit together.
- **reel**: Tripo got the shape right but changed the look. The black cable came out metallic grey
  and the weathered plywood near white. It also turned one flange's bolts into needles about 4 cm
  long along the axle. I cut the needles off and recoloured the texture by where each texel lies:
  cable between the flanges (dark rubber, non-metal), wood elsewhere (grey-beige, stains
  strengthened), and the steel hub left alone. It now matches the concept at play distance. Up
  close, the cable's shading is flatter than a real wound cable, one flange has a crack-like seam,
  one batten has a sliver beside it, and the other flange keeps a few short bolt stubs.

No real brands, logos or readable text appear on any of them. All four concepts were clean of text,
and the six-side renders of every model show none.

## Colliders (important for the builder)

Destruction collides a prop as at most **12** of its collider points (`maxHullVertices`, default
12). Given the 24 that process-props.py writes, it picks 12 itself, by farthest-point sampling. In
the simulation I ran of that sampler (the base pack's props are affected the same way):

- The reel would have collided as a body 1.27 m tall instead of 1.40, standing on one point.
- The forklift would have stood on three points spanning 0.93 m².

finish-props.py therefore writes exactly 12 points, which the library uses as they are:

- **drum, reel**: a hexagonal prism drawn round the circle, each face touching it. Either prop
  rests on a face exactly at the model's surface, standing or on its side (checked in the engine:
  a drum knocked over comes to rest with its axle 0.287 m above the road, for a 0.291 m radius).
  The corners stick out 4.5 cm on the drum and 11 cm on the reel.
- **forklift, yard_tractor**: four ground points at the wheel and fork-tip corners (so each stands
  level: footprints 3.2 m² and 9.5 m²), the top point, then points grown and swapped to keep the
  rest closest. They cover 83% and 85% of the model's hull volume. Some parts stay outside: up to
  25 cm (the forklift's counterweight top corners, the tractor's cab roof corners).
- One hull can't follow the forklift's open sides or the tractor's open deck: a slanted face runs
  from the cab roof to the rear corners, so debris landing on the deck rests on it in the air.

## Notes for the builder

- `props: ['/packs/harbor/models/']`. Models are in metres: +Y up, origin at the bottom centre,
  front to **-Z**. To face yaw θ (about +Y, counter-clockwise seen from above), use
  `rotation: [0, Math.sin(θ / 2), 0, Math.cos(θ / 2)]`. Facing +z: `[0, 1, 0, 0]`. Facing -x:
  `[0, Math.SQRT1_2, 0, Math.SQRT1_2]`.
- Materials, as the design says: forklift and yard_tractor `steel`, drums `drum`, reel `wood`.
- Props rest where placed until something wakes them, so place them exactly on the deck (y 0).
- **Drums**: `drum` is blue. For variety use `drum_red`, `drum_yellow`, `drum_green` and
  `drum_black`. The library has no per-copy tint for props, and a tint would darken the rust too.
  Each copy is its own instanced mesh. Keep upright drums' centres at least 0.68 m apart (0.59 m
  is enough along x if they aren't rotated), so the hexagons don't overlap.
- **A drum lying on its side**: `rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2]` (90° about z puts a
  hexagon face down) and `position: [x, 0.291, z]`. Its axle then runs along x, from x - 0.88 to x.
- **Reel**: it stands on its flanges with the axle along x; rotate about y to turn it.
- Tested in the engine: Brick Street, with the pack loaded at runtime and placed with
  `d.addProp`. All eight load and render through PropMesh with their normal maps. The props stood
  still until woken. A 2.6 m blast tipped the forklift onto its side, where it rests on its guard
  and wheels; the tractor didn't move. 60 fps with all of them in view.

## Paid calls (ledger: `assets-src/packs/harbor/ledger.jsonl`, by "props")

| What | Endpoint | Calls | Each | Total |
|---|---|---|---|---|
| Concept images (one take per prop) | openai/gpt-image-2.5/flare/text-to-image | 4 | ~$0.06 | ~$0.24 |
| Image to 3D (detailed PBR texture) | tripo3d/p2/image-to-3d | 4 | $1.20 | $4.80 |

That is about **$5.04**, using 4 of 4 concepts and 4 of 4 image-to-3D generations, with no redos.

## What I'd redo

- **Reel**: a second take, with the concept asking for matte black cable and darker wood. Tripo
  lightened both, though it kept the forklift's black parts black, so the cause isn't clear.
  Meshy's symmetry mode might also have suited this symmetric object. The texture fix works, but a
  clean take would look better up close.
- **Tractor**: re-prompt for a two-axle (4x2) tractor, the common terminal tractor.
- **Colliders**: with a compound collider (several hulls per prop), the vehicles could be
  wheels + body + cab, and the drums and reels proper cylinders.

## Library and pipeline changes I'd want (not made)

1. **Several convex hulls per prop**, or a per-prop `maxHullVertices`, so a forklift or a tractor
   with an open deck can collide close to its shape.
2. **Cylinder colliders** for props (or a per-prop allowance of more hull points), so drums and
   reels roll instead of tipping from face to face.
3. **Per-copy tint** for props (also in the design): one drum model in several colours, instead
   of baked copies (4 extra GLBs, about 2 MB, 4 extra instanced meshes).
4. **process-props.py**:
   - Write colliders of the size the library uses (12 points, chosen so the prop still stands on
     its base). Today the library resamples the 24 it writes, and the base pack is affected too:
     the hydrant keeps 78% of its volume and stands on 3 points.
   - Let a pack add a post-step without loading the script minus its last line, which is how
     finish-props.py reuses its functions now.
