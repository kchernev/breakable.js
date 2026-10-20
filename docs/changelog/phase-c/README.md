# Phase C: the changes to the library and the demo

These are the notes of phase C, kept as they were written when it ended (only their links to each
other changed, when they moved here from `docs/changes/`). In that phase six teams changed the
library and the shared demo at once. Their own notes, with the numbers and the reasons, are next to
this file: `stability.md` (structure), `solver.md` (solver, impacts, materials, prop colliders),
`render.md` (how pieces and props are drawn, the prop pipeline), `sound.md`, `runtime.md` (the
demo, the world contract, sky, effects, player) and `launcher.md`. This page is the short account:
what was new, what every world got without asking, and what in each world could then go.

Since then the worlds have taken up most of it (each world's README says what it uses), and
`docs/making-a-world.md` describes what a world author needs of it: read that first. Read these
for why something is the way it is, and what it was measured at. "Per world" and "Still open"
below are as they stood then.

**No world has to change anything.** All six load, stand (0 loose pieces for 10 s after load),
take rockets and show the new launcher with no console errors; the typecheck, the tests and the
build pass. The workarounds below still work: they can go when a world is next worked on.

## New

### Structure (`stability.md`)

- `d.loosen(piece, velocity?, spin?)`: let one standing piece (or rubble) go whole, cut from its bonds.
- `d.release(pieces, velocity?, spin?)`: let standing pieces go together as one section (a `collapse` event).
- `d.push(piece, velocity)`: push a loose piece, rubble or a prop at rest (wakes it, shared with what it's joined to).
- `d.unbond(bond)` is public, and weighs again; `d.reweigh()` weighs at the next update (instead of a zero-radius blast).
- `d.loosePieces` (read only) and the `'state'` event (`StateEvent`: `{ piece, from, to }`), e.g. pieces thrown whole.
- `d.killBelow` / `DestructionOptions.killBelow` (default 50 m under the ground): where loose pieces are taken out.
- `Bond.builtLoad`, `Piece.corners`, `Piece.radius`.
- Collision group bit 30 (`1 << 30`) is the library's now (jammed pieces): don't use it in a world.

### Solver and impacts (`solver.md`)

- `d.on('landed', e)`: a falling section (2+ bonded pieces) or a heavy piece striking the ground, scenery, rubble or what stands, once: `{ at, pieces, mass, speed, material }`.
- `BreakableMaterial.landing` (m/s): its loose pieces break where they land, however light (tiles, pots).
- `BreakableMaterial.audible`: its loose pieces heavier than this report `impact` events (light tin).
- `BreakableMaterial.grain: { axis: 'u' | 'v' | 'w', stretch }`: wood splits into splinters along its texture frame's axis (`voronoi(..., grain)` for a world's own cuts).
- `explode({ ..., loose: true })`: a blast cuts the loose pieces it reaches, where they are now. The demo's rockets pass it (below).
- `d.hinge(piece, anchor, axis, { to?, breakForce? })`: a sign, a door leaf or a bell swinging from a piece or the world (`Hinge`: `holding`, `remove()`).
- `PieceOptions.bond: { gap, angle }` and `DestructionOptions.bondTolerance`: bond faces a little apart or turned (dome rings).
- `DestructionOptions.maxSpeed` (default 40 m/s) and `d.world.maxSpeed`: nothing loose goes faster.
- `PropModel.colliders` (convex parts welded into one prop) and `PropModel.hullVertices` (up to 32: round props that roll).
- `hullConvex` welds repeated points and is ~30× faster: no need to dedupe a Voronoi cell's corners first.

### Look (`render.md`, `runtime.md`)

Pieces' surfaces (node accessors, in a breakable material's nodes):

- `pieceState()`: `{ standing, loose, rubble, broken }` floats for the piece drawn.
- `BreakableMaterial.glow: 'standing'`: emission only while the piece stands, never on broken faces.
- `pieceTint()`: the piece's tint as a node (instead of `attribute('tint')`).
- `BreakableMaterial.tintMask`: a float node or a texture (red) saying where the tint goes (paint, not rust).
- `pieceFrame()`: `{ position, normal, halfExtents }` in the piece's texture frame, kept by its cells (drafted margins, grooves, flutes, undersides).
- `PieceOptions.smooth` (radians): curved pieces shade round (drums, tank shells).
- `uvScale: [u, v]` for maps whose tile isn't square; `BreakableMaterial.uvJitter` (0–1) gives same-sized blocks their own patch.
- `Piece.textureFrame`: pass it as `textureFrame` when making a piece again, so it keeps its look (needed before `uvJitter`, `pieceFrame()` or `smooth`).
- `textured(set, { ao })`: the set's packed occlusion as the surface's `aoMap` (pieces' own faces only).
- Glass: leave `depthWrite` at three's default (true) and dust no longer cuts window shapes; `presets.glass()` does.
- `pointedArch(span, thickness, depth, count?, radius?)`: Gothic arches' voussoirs (shapes).

Sky, light and screen:

- `sky.elevation` (radians): the sun light's height, whatever the HDRI's. `sky.backgroundHdri`: show one sky, light with another (its sun turned onto the light).
- `look.fill: { intensity, color?, azimuth?, elevation? }`: a shadowless light from the shaded side.
- `look.haze: { strength, from, height }`: heat shimmer far off and low.
- `look.reflections` takes `thickness`, `quality` and `resolution` too.
- `?sky={...}` tries skies as `?look=` tries looks.

Dust and smoke:

- `look.smoke: { color, opacity, life, scale }`: the blast's cloud (also `rt.effects.smoke = …` at run time).
- `look.dustPalette: { colors, blend }`: what all dust is mixed from, and how much a material's own colour counts.
- `WorldDefinition.dustAmount: { material: factor }`: how much dust a material raises (its bits and its collapse cloud).
- `rt.effects.puff(at, { color, rise, size, life, opacity, velocity })`: steam or smoke in its own colour.

### Props (`render.md`, `solver.md`)

- `d.addProp({ ..., tint })`: a colour per copy, only on the paint when the model has a mask; `PropModel.tint` and `tintMask` come from `index.json`.
- `process-props.py` fields in a pack's `props.mjs`: `scale: [x, y, z]`, `roughness`/`metalness: [min, max]`, `paint: { hue, minSat }` (tintable paint), `glow: [{ box, minLuma, color, strength }]` (an emissive map: a vending machine can be a prop).
- `round: 'x' | 'y' | 'z'`: collides as a 16-sided prism round that axis, which rolls (`index.json` gets `hullVertices: 32`); `sides: 6` gives the old hexagon, which doesn't.
- `parts: [{ box, round?, sides? }]`: a hull for each box's vertices (the first the main body), written as `index.json`'s `colliders` (the solver's welded parts), with `collider` their hull together (a forklift's body and forks).
- `process-props.py --colliders` fits the colliders again to the GLBs as they are; a pack's `finish-props.py` runs after `process-props.py` (`--no-finish` skips it).

### Sound (`sound.md`)

- `MaterialSounds.pitch` (a number, or by kind): share another material's sounds at its own pitch.
- `MaterialSounds.heavy`: the material's own threshold for `heavyImpact`.
- `MaterialSounds.land`: played once when a section (or heavy piece) of it lands (`'landed'`), instead of its pieces' strikes then.
- `play(name, { delay })` just works: a delayed sound is weighed when it reaches the ears.
- `Voice.setRate(rate, time)` (pitch and speed) and `Voice.setMix(mix, time)` (a second volume, apart from `setVolume`).
- `rt.ambience`: the world's `audio.ambience` loops by sound name (`setVolume(0, 0.5)` to duck, `setVolume(1, 10)` back; don't `stop()` them).
- `audio.footsteps.surface(at, material, rubble)`: a step sound by what's underfoot.
- `process-sounds.mjs`: `onset` (cut to the rise into the loudest part) and `--skip name:i:j` (leave out a slice).
- `sounds.html?pack=<world>` plays a world's pack at that world's levels.

### Runtime (`runtime.md`)

- `onStart(rt)`: once, when built and the sounds have loaded (subscribe, start loops); `update()` still runs from the first frame.
- `walkable(x, z)`: where the player may walk (a step off stops at the edge).
- `far`: the camera's far plane (default 600 m).
- `destruction: { ... }`: any `DestructionOptions` (`shatterSpeed`, `heavy`, `maxLoose`, `maxSpeed`, `killBelow`, ...).
- Lights: make every light the world will use in `scenery()` or `build()`, at intensity 0 until wanted (a light added later recompiles every lit material: over half a second).
- `demo.rt` and `demo.pipeline` for scripted checks.

### Launcher (`launcher.md`)

- A real launcher model (the kit pack, `loadKit()`), lit by the world, never through a wall, swaying and dipping with footfalls; rockets come down where the crosshair is and go off on the scenery. Nothing for a world to do. It lives on layer 2 (`VIEW_LAYER`), which passes that must leave it out (the AO pre-pass) don't see.

## Changed defaults (every world gets these)

Structure:

- Rubble freezes only over what holds it up (ground, scenery, standing pieces, rubble); a piece creeping on doesn't freeze.
- A section at rest that nothing holds up comes apart at its joints; a jammed piece drops clear (passes through what it's jammed against for up to 2 s); one wedged among rubble settles after 2.5 s.
- Rubble and props wake when what they rest on goes (removed, broken, loose, woken, moved on); rubble that came to rest joined stays joined and wakes as one.
- Small rubble that something rests on, or that came to rest joined, isn't cleared.
- A blast throws rubble that came to rest joined as one body (its heart torn off alone); the GPU push carries a whole loose section.
- One breaking budget a frame (`frameBudget`, 4 ms) for every `explode()` and `hit()`: what's over waits for the next frames, so `explode()` may return `done: false` and fill in later.
- A strengthened bond's extra strength fades past its as-built load: one strengthened many times gives way at about 1.125 × that load.
- The weighing knows moments: a piece whose weight has moved off what it stands on (0.12 m or 18 % of its width) tips; a span that lost a column comes down instead of standing as a shelf.
- A section let go turns over the edge it's out past; a slender one off its middle third goes over.

Solver and impacts:

- The broadphase is in levels: the same pairs, much cheaper with a few big bodies (Sun Temple's collision 1.8 ms → 0.3 ms a step).
- Nothing loose goes faster than 40 m/s.
- Landings broken per readback (`maxImpacts`, 6) take turns by material, each's hardest first.
- Turned faces (up to 2.6°) bond by the gap all over where they overlap (one pair of staves in Dust Town's water tower no longer bonds; it still stands).

Look and props:

- The base pack's colliders are 12 points standing on four (the sedan, van and hydrant stood on one).
- Glass is drawn as the surface says (writing depth is the world's choice).
- `Piece.state` is a getter and setter; `Piece.texture` is a `TextureFrame` (a pose with its box and smoothing).
- The sky is turned the right way: its glow and the environment's sun are where the light comes from. Brick Street and Dust Town were retuned to keep their look (`sky.environment`, `look.fill`, and Brick Street's `look.hemisphere`: keep them when editing those blocks).
- Screen-space reflections: `distance` 100 (was 25), `quality` 1 (0.75), `resolution` 0.5 (1).
- The collapse cloud takes the colour of the material with the most volume (it took the first piece's).
- `textured(set, { metalMap: true })` defaults `metalness` to 1.

Sound:

- A world pack's own play settings win over the library's `packSettings` (only Neon Alley's `ambience.city` changes: 0.35 → 0.3).
- A sound starting later (a delay, far off, debris landing) is weighed when it starts, not when asked for.
- Loops keep their voices through any blast (a loop gives way only to its own sound).
- A soft ceiling at -1.4 dBFS on the output; Doppler on `detune`.
- Every world's bed is about -33 LUFS standing at its start, its steps as loud as Brick Street's: the levels are in each world's `audio` block (`sound.md` has the table). A new bed loop or footstep set should keep to that.

Runtime and launcher:

- The scenery's fixed bodies that rise above `groundAt` are walls and floors to the player (Market Town's town walls and towers, Dust Town's corral, Sun Temple's shore hulls); every fixed body stops rockets.
- `effects.warm()` runs once after `build()` (seven particles and a flash, out of sight, for 0.3 s).
- Rockets leave at 20 m/s and speed up to 48 (about 0.1 s later over any distance past ~8 m), are aimed to land on the crosshair, and `onTrail` gets the nozzle.
- **Rockets cut what's already falling** (`main.ts` passes `explode({ loose: true })`, as the solver team asked; wired in at integration). Cost, five rockets into Brick Street's falling facade, three runs each way: worst frame 39–44 ms against 35–38 ms without, about 100 more pieces cut.

## Checked between the teams

- **`'landed'` → `MaterialSounds.land`.** The sound team's `DestructionSounds` reads exactly the solver team's `LandedEvent` (`at`, `pieces`, `mass` in density × volume like its `heavy`, `speed` in m/s like an impact's, `material`), listens only when a material has a `land` sound, and mutes those pieces' own strikes for 0.3 s: the readback delivers contacts (and so `landed`) before `DestructionSounds.update()` plays the strikes. Checked in Brick Street (three blasts at a ground-floor front, two runs): 17 of 26 and 17 of 23 sections that fell more than 1.5 m gave a `landed`. The others most likely came down on loose debris (by design not a landing) or broke up before they struck: holding the joint breaks back until a readback's contacts were in didn't change the count. Their pieces are heard striking, as before.
- **`rt.ambience` is `DemoAudio.ambience`**: the same `Map`, filled once the packs load, before `onStart`. Checked in Sun Temple: `ambience.coast` and `ambience.wind`, ducked with `setVolume`.
- **Prop colliders**: `process-props.py` didn't write the solver team's fields; it does now (`round` → 32 points and `hullVertices`, `parts` → `colliders`), and `--colliders`, the previews and `index.json` handle them. Tested (`tests/process-props.test.ts`, in Blender; a refit and a preview on copies of the sedan and the hydrant) and checked in the browser: 32-corner hulls dropped on their side roll and come to rest, and a two-part sedan dropped comes to rest.
- **`materials.ts`**: the solver team's `landing`, `audible`, `grain` and the render team's `uvScale` pair, `uvJitter`, `tintMask`, `glow` are separate fields; no duplicates or clashes. `grain` follows the texture frame's turn, which `uvJitter` doesn't change.
- `textured()`'s `ao` is the render team's `aoMap` request, off by default (it changes every textured world).

## Per world: what can now go

### `nyc` (Brick Street)

- Keep the runtime team's `sky.environment`, `look.hemisphere` and `look.fill`.
- `glass`: drop `depthWrite: false`. `lamp`: `glow: 'standing'` (lit windows go dark when knocked loose).

### `medieval` (Market Town)

- `alignSky`: gone already (the sky turns right by itself).
- The effects wrapper in `update()` (`thinned`): `look.smoke: { scale: 0.55 }` (or `{ opacity: 0.6, life: 0.6 }`) and `dustAmount` per material (one factor covers both a material's bits and its collapse cloud: the wrapper's 0.4 and 0.2 become one number).
- Dust colours made cool to beat the warm palette: their real colours with a cooler `look.dustPalette`.
- `shards.ts` (`struck`, `shatter`, from `onImpact` and `update`): `tile: { ..., landing: 3 }`. `BUSY` has no counterpart (the library breaks `maxImpacts` a readback); if `shards.ts` stays, it needs `piece.textureFrame`.
- `falls.ts`: `releaseFronts`' 2 cm blasts → `d.release(front)` or `d.loosen(p)`, and a jettied front whose ground floor went now tips off its joists by itself: try without. Keep `leanFalls` for the towers (the library turns an undermined tower only once what's left can't reach across its base).
- The `later` queue (tolls, hens): `play(name, { delay })`; keep it only for `ifHanging` (or `stop()` the delayed voice when the bell falls).
- `birds ??=` / `market ??=` in `update()`: list both in `audio.ambience` (their levels stay in `settings`), duck and restore with `rt.ambience.get(...)?.setVolume(...)` instead of `stop()` and a new `play`, subscribe in `onStart`.
- `Kit.laid()` 'jitter' and `rise()`: `uvJitter`; draw the false bed joint from `pieceFrame().position.y` (no line along a fallen block's top).
- `sky.elevation` for a 9–11° golden hour; `pointedArch` for Gothic openings; `grain` for the timber; glass without `depthWrite: false`.
- The round towers' scenery boxes (7 × 7 m) are walked into 1.35 m out on the diagonals now: a hull of 12–16 points round each (`world.addHull`).

### `western` (Dust Town)

- `clearRunaways`: the speed test (35 m/s) is the library's limit now (40 by default, `destruction: { maxSpeed: 35 }` to keep 35); keep the out-of-town test.
- The tin watch (`tin` map, `track`, `updateTin`): `tin: presets.metal({ audible: 0.001, ... })` with the tin sounds as its `impact` / `heavyImpact` (and `heavy`), or `land`.
- `scans` and `track` (looking over `d.all()` after blasts): `d.loosePieces`, or `'state'` from `fixed` to `loose`.
- The hits queue (three a frame): every hit shares one breaking budget now.
- The let-go: `snapTies`' hits → `d.unbond(b)` (no splinters at the ties); `tip()` → `d.release(members, velocity, spin)`; the 1 cm hits waking frozen boards → not needed (rubble wakes when what it rests on goes). The water tower's leg cuts can be `d.loosen` / `d.release`, and the weighing may now tip it by itself: check before dropping `updateTower`.
- Hanging signs (meshes swung by `updateSigns`): pieces on `d.hinge(sign, anchor, [0, 0, 1], { to: arm })`; batwing doors and the chapel bell likewise.
- Tumbleweeds: props pushed by the wind with `d.push(prop, velocity)`.
- The gust's second wind voice: `rt.ambience.get('ambience.wind')?.setVolume(1.7, 1.4)` and back (then `voices: 2` can go); the windmill clank: `setRate` with the gusts.
- `NOON` in `scenery.ts` → `sky.elevation: (65 * Math.PI) / 180`; `backdrop()` → `sky.backgroundHdri: '/packs/western/hdri/qwantani_noon_puresky_1k.hdr'`. Until then the background's glow stays opposite the light (`backdrop()` turns it the old way; `look.fill` sets its own direction, so it stays).
- `look.haze` for shimmer (keep the haze skirt); glass without `depthWrite: false`, and back to a clearer opacity; `grain` for the boards instead of small `maxPieces`; siding paint wear with a paint mask and `tintMask`; the tin's `metalness: 1` can go; boardwalk steps with `footsteps.surface`.

### `neon` (Neon Alley)

- `glow.ts`: `glow: 'standing'` on `neon`, `lightbox`, `lamp`, `lantern` replaces `outside()` and the darkening in `update()` and `watch()`. Keep multiplying by `v.x` (the curtained windows are unlit `lamp` pieces), the flicker, the atlas offsets and what it tracks for the reactions (a hinged piece is loose: it goes dark too).
- `tint()` (`attribute('tint')`) → `pieceTint()`; the lanterns' centre from their glow values → `pieceFrame().position.xz`; `awningSurface()`'s tint divided out → `tintMask: stripe`.
- Vending machines built from pieces: a prop with `glow` boxes; recoloured scooters, crates and bins (`props-post.py` `variants`) → `paint` and `addProp({ tint })`.
- `s.subscribed` in `update()` → `onStart`; the vents' `dust()` → `rt.effects.puff(...)`; `look.dustPalette` cooler.
- `giveWay`: its cracking blasts share one budget now; it can be `for (const b of p.bonds) b.strength = 1` on the rest of the ground floor, then `d.reweigh()`. A gutted shell still stands without it, so keep the rule.
- `peelFacades`: a section let go now turns over the edge it's out past; check whether the push is still needed.
- `look.reflections: { strength: 1 }` now reaches the tall signs from the street (rays to 100 m); try it against `wet.ts` (which still does streaks and what's off screen).
- Glass without `depthWrite: false`; tile debris as `glass.debris` with `MaterialSounds.pitch`; wet-asphalt steps with `footsteps.surface`.

### `harbor` (Harbor Yard)

- The container boom (`sections`, `boxOf`, `box.boomed`, the play in `onImpact`): `container: { ..., land: 'container.boom' }` in `audio.materials` (keep `heavyImpact: 'container.clang'` for loose panels); a box let go again lands again by itself.
- `index.ts` `update`: the zero-radius `explode` after `tipStacks` and `unstall` → `d.reweigh()`; `unstall()` → not needed (nothing freezes with its middle out past what holds it).
- `containers.ts`: `tipStacks`' `bond.strength = 0` → `d.unbond(b)`; the box let go turns over its edge by itself (`nudge` can stay for the push out); `buckle()`'s tiny blasts → `d.loosen(piece, velocity)`. The weighing doesn't buckle a box under a lost corner: `tipStacks` keeps that. A box shoved off the quay whole: `d.release(box.pieces, velocity)`.
- `state.warm`'s explosion, dust and sparks → gone (`effects.warm()`); keep its fires' puff.
- `fire.ts`'s own smoke → `rt.effects.puff(top, { color: 0x1a1816, ... })` if wanted; the blue dust colours that land on grey → their real greys with `look.dustPalette`, and `dustAmount: { steel: 0.15, container: 0.15, tank: 0.1 }`.
- `groundAt`'s chest-deep water: `walkable: (_x, z) => z > QUAY.edge + 0.3` if the water should be out of bounds.
- `containerSkin()` and `tankPaint()` dividing the tint out → `tintMask`; tank shells `smooth: 0.5`; roof plates' undersides and boxes' insides → `pieceFrame().normal`.
- `finish-props.py`: the drum's four baked colours (`finish_drum`) → `paint: { hue: [180, 240] }` and `addProp({ tint })`; its colliders → `round: 'y'` (drum) and `round: 'x'` (reel) in `props.mjs` (now 16-sided: they roll), and `parts` for the forklift's forks.
- `steps.metal`'s crunches → `process-sounds.mjs --skip`; `sheet.tear` → `onset`; `grain` for the crates; steps on steel with `footsteps.surface`.

### `temple` (Sun Temple)

- `levers.ts`: the zero-radius `explode` at (0, -500, 0) → `d.reweigh()`; deleting from `Piece.bonds` → `d.unbond(b)`; `release()`'s remaking a piece loose → `d.loosen(p)`; `remake()` should pass `p.textureFrame`. Keep `shear` (the library tips a span whole, it doesn't cut it at the edge).
- `kit.ts` `corners()` before `addConvex`: no longer needed (harmless).
- The perched props' nudges in `update()`: not needed (a prop wakes when its stand goes).
- `shatterTile` and the terracotta part of `state.landed`: `terracotta: { ..., landing: 4 }` (the foliage bursts stay the world's; `PIECE_BUDGET` has no counterpart).
- `state.warm` in `update()`: remove (`effects.warm()`; at a `far` over 3 km it would show).
- `layout.ts` `SEA` at -44: back down, with `d.killBelow = SEA - 10` in `build()` (or `destruction: { killBelow }`); `far: 2000` for the hills.
- `look.smoke: { color: 0xf0ece4, life: 0.55, opacity: 0.8 }` (marble dust, cleared in ~6 s).
- The cicadas played in `update()`: list them in `audio.ambience` (their 0.2 stays in `settings`) and duck them with `rt.ambience.get('ambience.cicadas')?.setVolume(0, 0.25)` / `(1, 10)`; the bay echo (`echoDue`) → `play('explosion.far', { delay })`; `'brick.impact.small': { pitch: [1.0, 1.3] }` for every material → `MaterialSounds.pitch` on marble's.
- `materials.ts` `boxFace()`, `edgeDistance()`, `drafted()`, `triglyph()` → `pieceFrame()` (on cells too); the drums: flutes from `pieceFrame().position` and `smooth: 0.5`.
- `Kit.frame()` → `uvJitter`; roof tiles → `uvScale: [u, v]`; `textured(set, { ao })` for the arm map's occlusion.
- `tholos.ts`: `bond: false` on the rings and the cap, and their hand bonds, can go (they bond by themselves); keep `k.d.bond(finial, cap, 0.05)` (the finial stands on a point).
- The player's wall check against the scenery is the demo's now; rockets cut what's already moving.

## Still open

- Dust Town's background glow is opposite the light until it takes `sky.backgroundHdri` (above).
- Market Town's round towers' colliders are walked into 1.35 m out (above).
- `'landed'` doesn't fire for a section that lands on loose debris, only on the ground, scenery, rubble or what stands.
- `glow: 'standing'` has no per-piece switch (a world keeps its own for lights that aren't all on) and goes dark on hinged pieces.
- The launcher's 0.07 s flash still drops Harbor Yard's reflections round the muzzle; there are no hands.
- The base `explosion.near` takes are harsh in their first bang (the asset, not the mix).
- A pack's `finish-props.py` that fits its own colliders (Harbor's drum and reel) is skipped by `--colliders`, which then fits `standing` hulls until `props.mjs` says `round`.
- Rubble doesn't weigh on what it rests on; scenery added after `reinforce()` holds nothing up until the next one; prop welds give a little under a heavy pile.
