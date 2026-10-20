# Solver, impacts, materials and prop colliders: what changed

The solver team's changes in this phase: the vendored solver's broadphase and a speed limit
(`vendor/three-avbd/src`, noted for upstream in `vendor/three-avbd/VENDORED_COMMIT`), convex hulls
(`src/lib/convex.ts`), fracture (`src/lib/fracture.ts`), bonds (`src/lib/contact.ts`), the blast's
GPU push (`src/lib/blast.ts`), and in `src/lib/destruction.ts`: impacts and landings, the `landed`
event, loose pieces cut by blasts, bond tolerance, hinges and props of several hulls. New material
fields in `src/lib/materials.ts`; `src/lib/prop-pack.ts` reads the new collider fields.

Tests (no GPU, no browser): `tests/hull.test.ts`, `tests/impacts.test.ts`, `tests/bonds.test.ts`,
`tests/prop-parts.test.ts`, the grain test in `tests/geometry.test.ts`, and the vendored
`vendor/three-avbd/tests/radii.test.ts` (grid levels). The broadphase was checked pair for pair
against brute force in Chrome (Dawn in Node can't load on this machine: its libstdc++ is too old),
on scenes of 5 cm to 40 m bodies, fixed and moving, sleeping, waking and resizing.

**Changed since this note was first written** (after a review; tests for each in the files above):
`explode()` no longer cuts loose pieces unless asked (`loose: true`); `landed` comes when a section
strikes, not as it's let go; a prop's parts stay welded when it comes to rest or is let go by one
part; a hinged piece no longer freezes while it hangs; bond tolerance no longer depends on which
piece is built first; and the advice on Sun Temple's finial and on passing options is corrected.

## What every world sees (defaults)

- **The broadphase grid is in levels** (faster; the same pairs). One grid's cells were twice the
  largest small body, and past 64 big bodies the 65th sized them: Sun Temple's ~1,100 fixed cliff
  hulls made 32 m cells, and every moving piece walked hundreds of bodies a step. Now bodies go in
  up to 8 levels of cells, each twice the one below, from a typical piece's size up; a moving piece
  looks only where something its size or bigger could touch it. Measured on the GPU (timestamp
  queries, same session, the GPU shared with other agents' Chromes):

  | | before | after |
  | --- | --- | --- |
  | Sun Temple, 4 loose pieces (one 1.5 m) | collision 1.84 ms a step (step 2.07) | 0.26-0.38 ms (step 0.47-0.56) |
  | Sun Temple, a blast's 70-180 loose pieces | collision 2-3 ms, 3.6-4.6 ms as they settle | ~1.0-1.3 ms (two samples of 2.5 and 3.7), 0.6-0.9 ms as they settle |
  | Brick Street, a blast's 22-150 loose pieces | collision ~2 ms (2-5 ms at the peak) | 0.6-1 ms (1.4-3.9 ms at the peak) |

  Frame times on this machine stay at the display's 16.7 ms median in both worlds, standing and
  with a few loose pieces, before and after; the 90th percentile (20-30 ms) moves with the other
  agents' load, not with the solver. A world of one size of body (voxels) still makes one level.
- **Nothing loose goes faster than 40 m/s** (`DestructionOptions.maxSpeed`, below): blasts and
  breaks throw nothing faster, and the solver slows anything faster at the end of each step (the
  Destruction sets `World.maxSpeed`). A piece falling 80 m reaches it.
- **A blast still only throws the loose pieces it reaches**, as before: cutting them is asked for
  (`explode({ ..., loose: true })`, below). An earlier version of this note made it the default;
  it isn't, so the worlds' own `explode` calls (Market Town's `falls.ts` crumbling a stump under
  its falling tower, Harbor Yard's `containers.ts` buckling, Neon Alley's and Dust Town's `life.ts`
  hits) behave as they did.
- **Landings broken per readback take turns by material**: `maxImpacts` (6) is shared round the
  materials landing hard, each's hardest first, so stone falling with the tiles no longer takes
  every turn. With one material landing, nothing changes.
- **`hullConvex` is the same hull, about 30 times faster**, and repeated points cost nothing (it
  welds points within 1 µm first). Its faces' corners are the points themselves (they were
  intersections of clipped planes, equal to round-off); faces within 1 µm of one plane are one face.
- **Bonds between faces turned a little from facing each other** (up to 2.6°, as before) are judged
  by the gap all over the faces' overlap: it was the planes' offsets from the world's origin, which
  means nothing for turned faces (two turned faces 1 mm apart near the origin bonded; the same 300 m
  away didn't). Faces exactly facing each other bond exactly as before. Checked over every pair of
  touching standing pieces in all six worlds as built (~134,000 pairs): the same bonds and areas,
  but one pair of staves in Dust Town's water tower (their faces open 2+ mm apart), which still
  stands on its other bonds.

## New, and what it replaces

### `DestructionOptions.maxSpeed` and `World.maxSpeed`: no more runaways

```ts
new Destruction({ world, materials, maxSpeed: 40 }); // the default
d.world.maxSpeed = 30; // the solver's limit, from a world's build()
```

The fastest a loose piece goes (m/s; default 40; Infinity: none). Throws (`kick`, the GPU's push on
loose pieces, cells of a piece breaking in flight) are capped at it, and the solver slows any
moving body faster than `World.maxSpeed` at the end of each step (a hard contact can fling a small
piece at hundreds of m/s). `World.maxSpeed` is new in the vendored three-avbd (default Infinity,
as upstream); the Destruction sets it to its `maxSpeed`.

Replaces: Dust Town's runaway clearing (`western/life.ts`, `clearRunaways`: removes loose pieces
over 35 m/s). It can keep the "far away" test and drop the speed one.

### `hullConvex`: weld, then hull

Points within 1 µm are one before hulling (a Voronoi cell's faces list each corner three or four
times), then an incremental hull, its triangles merged into faces. Benchmarks (`tests/hull.test.ts`):
a Voronoi cell's listed corners, under 10 ms (Sun Temple saw 0.6-1 s); 60 points on a sphere ~1 ms
(was ~30 ms), 200 points ~4 ms, 1,000 points ~20 ms (the old one grew as the fourth power).

Replaces: Sun Temple's `corners()` before `addConvex` (`temple/kit.ts`, used in `levers.ts`
`remake` and `index.ts` `shatterTile`): harmless to keep, no longer needed.

### `BreakableMaterial.landing`: light pieces that break where they land

```ts
tile: presets.brick({ landing: 3, ... }),   // roof tiles: shatter landing at 3 m/s or more
pot: material({ landing: 2.5, ... }),
```

The change of speed (m/s) past which a loose piece of the material breaks where it lands, however
light (default: none, and only pieces heavier than `heavy` (0.6), more than 2.5 × `minSize`, break,
past `shatterSpeed` (3)). Pieces bigger than 1.5 × `minSize` can break; they report their contacts
(a little cost per piece). The breaks per readback are `maxImpacts`, shared by material (above).

Replaces: Market Town's tile shattering (`medieval/shards.ts`, `struck` and `shatter`, called from
`index.ts` `onImpact` and `update`), and Sun Temple's (`temple/index.ts`, `shatterTile` and the
`state.landed` bookkeeping in `onImpact`). Checked in Sun Temple with `terracotta.landing = 4`: two
blasts under the roof broke 281 tiles where they landed, against 16 without. Their own budget logic
(Market Town's `BUSY`, Sun Temple's `PIECE_BUDGET`) has no counterpart yet: the library's rate is
`maxImpacts` per readback (60 a second).

### `explode({ loose: true })`: blasts cut what's flying

```ts
d.explode({ at, radius, speed: 15, spin: 12, loose: true }); // a rocket into a falling section breaks it
```

The loose pieces the blast reaches are cut as standing ones are, their cells going on with the
piece's motion and the blast's throw (pieces too small to cut, and props, are thrown whole). Where:
the piece's pose at its last readback (up to a tenth of a second and a frame or two old) carried on
by its velocity and spin since, so debris is cut where it is, not metres back along its path.
Measured in Brick Street after a blast (loose pieces within 4 m, against a fresh read of where they
were; two runs): 130 ms after it, the last readback's poses were 0.7-0.9 m off (median; 90th
percentile 2.4-2.8 m), the carried-on ones 0.3-0.6 m (1.7-2.1 m); from 170 ms to 0.6 s, 0.0-0.4 m
(90th percentile 0.06-1.0 m) against 0.0-0.14 m (0.01-0.37 m). A piece that struck something since
its readback is carried on through it, so a few are further off than before (at most 2.4 m seen).
Default `false` (old behaviour).

Replaces: the gap noted in Sun Temple (`temple/index.ts`, "a blast doesn't cut what's already
moving"). **For the runtime team (`main.ts`):** the player's rocket (`blast()`, its
`destruction.explode`) should pass `loose: true`; until it does, rockets throw loose pieces whole.

### `BreakableMaterial.audible`: heard by material

```ts
tin: presets.metal({ density: 1, audible: 0.001 }), // light sheets still report what they strike
```

Loose pieces of the material heavier than this report what they strike as `impact` events while
something listens (default: `DestructionOptions.audible`, 0.02). Replaces: Dust Town's tin
watching (`western/life.ts`, the `tin` map filled in `track` and read in `updateTin`: a sheet's
vertical speed stopping short as a landing, since light tin reported nothing).

### The `landed` event: a section or a heavy piece touching down, once

```ts
d.on('landed', (e) => {
  // e: { at, pieces, mass, speed, material }
  if (e.material === 'container' && e.speed > 3) sound.play('container.boom', { at: e.at, volume: Math.min(1.2, e.speed / 8) });
});
```

Emitted once when a falling section (two or more pieces still bonded) or a heavy piece (mass over
`heavy`, 0.6) first strikes the ground or the structure (a fixed piece, rubble, or any body that
isn't a piece) since it came loose: not when it strikes other loose pieces, and not again when it
bounces. Striking means the whole of it was moving into what it touched at 2 m/s or more at the
readback before (its centre of mass's velocity along the touch's normal). So nothing comes of what
it rested on or was bonded to as it was let go (the solver's first steps push hard there, to part
what overlaps), of settling, sliding along something, or one piece of it clipping an edge as it
turns over. Before a readback since it was let go (a tenth of a second), a touch counts only away
from where it was let go, and only if it stopped the whole of it at 2 m/s or more. `at`: its
touches' centre (weighted by how hard each struck); `pieces`: the section (its pieces at that
moment); `mass`: theirs together; `speed`: how fast it struck (m/s: its pieces' speed at the
readback before, weighted by mass, a little short of it; one that struck before any readback: the
change of speed its touches gave it, if more); `material`: the material of most of its mass. A
piece let go again (thrown, woken) can land again. Subscribe in `build()`: pieces of a section
report their contacts only while something listens. Exported type `LandedEvent`. The sound team's
`MaterialSounds.land` plays it.

Replaces: Harbor Yard's section tracking (`harbor/index.ts`: the `sections` map, `boxOf`, and
`box.boomed` in `onImpact`). Checked (each its centre of mass followed every 60-80 ms):

- Harbor Yard, the top container (43 pieces) let go where it stands: nothing (it stays on its
  stack). Thrown straight up at 4 or 5 m/s: one `landed` as it comes back down onto its stack
  (t ≈ 1.05 s, its centre falling at 2.9-4.1 m/s just before; speed 3.1-4.1). Shoved sideways
  (2.5-3 m/s, the check an earlier version of this note quoted): one at once (0.15 s), at its floor,
  speed 2.7-4.9: the shove drives it into the top rails of the box under it, which stand inside its
  bounds, so that one is a strike, not its release. A blast at a stack's foot: its 168-piece upper
  section's `landed` came at 0.41 s, its centre falling at 3.4 m/s, 30 ms before it stopped.
- Brick Street, a blast bringing down 45 sections: the 16 that came loose but never fell gave
  nothing; those that fell gave theirs 15-60 ms before their centre stopped falling, at 4-16 m/s.

(An earlier version counted the first touch of anything: a section let go fired at once, against
what it rested on, and then never for its real landing.)

### `BreakableMaterial.grain`: splinters

```ts
planks: presets.wood({ grain: { axis: 'u', stretch: 4 } }),
```

Wood's grain: `axis` is an axis of each piece's texture frame ('u', 'v', 'w': its x, y, z; the frame
its map is projected in, so boards laid with `textureFrame` along their length split along it), and
its fracture cells come out `stretch` times as long that way as across (the Voronoi cells of a space
squashed along the grain, stretched back). Blasts, landings and cuts in flight all use it.
`voronoi(piece, seeds, minVolume, { axis, stretch })` does the same for a world's own cutting.
Worlds to use it: Dust Town's boards, Market Town's timber, Harbor Yard's crates.

### Bond tolerance: `PieceOptions.bond: { gap, angle }`, `DestructionOptions.bondTolerance`

```ts
d.addConvex({ material: 'marble', points, bond: { gap: 0.01, angle: 0.05 } });
```

A piece bonds to the pieces it touches when their faces are within `angle` (rad, default 0.045:
2.6°) of facing each other and within `gap` (m, default 0.002) of each other all over where they
overlap; each piece may say how loosely (its cells keep it: a cut dome piece's cells still bond to
the ring under it). Faces that meet only at an edge, or open up from it past the gap, never bond.
Default unchanged: a gap left on purpose (Brick Street's slabs 2 cm short of the facades) stays one.
Two pieces bond within the looser of their tolerances whichever is built first (an earlier version
looked for neighbours only as far as the new piece's own gap).

Replaces most of Sun Temple's hand bonds of the tholos dome (`temple/tholos.ts`): the dome as it's
built now (rings of 16, 16 and 8 with `halves`, the cap) bonds by itself with the default tolerance,
every piece to its neighbours round the ring and to the ring under it (checked: 16 + 16 + 8 round,
16 and 16 between rings, 8 under the cap), so `bond: false` on the rings and the cap, and the ring
and cap bonds of the `k.d.bond` loop, can go. **Keep `k.d.bond(finial, cap, 0.05)`**: the finial
stands on the cap's apex, a point, so it gets no bond by itself and would fall at load without it.
Pieces that truly meet only at an edge or a point (the finial, tilted voussoirs under a level
course, Market Town's wedges and finials) need `d.bond(a, b, area)`: that is the rule, not a gap
in it.

### `d.hinge(piece, anchor, axis, { to?, breakForce? })`: signs, doors, bells

```ts
const sign = d.addBox({ material: 'wood', size: [1, 0.5, 0.04], position: [x, y - 0.3, z] });
const h = d.hinge(sign, [x, y, z], [0, 0, 1], { to: arm });   // h.holding, h.remove()
```

The piece comes loose and swings about `axis` (world) through `anchor` (world): two ball joints on
the axis, as far apart as the piece reaches along it. Held to `to` (a piece: the hinge goes where
it goes, and is gone when it is) or, without, to the world (a hold that collides with nothing,
removed with the piece). `breakForce` (N): a pull that tears it (default never). Returns a `Hinge`
(`piece`, `holding`, `remove()`). While it holds, the piece stays loose however still it hangs (it
never freezes as rubble, so it swings when struck and falls when what it hangs from goes; a hung
piece costs a moving body for good); once removed, torn, or what it hangs from is gone, it comes to
rest like any piece. Checked in Brick Street: a board hung on it and pushed swung -106° to 72° and
back, decaying, its hinge line within a millimetre of the anchor; a sign and a door hanging still
for 12 s stayed loose; the sign's arm removed, it fell to the ground; the arm let go instead, the
two fell together. (An earlier version froze a still sign after 2.5 s: it then floated when its arm
went, or held the arm up.)

Replaces: Dust Town's hanging signs (`western/life.ts`, `start` builds them as plain meshes and
`updateSigns` swings them by hand): they can be pieces (breakable, struck by debris) hinged to the
hanger's arm. Batwing doors: hinge each leaf to its post about the vertical. Bells: hinge to the beam.

### Props of several hulls, and round props: `PropModel.colliders`, `PropModel.hullVertices`

```ts
{ ...model, colliders: [bodyPoints, leftForkPoints, rightForkPoints], hullVertices: 24 }
```

`colliders`: the convex parts a prop collides as (points each, its frame), instead of `collider`'s
one hull. The solver has no compound shapes, so each part is a body, the model drawn on the first,
welded to it by joints that never break (bonds of `1e6` m², which the falling-section machinery
already moves, rests and wakes as one). Nothing parts them: not a blast, not coming to rest with
nothing quite under it (it settles or drops clear of what it's jammed against whole), not
`d.loosen` of one part (the prop goes whole). Its mass is shared by the parts' volumes; it lands as
one (`landed`); removing any part removes the prop. Checked in Brick Street: a sedan as two parts,
dropped and blown over on an open street, its parts stayed within 1.4 mm of their spacing; 16
two-part taxis dropped by the facades and blasted (three runs), every weld held, but the solver's
joints are stiff, not rigid: pressed in the rubble, a part sat up to 0.4 m off its spacing (0.39
to 1.21 m against 0.78) and took seconds to pull back. The look is drawn on the first part only, so
this shows as the second part's collision being off, not as the model coming apart.
Each part costs a body and a joint: use a few, for props a single hull fits badly (the forklift's
forks, a tractor, a wagon's bed and wheels, a rocking chair's runners, a pump).

`hullVertices`: the most corners each of its hulls keeps for the solver (default the Destruction's
`maxHullVertices`, 12; up to 32). Twelve make a drum a hexagonal prism that won't roll; 32 make it
a 16-sided one that does. The look keeps every corner either way.

**For the rendering-and-props team (`scripts/assets/process-props.py`, index.json):** two optional
fields per prop, both read by `loadPropPack`:

- `colliders`: `[[x, y, z], ...][]`, each list the points of one convex part, in the GLB's frame
  (three.js: +Y up, metres, as `collider`), rounded as `collider` is. The first part carries the
  model: make it the main body. Keep writing `collider` too (the hull of all the parts, for the
  `_collider` preview and older readers); with `colliders`, the library ignores it. A part needs
  4+ points spanning a volume; 8 (a box) is usually enough, at most 32.
- `hullVertices`: a number up to 32, for round props (`round: 'x' | 'y' | 'z'`): write a 16-sided
  prism (32 points) instead of the hexagonal one, and `hullVertices: 32`.

## Vendored solver patches

See `vendor/three-avbd/VENDORED_COMMIT` (both worth reporting upstream): the broadphase in levels
(`src/avbd3d/gpu/radii.ts`, `solver.ts`, `wgsl-collision.ts`, `layout.ts`; the vendored GPU test
`tests-gpu/grid-levels.gpu.test.ts` follows the new fields) and `GpuParams3D.maxSpeed` /
`World.maxSpeed` (`wgsl-solve.ts` `updateVelocities`).

## Not done

- Compound shapes in the solver itself (several hulls in one body): the GPU narrowphase collides one
  shape per body, and a pair is one thread; parts welded by joints do the job without that.
- Prop welds as rigid as one body: see the props above (a joint gives under a pile's weight).

## Passing the options from a world

`DestructionOptions` come from the world's definition (`WorldDefinition.destruction`,
`src/demo/worlds/types.ts`; `main.ts` spreads it into the Destruction it makes):

```ts
const world: WorldDefinition = {
  ...,
  destruction: { maxSpeed: 35, maxImpacts: 8, bondTolerance: { gap: 0.004 } },
};
```

Per material and per piece: `landing`, `audible`, `grain` (materials) and `bond` (pieces).
`d.world.maxSpeed` can also be set from `build()`.
