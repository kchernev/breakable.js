# Making a world

A world is one place to blow apart: what's built and of what, the ground it stands on (which can
break too), how it looks (sky, light, fog), how it sounds, what stands around (props), and how it
reacts, to a rocket and to the gun alike. The demo (`src/demo/main.ts`) is the same for every
world: renderer, post-processing (ambient occlusion and bloom), GPU physics, the player, two
weapons (the rocket launcher and the machine gun: <kbd>1</kbd> / <kbd>2</kbd>, the wheel,
<kbd>Q</kbd> the last one), particles, marks on surfaces (bullet holes, scorches) and sound. Worlds
are picked in the overlay (a card each, with its picture) or with `?world=<id>`
(http://127.0.0.1:5330/?world=<id>).

Brick Street (`src/demo/worlds/nyc/`) is the worked example. Read it first: it uses the library
and the world contract plainly, most features once, where they do the most (its road and
sidewalks are its breakable ground; its car alarms, pigeons and hydrants answer the gun).

## Files

```
src/demo/worlds/<id>/meta.ts        export const meta: WorldMeta  ({ id, title, blurb, order })
src/demo/worlds/<id>/index.ts       export default the WorldDefinition (src/demo/worlds/types.ts)
src/demo/worlds/<id>/*.ts           its builders, materials, scenery (split as you like)
src/demo/worlds/<id>/README.md      what it is, how it's built, its assets, what to tune
public/thumbs/<id>.jpg              its picture in the picker (below: "The picture")
scripts/assets/packs/<id>/          its asset lists: sounds.mjs, textures.mjs (+ textures.py), props.mjs
                                    (+ finish-props.py, an optional last step after process-props.py)
assets-src/packs/<id>/              raw generations, with how each was made (made by the scripts)
public/packs/<id>/                  finished assets: textures/, sounds/, models/, hdri/, CREDITS.md
```

The registry (`src/demo/worlds/registry.ts`) finds every `worlds/<id>/meta.ts` by itself:
nothing else needs editing to add a world.

## The definition (src/demo/worlds/types.ts)

Asset URLs (skies, prop packs, sound packs, texture bases) are relative to the page, with no
leading slash: `'packs/<id>/models/'`, not `'/packs/<id>/models/'`. The demo is then served the
same from `/` (the dev server) and from a subpath like `https://<user>.github.io/<repo>/`.

- `sky`: an HDRI (`'name.hdr'` from `public/hdri/`, or a URL like `'packs/<id>/hdri/x.hdr'`), the
  sun's `azimuth` (radians from +x toward -z) and `elevation` (radians above the horizon; default
  the HDRI's own sun's, raised to about 14° when lower), `background` and `environment` strengths,
  and the sun light's `color` and `intensity`. The sky is turned so its glow is where the light
  comes from. `backgroundHdri` shows another sky than the one that lights (its sun turned onto the
  light's azimuth too): Dust Town lights with Goegap and shows a pure noon sky.
- `look`: fog (colour, near, far), `exposure`, `bloom` (strength, radius, threshold; raise it for
  night and neon), the `hemisphere` fill light, the `ao` radius, and:
  - `fill: { intensity, color?, azimuth?, elevation? }`: a light without shadows from the shaded
    side (default opposite the sun, as high, in the sun's colour): what sunlit walls and the street
    bounce back into the shade.
  - `reflections: { strength, distance, thickness, quality, resolution }`: screen-space reflections
    on glossy surfaces. A surface reflects by its roughness (under ~0.1 fully, over ~0.4 not at
    all) or its metalness: give a wet street or a polished floor a low `roughness` (and no
    roughness map, or a dark one). Defaults: rays to 100 m (far enough to reach a tall sign from
    the street), `quality` 1, the pass at half `resolution`, `thickness` 0.15 m. At these the pass
    wasn't measurable over the frame here; use it where it matters (Harbor Yard's wet concrete).
  - `grade: { saturation, contrast, tint, vignette }`: colour grading after bloom (1 = unchanged;
    vignette 0–1).
  - `weather: { rain, rainColor, wind, motes, motesColor }`: rain streaks (0–1 heavy) or motes
    (dust, pollen) drifting in the light (0–1), all on the GPU around the player.
  - `haze: { strength, from, height }`: heat shimmer where what's seen is far (from 40 m, fully by
    twice that) and low (under 4 m); `strength` is about pixels at 1080 lines (default 1.5).
  - `smoke: { color, opacity, life, scale }`: the blast's cloud (default the dust palette's
    colours; the others times 1). `scale` makes it smaller without touching the fireball. Sun
    Temple's is white marble dust that clears in ~6 s.
  - `dustPalette: { colors, blend }`: what all dust is mixed from (default warm tans and greys),
    and how far a material's own dust colour (`dust`, below) is taken over it, 0–1 (default 0.45).
    For steel and concrete, cool greys and a high blend.
  - Try looks and skies without editing code: `?world=<id>&look=<URL-encoded JSON>` is merged over
    the world's own look (e.g. `look={"bloom":{"strength":0.8},"weather":{"rain":1}}`), and
    `&sky=<JSON>` over its sky (e.g. `sky={"elevation":1.13}`).
- `materials()`: the breakable materials, by name.
- `ground`: the height pieces stand on (default 0; `null`: none, stand on static pieces).
- `scenery(scene, world, sky)`: what doesn't break. Draw the ground and add it to the physics world
  (`world.addBox({ size, position, fixed: true, friction })`), plus anything far off (skyline,
  hills, mesas, sea). Every fixed body stops rockets and bullets, and those that rise above
  `groundAt` (a corner more than 5 cm over it) are walls and floors to the player too: make
  colliders follow what's drawn (a round tower's collider as a hull round it, `world.addHull`, not
  a box). Bodies that are the ground itself are left to `groundAt`; under a breakable ground the
  ground body's top is the ground's bed (see "Breakable ground").
- **Lights**: make every light the world will ever use in `scenery()` or `build()`, at intensity
  0 until wanted, and switch them by intensity, colour and place. A light added or removed later,
  or a shadow switched on or off, recompiles every lit material (a frame of over half a second).
- **What's drawn later**: before the card (its "Shaders…") the demo draws every pass of the scene
  as `build()` left it, nothing culled, steps the world once and runs the particles, so every
  pipeline is made at load. Anything that appears later should be in the scene from the start,
  empty or out of sight (Brick Street's hydrant droplets, Harbor Yard's flames; the birds a shot
  puts up: Brick Street's pigeons and Harbor Yard's gulls sit on their perches from the start, Sun
  Temple's jackdaws and its falling leaves are drawn shrunk to nothing), or its first frame
  compiles. And three keys a material's pipeline on each of its numbers being zero or not:
  switch an emissive between a little and a lot, never to 0 (Harbor Yard's lighthouse at 0 cost a
  78–91 ms frame at each switch).
- `groundAt(x, z)`: the ground's height (structures aside), where the player walks, a rocket that
  hits nothing else goes off and a bullet that hits nothing else strikes. Inside a breakable
  ground's area it's the ground's bed, under the slabs (`top - depth - underDepth`): the player and
  the weapons find the slabs as pieces over it. A bullet striking the world's own ground (not a
  piece) is dirt where the step sound there (`audio.footsteps`) says dirt, sand, gravel, grass,
  soil, mud or earth, else stone; down in a pit through a breakable ground, what that ground is
  made of there (its bed, its layers, or `pitSide`: "Breakable ground").
- `walkable(x, z)`: where the player may walk (default anywhere): a step off it stops at the edge
  (Harbor Yard keeps the player out of the water). Flying goes anywhere.
- `water(x, z)`: where the ground is water. Bullets go into it (nothing seen or heard, no
  `onShot`), and a blast within a metre over it (`groundAt` there is the water's surface) leaves no
  scorch. Without it the demo guesses: where `walkable` says no and `groundAt` is under -0.5 m.
  Say it wherever there's water, and where the guess is wrong: Harbor Yard's
  `(_x, z) => z < QUAY.edge`, Sun Temple's sea `(x, z) => terrain(x, z) < SEA`, and Market Town's
  `() => false` (beside a scenery house kept from the player, the guess took a crater's bed in the
  square for water: rounds into its floor went in unseen and unheard).
- `far`: the camera's far plane (default 600 m; Sun Temple's hills are further). Fog should end
  before it.
- `props`: prop pack base URLs (e.g. `['packs/<id>/models/']`, or `'models/'` for the base pack).
  Their models arrive in `build()` by name.
- `build(d, models)`: build everything breakable and return `{ feet, look }`, where the player
  starts and what they look at. The demo calls `d.reinforce()` after, so what's built stands. Lay
  a breakable ground first (`d.addGround`), so what stands on it bonds to its slabs.
- `destruction`: the Destruction's options, any but `world`, `scene`, `materials` and `ground`
  (`shatterSpeed`, `heavy`, `maxLoose`, `maxPieces`, `maxSpeed`, `killBelow`, `killBeyond`,
  `rolling`, `passHeldOnly`, `bondTolerance`, `frameBudget`, ...). The demo's own defaults are
  `maxLoose` 3000 and `capacity` 600k, and no `maxPieces`. Every world sets `killBelow` and
  `maxPieces`; Harbor Yard keeps `maxSpeed` 25 too:
  - `killBelow` (default 50 m under the ground) and `killBeyond` (default 1000 m): loose pieces and
    props below the one, or further than the other from (0, 0) seen from above or as high above the
    ground, are taken out. Set `killBelow` just under what's below the ground, a breakable ground's
    bed included: Brick Street's -2 m is 0.65 m under its street's bed, Market Town's and Dust
    Town's 0.7 and 0.8 m under theirs, Harbor Yard's 3 m under its water and Sun Temple's 10 m under
    its sea. `killBeyond` is a circle round (0, 0), the same distance caps height, and it takes
    props too: it catches what's flung far, it doesn't keep a street tidy (Dust Town lets the board
    or two a collapse throws 60–110 m into the desert lie there).
  - `maxLoose`: past it the smallest loose pieces go, but not props nor what hangs on a hinge (they
    count toward it). A cost cap: Market Town's tower fall costs about the same at 1500 and 3000.
  - `maxPieces` (default Infinity: none): a budget on all the pieces, for long sessions. Past it,
    rubble at rest shrinks away into what it lies on, a few at a time, what's least to be seen
    first; what stands never goes ("What the library does by itself", below). Set it to what the
    world loads with and 1,500 (about what a minute of the gun at a brick wall adds), so it starts
    to work after a long session or a big collapse, not in the first minutes: Brick Street's
    `{ killBelow: -2, maxPieces: 9400 }` (7,886 at load), Market Town's and Neon Alley's 9,500,
    Dust Town's 9,400, Harbor Yard's 8,300, Sun Temple's 7,250. (Not a material's `maxPieces`,
    which is how many cells one break makes.)
  - `maxSpeed` (default 40 m/s; below) and `rolling` (rolling resistance, default 0.02; 0: pieces
    and props roll on).
  - `passHeldOnly` (default false): a bond giving way passes on to what's under it only what it
    holds, so a rocket holes a roof rather than bringing it down bay by bay; but a balcony whose
    posts went may then hang on as a shelf. It changes what comes down (Market Town tried it: its
    nave stood, but its round tower no longer came down), so try it on the whole world.
- `audio`: packs, levels, ambience, which sounds each material makes (a bullet striking it too),
  footsteps (see "Sound").
- `dust` and `chips`: colours of the dust a material makes and of its flying chips, a bullet's
  strike on it included. `dustAmount`: how much dust a material raises, times 1 (its broken bits
  and the cloud over a section of it coming down): a steel frame raises grit (0.15), not a masonry
  cloud.
- `blastRadius` (default 2.3).
- `pitSide(at, ground)`: what the side of a pit through a breakable ground is where a bullet
  strikes it ("Breakable ground", "Steps and strikes").
- `onStart`, `onBlast`, `onShot`, `onBurst`, `onImpact`, `update`: reactions (below).

## Breakable ground

A road, a square, a yard or a field can break: `d.addGround(...)` in `build()` lays it as slabs
over a rectangle, a top layer over an optional one under it, on the world's fixed bed. A rocket
leaves a crater, its chunks thrown up and out to land round the rim; bullets bite into it, and held
on one spot dig a ragged pothole down through its layers ("What a bullet does", below); the player
walks down into a crater and out (a jump gets out of a deep one). All six worlds have one; Brick
Street's road and sidewalks are the worked example (`index.ts`, `city.ts`, `materials.ts`,
`scenery.ts`).

```ts
// build(d), first: the road between the curbs, asphalt over earth, its map running on into the
// road drawn beyond it
const road = d.addGround({ material: 'asphalt', under: 'earth', area: [-40, -6.5, 40, 6.5], top: -0.15, depth: 0.3, underDepth: 0.9, cell: 2.2, textureFrame: { position: [-130, -0.15, 6.5] } });
road.bed; // -1.35 (top - depth - underDepth): the ground body's top under the area, and groundAt there

// Neon Alley's street: wet asphalt over a concrete base, its pit's floor drawn (and struck) as wet
// earth, a material in materials() that no piece is made of
d.addGround({ material: 'asphalt', under: 'base', bed: 'earth', area: [GROUND.x0, -FRONT, GROUND.x1, FRONT], top: 0, depth: GROUND.depth, underDepth: GROUND.underDepth, cell: GROUND.cell, toss: GROUND.toss, textureFrame: { position: [0, 0, 0] } });
```

- **Options** (`GroundOptions`): `material` (the top layer: asphalt, cobbles, sand, paving) and
  `under` (earth, gravel, fill; none: the top lies on the bed), `area` (`[x0, z0, x1, z1]`), `top`
  (default the Destruction's `ground`), `depth` (0.3) and `underDepth` (0.6), `cell` (about how
  wide a slab is, 2 m: the area is cut into equal slabs nearest it each way), `textureFrame` (where
  the maps are laid from: on the top u along +x and v along -z, at the material's `uvScale`;
  default the area's x0, z0 corner), `toss` (how hard a blast throws the chunks, a share of how it
  throws anything else: 0.4), `tint`, and `bed`: what the floor of a pit through it is, a key of
  the Destruction's materials (default `under`, else `material`; one it doesn't have is refused, as
  an unknown `material` is). Give the bed what it's drawn as: Neon Alley's floor is wet earth under
  a concrete base, Sun Temple's bare rock (`bed: 'rock'`). A material no piece is made of costs
  nothing (its mesh is made with its first piece). It returns a `Ground` (`area`, `material`,
  `under`, `bedMaterial`, `top`, `bed`, `toss`, `slabs`, `contains(x, z, margin?)`: `bed` is the
  bed's height, `bedMaterial` what it's made of); `d.grounds` lists them, `d.groundAt(x, z)` gives
  a ground's bed inside its area (else `ground`), and `piece.ground` says which ground a slab, or a
  cell cut from one, was laid as.
- **How it stands**: a slab is held up by what's under it, down to the bed, never by what's beside
  it: its bonds sideways are cut once laid, and nothing bonds to its sides after (a curb or a wall
  beside the area holds no slab up, and no slab holds it). What stands on a slab bonds to it and
  goes into a crater with it: lay the ground first, and only where the player can reach and
  shoot, never under what must never go (a house standing on slabs goes into a crater). A piece
  standing on the bed at the area's edge (a curb, its foot within 2 mm of the area) stands on the
  ground too.
- **Materials**: `groundPresets.asphalt`, `cobbles`, `sand`, `paving` (stone flags), `earth`,
  `gravel` and `fill` (broken stone under paving), each `(options) => BreakableMaterial` as
  `presets.*` are (pass a `surface`). `reach` sets a crater's size (asphalt 0.5, paving 0.35, sand
  0.65); `impact` is over what wreckage or a car lands on it with (asphalt's 30; a car comes down at
  15-25), and it's what bullets measure it by. Give the top the drawn ground's surface (the same
  set, colour and `uvScale`), an `inside` and `insideTexture` for what a break shows, and the under
  its own look inside and out (both show in a crater); `dust`, `chips` and sounds for each. Say
  `bullet: 'bullet.dirt'` for soil: `materialKind` takes a material named earth, sand, gravel,
  soil, mud, turf or grass for dirt, but one named otherwise (a `fill`) by its sounds, and with
  stone's (`brick.*`, `concrete.*`) the gun strikes and marks it as stone.
- **What worked in the worlds**: a crater's cells too small to matter go as spray, not wedges left
  standing: raise the layer's `minBodySize` (Neon Alley's asphalt 0.16, Harbor Yard's slabs 0.45
  and its gravel 1.2) and, so the rim stays whole, `keepSmall: true` (Dust Town's sand and earth).
  Big flat plates that fall back in and hide the hole want more `toss` (Neon Alley's 0.55). Harbor
  Yard's apron at `toss` 0.6, its slabs cut in up to 24 cells (`maxPieces`): the player stepped
  down into its craters in 53 of 56 walks (35 at the library's 0.4 and 16 cells); with the slabs'
  `minBodySize` 0.45 too, the thin wedges on a rim go as grit, and 79 of 84 walks went down into
  rockets' craters (68 at 0.3). Sun Temple's court had both kinds of plug, its flags falling back
  in and the rubble's 0.6 m cells thrown up and down again: `toss` 0.55, the flags' cells under
  0.25 m as chips, and the rubble a blast or a bullet reaches as grit (`minBodySize` 0.75,
  `keepSmall` so the sides stand) left all 18 craters clear and stood in (before, 2 of 6 held the
  player at the top). Slabs of 2-4 m (`cell`) and two layers at most: each slab costs a piece, 36
  vertices and a share of the broadphase (Brick Street's road is 432 slabs), and each crater adds
  15-120 pieces that stay (the cells left standing round it, and its chunks at rest), and 10 s of
  the gun held on one spot 27-138 (in the six worlds: `docs/changelog/phase-f/pile.md`).
- **The bed**: move the world's fixed ground body's top down to `ground.bed` under the area only,
  and make the bodies round it reach below the bed, so nothing slips under them out of a crater.
  `groundAt` gives the bed inside the area: compute it from the same numbers. Draw what a crater
  shows past the slabs: the bed (a plane at `bed`) and, where the area ends against scenery, the
  pit's sides from the bed up, in the layers' looks.
- **Its look**: lay the slabs where the drawn ground was, with `textureFrame` at its map's origin,
  and cut the drawn ground out over the area (a slab's top and a plane in one place fight). Every
  slab of a layer maps in one frame, so the map runs on across the seams. Paint what's on the
  ground (lines, a curb's edge, a well's shaft, puddles, drains) in the top's surface from
  `pieceFrame()` (in the layer's frame, `position` is from the area's middle), so it goes with the
  chunks a blast throws; a flat mesh laid over the area floats over a crater, and so would tufts
  planted on it. Where the same ground goes on past the area, either draw both with one surface
  function, from `positionWorld` on the drawn ground and `pieceFrame().position` (plus the area's
  middle) on the slabs (Market Town's cobbles, Dust Town's ruts, Neon Alley's wet street: no seam,
  0.02-2 of 255 against the ground before), or lay it as the same layers in static pieces
  (`static: true`) mapped in the slabs' frames (`textureFrame: ground.slabs[0].textureFrame` for
  the top, the last slab's for the under: Brick Street's `groundEnds`). A plane drawn in the same
  texture set beside the slabs showed a seam, up to 12% lighter or darker in some light: they're
  drawn by the library's mesh, with its own tangent frame.
- **Steps and strikes**: `audio.footsteps.surface` gets the slab's material underfoot, and `null`
  down on the bed (at a height under the top, inside the area): give both their steps (Brick
  Street: `steps.rubble` on the earth and the bed). A bullet into a pit's floor strikes as the
  ground's `bed` (its kind, chips, dust, mark and sound; `hit.material` names it). Into a pit's
  side where the area meets the scenery (a fixed body struck within 5 cm of the area, under its
  top) it strikes as the layer at that height: the top layer down to its slabs' bottom, the one
  under it below. That's right where the pit's sides are drawn as the layers (Market Town's square,
  Neon Alley's street); where they're drawn as something else, say what with `pitSide(at, ground)`:
  a material, `null` for the scenery's stone (a hole, as on any wall), nothing (`undefined`) for
  the layer. It isn't asked of the floor. Above the ground's top the scenery is its stone, as ever.

  ```ts
  // Brick Street: the pit's side along the facades is the buildings' concrete footing, not the
  // sidewalk's layers
  pitSide: (at) => (Math.abs(at[2]) >= STREET.front - 0.05 ? null : undefined),
  // Sun Temple: where the court's flags end against the land, the land's cut, earth over rock
  pitSide: (at, g) => (g.material === 'paving' ? (at[1] > -LAYERS.earth ? 'earth' : 'rock') : undefined),
  ```

  Harbor Yard says the same of its crane rails' beams. The chips of a strike and a crater's debris
  land on what's under them, not on `groundAt`.
- `killBelow` just under the bed.

## Reactions

The hooks get a `WorldRuntime`: `scene`, `camera`, `destruction`, `sound` (the engine), `ambience`
(the world's ambience loops by name), `effects` and `time`.

- `onStart(rt)`: once, when it's built and its sounds have loaded. Subscribe to events here and
  start what plays from the start. `update(dt, rt)` runs from the first frame, before it too.
- `onBlast(at, radius, rt)` after each rocket (and `demo.blast`), `onImpact(e, rt)` for each loose
  piece striking something. Examples: a car alarm, a church bell after a blast, sparks from a broken
  neon sign.
- `onShot(hit, rt)`: each bullet of the gun that strikes something (a piece, the scenery or the
  ground; not the sky or the water), after the strike's chips, mark and sound. `hit` is the gun's
  `BulletHit` (`src/demo/gun.ts`): `at`, `normal`, `direction`, `distance`, `piece` (null: the
  scenery or the ground; `hit.piece?.prop` is the model when a prop was struck, `hit.piece?.state`
  says whether it stood), `material` (the piece's; down in a pit through a breakable ground, what
  the ground is made of there; else null), `kind` (`MaterialKind`) and `broke` (the piece gave way
  there). Up to 14 a second while the trigger is held: keep it light (Market Town's, which looks
  over its signs, the bell and the coop each round, takes 0.018 ms a round), and don't play a sound
  on every one.
- `onBurst(burst, rt)`: once a burst ends (the trigger let go, or the gun put away), after the
  gun's echo. `burst` is `{ rounds, at, seconds }`: the rounds fired, where most of them struck (the
  median of the strikes, each axis apart, so a stray round doesn't move it; null when none struck
  anything, all into the sky or the water) and how long it lasted (28 rounds: 1.92 s). A tap of the
  trigger is a burst of one. For the noise of the gun: a hush, birds going up, sirens after a long
  one.

  ```ts
  // Brick Street (nyc/index.ts): the pigeons go up at the first round, the traffic stops once the
  // gun has kept on a moment, a car shot sets its alarm off; a burst adds up toward the sirens
  onShot(hit, rt) {
    if (rt.time - firing.last > FIRING) firing.from = rt.time;
    firing.last = rt.time;
    if (rt.time - firing.from > FIRING) quiet(rt);
    pigeons.startle(rt.camera.position.toArray() as V3, rt);
    if (isCar(hit.piece)) carAlarm(rt, hit.piece, hit.at, 0.2);
  },
  onBurst(burst, rt) {
    noise += burst.rounds * 0.08;
    quiet(rt);
    pigeons.startle(rt.camera.position.toArray() as V3, rt);
    listen(rt);
  },
  ```

  What worked in the worlds:
  - Hear a burst as a blast, scaled to it. Sun Temple's `loud` (0.25 + the rounds / 40, at most a
    rocket's 1) sets how long the cicadas stay quiet and how loud the bay throws the burst back;
    Market Town's `hear` counts the rounds heard lately, each fading over about 10 s, eight of
    them as loud as a blast (the songbirds and the market go quiet by it); Brick Street's and
    Harbor Yard's noise adds 0.08 and 0.05 a round toward the sirens and the ship's horn.
  - Bound each reaction by what it is, not by the rounds, so a burst of 70 sets off one of most
    things: once a burst (a flock at its third strike, the echo as it ends), a cooldown and few
    voices (Market Town's `bell.ping`: two voices, 0.45 s apart), a cap made up front (Sun Temple's
    leaves: 40 at once, 20 a second more; Harbor Yard's leaks: 12 streams and 16 pools).
  - `onShot` comes for the strike, not for what it broke: a round that cuts a piece also sends the
    library's events (`'fracture'`, `'dust'`, `'debris'`, `'collapse'`, `'state'`), as a blast
    does. Leave what answers a break on those, so a rocket and a burst both set it off (Brick
    Street's lamps spark when knocked out of their fittings by a round, a blast or the ceiling
    coming down: `'state'`), and use `onShot` for what a round does without breaking anything (a
    car's alarm, a bell's ring, a tank's leak, a sign swung) or to count rounds.
  - "The gun has been going a while", while it's still held, is `onShot`s counted against
    `rt.time` (Brick Street hushes after half a second of fire, Neon Alley browns out after 20
    rounds without a pause).
  - Both are `WorldDefinition` methods, so `this` is the definition, as for `onBlast`.
- Events (`d.on(...)`): `'fracture'` (a piece broken into cells), `'collapse'` (a section let go),
  `'bondBreak'`, `'impact'`, `'dust'`, `'debris'`, `'landed'` (a falling section or a heavy piece
  touching down on the ground, the scenery, rubble or what stands, once: `{ at, pieces, mass,
  speed, material }`; a container's boom, dust slapped up where a wall lands; not on loose debris)
  and `'state'` (`{ piece, from, to }`: let go, come to rest, woken, gone; many in a blast, listen
  only if needed). Keep what you need for the hooks.
- The effects (`src/demo/effects.ts`): `sparks(at, normal, amount, color)` (electrics, steel on
  steel), `dust(at, volume, color)`, `dustRegion(min, max, amount, color)`, `impact(at, normal,
  color, floor?)` (chips), `explosion(at, normal, scale)`, and `puff(at, { color, rise, size, life,
  opacity, velocity })`: one puff of smoke or steam in its own colour (a vent, a chimney, a fire's
  black smoke, a hydrant's mist). `rt.effects.smoke` and `rt.effects.dustPalette` can be changed as
  it runs. The gun's: `bullet(at, normal, { kind, chips?, dust?, floor? })` (a strike's chips and
  powder, sparks off metal, glitter off glass, clods off dirt), `muzzle(at, dir)`, `casing(at,
  velocity, floor)` and `tracer(from, to)`. Chips and sparks land on what's under them: `impact()`
  and `bullet()` not given a `floor`, and `sparks()`, ask the demo's (`EffectsOptions.floor`: the
  first piece down, else `groundAt`) from just off the surface, so a world's sparks over a crater
  or a raised floor need no floor of their own. (The puffs of powder still rest at y 0.)
- Marks on surfaces: `rt.effects.decal(at, normal, { kind?, size?, piece?, color? })`, a bullet
  `'hole'` (12 cm), a `'dent'` (metal), a `'pock'` (dirt) or a `'scorch'`; on a `piece` it goes
  where the piece goes, and onto its cells when it breaks. `rt.effects.scorch(at, normal, radius)`
  is a blast's soot, softening those round it so blasts in one spot never stack to black. The demo
  puts a hole, dent or pock where each bullet strikes (not where the piece gave way, on glass or on
  a flying piece) and a scorch under every blast but on the water. A mark is drawn only where the
  scene's depth puts a surface in its box, so it never hangs in the air and lies on whatever is
  there: a world's own flat marks on the ground (stains, grates, lines) take a scorch as any surface
  does. A ring of 2048 (`stats().marks`); the oldest fade as new ones come.
- Letting things go by hand (the library does most of it by itself, below):
  - `d.loosen(piece, velocity?, spin?)`: one standing piece goes whole, cut from its bonds.
  - `d.release(pieces, velocity?, spin?)`: standing pieces go together as one section (their bonds
    to each other become joints, which crack where it lands: `strength`, below): a box off its
    stack, a front off its building.
  - `d.push(piece, velocity)`: push a loose piece, rubble or a prop at rest (a tumbleweed in the
    wind).
  - `d.unbond(bond)` cuts a bond; `d.reweigh()` weighs the structure again after bonds were
    weakened from outside (`b.strength = 0.1`).
  - `d.hinge(piece, anchor, axis, { to?, breakForce? })`: a sign, a door leaf or a bell swinging
    from a piece (`to`) or from the world; it falls when what it hangs from goes. It swings while
    its hinge holds it to the world, to what stands or to a piece that hangs itself (a cable's
    links, each hung from the one before, and a lantern on the last); once what it hangs from has
    fallen, it comes to rest like anything else, and wakes with it. Hang things from the start, in
    `build()`: `d.stats.hanging` counts what hangs (and what's joined to it), `stats.loose` leaves
    out what hangs at rest (still, or swaying within 10 cm for 6 s), and the loose cap leaves it.
  - `d.explode({ at, radius, speed?, spin?, loose? })` and `d.hit(at, radius?, speed?)` (a small
    break). All blasts, hits and bullets share one breaking budget a frame (`frameBudget`, 4 ms):
    what's over breaks in the next frames, so `explode()` may return `done: false`. `loose: true`
    cuts the loose pieces it reaches too, as the rockets do.
  - `d.shoot(at, direction, power = 1, range = 500)`: a bullet (the demo's gun fires these, below).
    It strikes the first standing piece, rubble, prop or loose piece (where it is now) and returns
    a `ShotHit` (`piece`, `point`, `normal`, `distance`, `material`, `broke`, `damage` 0-1) or null.
  - `d.loosePieces` (read only); `d.killBelow`, `d.killBeyond` and `d.maxPieces` (above) can be set
    in `build()` or as it runs; `d.viewer` is the camera the budget looks from (default the first
    camera in the scene: the demo's).

## Building breakable things (the library: src/lib)

- `d.addBox({ material, size, position, rotation?, tint?, static? })`. `d.addConvex({ material,
  points, position, rotation })` makes the hull of points. Shape helpers (`src/lib/shapes.ts`):
  `cylinder`, `frustum`, `prism` (gables, wedges), `ringSegment`, `arch` and `pointedArch`
  (voussoirs, round and Gothic), `arcBlock` (round towers), `domePiece`.
- **Bonds**: pieces that touch face to face (within 2 mm and 2.6° of facing each other, all over
  where they overlap) are bonded by the area they share. What doesn't reach the ground through
  bonds falls. Exact contact matters: make neighbours share faces exactly (compute positions from
  the same numbers), and never overlap pieces (overlaps push apart violently at the first step).
  A piece may bond more loosely (`bond: { gap, angle }`: a dome's rings), or not at all
  (`bond: false`). Pieces that meet only at an edge or a point (a tilted stringer, a finial) need
  `d.bond(a, b, area)`, as the fire escapes' stairs do.
- **How it stands and falls** (each `BreakableMaterial`; start from `presets.brick/concrete/glass/
  wood/metal` or `material({...})`): `support` (what a bond carries sideways or hanging, per m²),
  `compression` (how many times more pressed), `strength` (joints once falling, below), `impact`
  (how hard a falling piece must hit it to break it, and so how many bullets it takes: below),
  `fragmentSize`/`minSize`/`dustSize`/`maxPieces` (how it breaks; this `maxPieces` is the most
  cells one break makes, not the Destruction's budget), `rubbleLife` (how long its small rubble
  lies), `minBodySize` (a blast's cells smaller than this are particles, not bodies: thrown within
  its reach, falling where they were beyond it), `shatter`+`reach` (glass), `plastic` (metal
  bends), `density`, `friction`, and:
  - `strength` holds a falling section together: as each of its pieces first strikes something,
    each of its joints breaks if the strike's energy (½ × the two pieces' reduced mass × their
    speed into what was struck, squared) is over `strength` × the joint's area × 1 mm. Low, a front
    breaks up where it lands (Brick Street's brick, 500); at the preset's 2.2e4 it lay in the
    street as a sheet with its window grid. It changes nothing about what stands (`support`).
  - `keepSmall: true`: a blast's cells under `minBodySize` beyond its reach stand as bodies (a pane
    partly in reach keeps its far shards in the frame).
  - `landing` (m/s): its loose pieces break where they land, however light (roof tiles, pots,
    panes that fall whole).
  - `grain: { axis, stretch }`: it splits into splinters along an axis of each piece's texture
    frame ('u', 'v', 'w'), so boards laid along their length split along it.
  - `audible`: loose pieces heavier than this report what they strike (light tin, to be heard).
- **What a bullet does** (`d.shoot`; the demo's gun fires 14 rounds a second at power 6, a tracer
  every other, for as long as the trigger is held: no magazine, no reload):
  - It pushes what's free to move along its way, up to `bulletPush(mass, power)` m/s (`0.008 ×
    power / mass`, at most 6; under 0.08 not at all): a crate skitters off, a bin slides, a car
    doesn't move. What's already going that way as fast isn't pushed again, so a sheet held in the
    line of fire isn't sped up round after round. Props and static pieces never break (they take
    marks). A piece too small to cut comes loose whole when it gives way.
  - Each round adds `power` to what the piece has taken, and it breaks where it was struck once
    that passes `bulletsToBreak(material, piece.size)`: glass (`shatter`) at the first, anything
    else at `3 × (impact / 25) × (2.5 if plastic) × (size / 0.25)^1.5`, rounded (`size`: the cube
    root of its volume). So `impact` sets how a material takes bullets as well as falling wreckage:
    at power 6 a quarter-metre brick, a board or a pane goes at the first round, a 0.5 m pier in 2,
    a fresh 2.2 m slab of asphalt in 6, a 2 m concrete block in about 8, a steel plate in a few
    dozen. The gun is meant to be that strong: set `impact` for what wreckage landing on it should
    break, not to make it hold out against the gun.
  - A round that breaks a piece cuts it as a small blast of it alone would, from 8 cm in front of
    the hit, through the same breaking budget and weighing (`'fracture'`, `'dust'`, `'debris'`,
    what falls): its radius `0.8 × size` kept to 0.15-0.4 m, its throw 3 m/s, at most 12 cells,
    each times the cube root of the power (×1.82 at 6: up to 0.73 m, 5.5 m/s, 22 cells); with
    power over 1 the standing pieces within half that radius go with it. The cells start with
    nothing taken, so a block is chipped away round after round, and what it held up comes down.
  - Into a breakable ground a round that breaks a slab bites it instead. Its reach `r` is that
    radius × the material's `reach` (0.36 m into asphalt at power 6): the cells within it go, the
    biggest (if it's at least `r` across) thrown whole up out of the hole and out to one side of
    the line of fire, to land about 4 `r` away, the rest as spray (`'debris'`) and dust. What's left
    of the slab stands round the hole in a few blocky cells, the cuts between them running straight
    out from it, down its sides and under it (in the ground's frame, whatever face was struck);
    what's small, thin, or a wedge by the hole goes as spray too. The slabs of the same layer within
    `r` (or half the round's radius, if that's more) are bitten with it; the layer under, by the
    rounds after. Held on one spot, the bites run together into a ragged pothole down through the
    layers to the bed, its chunks lying out to its sides: 10 s at one spot (141 rounds) left
    1.85-4.1 m² open and 0.48-1 m deep in the six worlds, +26 to +89 ground cells standing (phase
    E's cut left a heap of wedges, up to +132). A rocket's crater is cut as before.
  - A piece no bigger than 1.5 × its material's `minSize` isn't cut: it comes loose whole, on the
    bullet's way, wherever it's struck. Keep `minSize` under the size of thin pieces that should
    shoot apart (Neon Alley's shutter slats: 0.15).
  - What the gun does to each world's materials (rounds to break its pieces, what a long burst
    brings down, frame times) is in its README.
- **What the library does by itself** (don't script it):
  - It weighs where each piece's weight bears: a piece whose weight has moved off what it stands on
    tips, held only by its bonds as levers at what its material holds pulled (`support`: a block
    well bonded over a hole stays, one weakened from outside falls), and a span that lost a column
    comes down. A section let go turns over the edge it's out past, and cracks where it strikes
    (`strength`, above).
  - Loose pieces come to rest: a few each frame (2 ms), lowest first, frozen as rubble where what's
    under them holds them up; a piece that stays within 10 cm for 6 s is at rest however it creeps
    or jitters, and a section at rest in part for 2.5 s parts there. Loose pieces and rubble hold up
    only what's higher (its centre over theirs), a piece over a gap (nothing within 1 m under its
    centre of mass) propped on one no lower drops through it, and a section at rest bent more than
    4° at a joint gives way there (not metal's `plastic` joints): two blocks in a V across a gap
    come down. Rubble and props wake when what they rest on goes.
  - In the solver: nothing loose goes faster than `maxSpeed` (40 m/s), nor further in a step, and
    no contact pushes harder than it takes to change its pair's speed apart by that in a step, so
    nothing is flung kilometres. Sliding pieces stop where friction says and slide over the seams
    of flush fixed bodies (planks, slabs, paving); contacts with fixed bodies are found a few steps
    ahead, so thin pieces thrown at the ground stop on it; a piece pressed into the ground rises out
    of it; round pieces and props roll a little way and stop (`rolling`: a drum 0.6 m across set
    rolling at 2 m/s stops in about 3 m, a baluster at once).
  - Rubble goes, shrinking away over 1.2 s into the point under its middle (it sinks into what it
    lies on rather than popping out of sight): small rubble (under twice its material's `dustSize`)
    once it has lain its material's `rubbleLife`, and past the Destruction's `maxPieces` the rest of
    what's at rest, a tenth of what's over every 0.25 s (at most 32 going at once: about 25 a
    second). What's out of the viewer's view goes first, and of each, what looks smallest from it
    (its size over its distance). Never what stands, props, anything loose or hanging, rubble that
    came to rest under 3 s ago, nor rubble with other rubble lying on it from above (the top of a
    pile goes first); rubble that came to rest joined goes together or not at all. What only
    leaned on a piece that went rests on as it lies; a piece woken while it goes (a bullet's push,
    a blast) stays, drawn whole again. Brick Street's collapse, then the budget set at 5,000, far
    under its count: its rubble went from 2,117 pieces to 37 in 85 s, steadily, none woken, the
    frames as before.
- **What it doesn't**:
  - Rubble doesn't weigh on what it rests on, and weight goes to the ground by the fewest bonds, not
    by stiffness: a piece joining two parts that shouldn't be joined (a pane bonded up a window's
    sides) becomes a way round a hole (Market Town keeps its glass 5 mm clear of its jambs).
  - A light piece holds at most about 245 times its weight (`maxSpeed` × 60 steps a second / g;
    153 at 25 m/s): under more it's pressed into what it rests on, the ground included.
  - There's no true continuous collision: now and then a few cells of one piece, pressed by a heavy
    one landing on them, go through the ground (none in most collapses, up to 8 in Brick Street's).
    A `killBelow` just under the ground takes them out.
  - A few pieces a collapse are still thrown, at up to `maxSpeed`, and a blast kicks its lightest
    cells at up to about twice its speed (32 m/s for a rocket's 15): far enough to land 100 m off.
  - Two blocks in a V over rubble less than 1 m under them can still settle there, and a section
    cracks only at each piece's first strike since it came loose.
  - A bullet that breaks nothing sends no event (its chips and its hole are the demo's to draw,
    from the hit), and a piece changes shape only when it gives way.
  - The budget takes back rubble at rest, never what stands: the cells a crater or the gun leaves
    standing round a hole stay. Rubble that came to rest joined, with another piece lying between a
    part of it above and a part below, holds itself up and never goes (5% of a collapse's rubble
    with the budget far under). A piece going keeps its collider until it's gone: what lands on it
    then rests on what's no longer drawn, and wakes when it goes.
  - A pothole's walls run straight down where two slabs meet (the layers' slabs are laid on one
    grid, and a bite ends at a slab's edge unless it struck within `r` of it), and a thin cell
    reaching out past a bite goes as spray, leaving a narrow cut that reads as a crack.
  - What lies on a breakable ground's standing slab isn't on the ground to the resting check (in
    the ground's area the ground is its bed), so a collapse onto the slabs comes to rest later:
    Brick Street's sidewalks, 23-414 loose at +20 s against 6-51 before they were breakable, all at
    rest by +40 s as before.
  - Collision group bit 30 (`1 << 30`) is the library's (jammed pieces dropping clear): don't use
    it.
- **How it looks**:
  - `surface` (a node material; `textured(set, { base, ao, metalMap })` from
    `src/demo/textures.ts` makes one from a texture set, `ao` taking the set's occlusion for darker
    joints), `uvScale` (repeats per metre, or `[u, v]` for a tile that isn't square; maps are
    box-projected in each piece's frame), `inside` (the colour of broken faces) and
    `insideTexture` (their own maps: `inside(set, uvScale, { base })`).
  - Per-piece `tint` multiplies the colour (cheap variety: one draw per material); `tintMask` (a
    float node, or a texture's red) says where it goes: the paint, not the rust or the brick showing
    through.
  - `uvJitter` (0–1): each piece shows its own patch of the map, so blocks of one size don't
    repeat. `textureFrame` lines maps up across pieces (one frame per wall, so courses run on).
  - `smooth` (radians, on a piece): faces meeting at less than it shade as one surface (a drum, a
    tank's shell: `smooth: 0.5`).
  - In a surface's nodes, `pieceState()` (`standing`, `loose`, `rubble`, `broken`), `pieceTint()`
    and `pieceFrame()` (`position`, `normal`, `halfExtents` in the piece's texture frame, kept by
    its cells) read the piece being drawn: a drafted margin round each block, a drum's flutes, a
    plate's darker underside, a false bed joint at mid-height.
  - A piece made again by hand (a part cut off, a shard) should take the old one's look:
    `textureFrame: piece.textureFrame`.
  - Glass: leave `depthWrite` at three's default (true), as `presets.glass()` does; with it off,
    dust drifting over a facade shows bright window-shaped patches.
- **Scale and cost**: keep pieces under ~2 m on a side: a piece more than twice the size of most is
  one of the broadphase's few large bodies (up to 64), which every moving piece is tested against
  each step (past 64, coarse grid levels every moving piece looks in), and a long piece comes down
  whole. Split long walls, beams and parapets. Aim for at most ~8,000 pieces in a world at load
  (the six have 5,752 to 8,014, their breakable grounds' 132 to 816 slabs among them) and few
  materials, one draw call each (the six have 16 to 18, their grounds' two among them). Fixed
  pieces cost the solver nearly nothing; loose ones do. What craters and bullets break stays (the
  cells left standing round a hole, the chunks at rest): a long session takes a world well past
  what it had at load (25 s of the gun at a wall: +6 pieces on steel, up to +1,600 on brick; Brick
  Street's minute of the gun and four rockets, 7,915 to 10,849 at most). Set `maxPieces` to the
  load count and 1,500, as the six do, and the rubble at rest goes back down to it (that session
  ended at 9,405 with the budget at 9,400, 10,328 without); what's left standing stays.
- **How Brick Street stands up**: facades are free-standing stacks of piers, sills and lintels,
  carried by what's under them; floor slabs stop 2 cm short of the facade so it peels away when
  undermined; no piece much over 2 m. Use `static: true` for foundations that must never go.
- **Props**: `d.addProp({ model, material, position, rotation, tint? })` places a model (a GLB with
  a collider and a mass, from a prop pack) that rests until thrown or until what it stands on
  goes, and never breaks (bullets push the light ones and mark them all). Use a material whose
  sounds fit (cars: metal). `tint` colours a copy (only its paint, when the model has a paint
  mask): one model, many cars. A model may collide as several welded parts (`colliders`: a
  forklift's body and forks) and round ones roll (`hullVertices` up to 32; and stop, as pieces do:
  `rolling`): both come from `props.mjs` (below). A prop pushed along for good (a tumbleweed in the
  wind) counts as loose.
- **Emissive things** (neon, lamps, lit windows at night): a material whose surface has
  `emissive` and `emissiveIntensity`, with bloom, and `glow: 'standing'` so it goes dark when
  knocked loose and never glows on broken faces (see the `lamp` material in nyc/materials.ts).
  Real lights are expensive: at most a handful of `PointLight`s (no shadows, made up front: see
  Lights), and let emissive materials and bloom do the rest (blinking: see What's drawn later).

## Sound

The `audio` block:

- `packs` (e.g. `['packs/<id>/sounds/']`; the base pack `sounds/` is always loaded first, and a
  later sound of the same name replaces it), and `settings`: per sound name, over the pack's own
  (`volume`, `pitch`, `near`, ...).
- `ambience`: loops from the start (`{ sound, volume?, high? }`; `high`: how much louder or quieter
  up high). They're `rt.ambience.get(name)` once loaded: duck one with `setVolume(0, 0.5)` and
  bring it back with `setVolume(1, 10)`; don't `stop()` it (nothing starts it again).
- `materials`: which sounds each material makes (`MaterialSounds`: `break`, `impact`,
  `heavyImpact`, `debris`, `strain`, `collapse`, `settle`; start from the base pack's
  `packMaterials`), and:
  - `land`: played once when a section of it (or a heavy piece) lands, instead of its pieces'
    strikes then (`'landed'`): a wall slab's thud, a container's boom.
  - `bullet`: what a bullet striking it sounds like (`bullet.brick`, `.concrete`, `.metal`,
    `.wood`, `.glass`, `.dirt`; default `bullet.<kind>` of `materialKind`). Every world's
    materials say theirs: what `materialKind` guesses from the other sounds and the name is often
    wrong for stone that shares brick's sounds, a bell, cloth, hay, paper or leaves (a soft
    `bullet.dirt` at 1.2-1.3). The kind it names (or the guess) also picks the strike's look:
    chips and a hole, sparks and a dent, clods and a pock. A material with no bullet sound that
    shatters is glass (glitter, no hole), and one that bends is metal; a bullet sound overrides
    both (terracotta that shatters but sounds `bullet.brick` chips like fired clay).
  - `pitch`: its sounds at its own rate, all (`1.15`) or by kind (`{ debris: 0.75 }`), so a
    material shares another's sounds (plaster as brick, higher). A number pitches its bullet sound
    too; `{ bullet: 0.9 }` that alone.
  - `heavy`: its own threshold (density × volume) for `heavyImpact`.
- `footsteps`: `hard`, `rubble`, `land`, and `surface(at, material, rubble)`: the step sound for
  what's underfoot (the piece stood on, or null on the ground: boardwalks, iron grating, the bed
  of a crater in a breakable ground), or nothing for `hard`/`rubble`. The gun takes the world's
  own ground for dirt where this gives a step of dirt, sand, gravel, grass, soil, mud or earth.
- The gun's sounds are in the base pack: `gun.shot` (the demo plays it at half its pack level),
  `gun.tail` (the street's echo after a burst), `casing.drop`, the six `bullet.*` strikes and
  `bullet.ricochet` (`gun.reload` and `gun.empty` are there, unused). A world re-levels them in
  `settings` like any sound (Dust Town's casings land in sand: `'casing.drop': { volume: 0.08 }`).
- Voices: the engine plays 40 at once (`maxVoices`), and under sustained fire the world's sounds
  fight for them. Sounds in the listener's head (played without `at`: the gun's shots, the
  launcher, steps, the ambience bed) have 8 more kept for them (`SoundEngineOptions.reserve`), a
  sound placed in the world never takes one of theirs, and they're never masked by a louder sound
  a moment before: every shot plays. The gun's six strikes play at priority 2 in the demo
  (`WEAPONS` in `src/demo/audio.ts`): what the player shoots at is what they listen for, so a
  strike takes the voice of a quieter sound of the world's (Neon Alley, 20 s of fire and four
  blasts: 269-274 of about 290 strikes heard, 151-178 at priority 1). Give a world's own sounds
  for the gun a cooldown and two voices or so in their `play` (Market Town's `bell.ping`: 0.45 s
  apart), and let a loop near the player go quiet under fire if it's in the way (Neon Alley's neon
  buzz and awning rain give their voices to the strikes while the gun keeps on).
- From the hooks: `rt.sound.play(name, { at, volume, pitch, delay })`; a delayed sound is weighed
  when it reaches the ears (a far blast's echo, hens startled a moment after). A `Voice` has
  `setVolume`, `setRate` (pitch and speed: a windmill's clank in the gusts) and `stop`.
- Levels: keep a world's bed about -33 LUFS standing at its start and its steps as loud as
  `steps.asphalt` at 0.3 (-32.3 LUFS, its slices back to back), in the world's `audio` block (the
  packs' `index.json` is rewritten by the scripts). How they were measured:
  `docs/changelog/phase-c/sound.md`. `sounds.html?pack=<id>` plays a world's pack at that world's
  levels.

## Assets: one pack per world (PACK=<id>)

The asset scripts work on a world's pack when `PACK=<id>` is set (`scripts/assets/pack.mjs`):
the lists come from `scripts/assets/packs/<id>/`, the raws go to `assets-src/packs/<id>/`, and the
results go to `public/packs/<id>/`. Pass the fal.ai key inline (`FAL_KEY=… node …`, read from
wherever you keep it), and never print it or write it into the repo.

- **Sounds** (Stable Audio 3 Medium, ~$0.04 a take): `scripts/assets/packs/<id>/sounds.mjs`
  exports `sounds` (use `sound`, `fx`, `foley` from `../../sounds.mjs`). Each entry: `name`,
  `prompt`, `duration`, `count` (takes), `kind` ('shot' | 'loop' | 'slice'), `space` ('world' |
  'head'), `play` (how the game plays it: `volume`, `near`, `rolloff`, `voices`, `cooldown`,
  `spacing`, `priority`, `bus`: 'sfx' | 'debris' | 'ambience', `reverb`, `pitch`), and for a shot
  that builds up to its hit, `onset` (cut to the rise into its loudest part; on a slice sound,
  `onset: 20` cuts each slice to its rise: a strike). A shot can also lose a little off its front
  (`start`, s: the gun's echo without its crack) or be laid out from stretches of its take
  (`parts`: the gun's reload in `scripts/assets/sounds.mjs`, Brick Street's `ac.hiss` clank
  first). Then: `PACK=<id> FAL_KEY=… node scripts/assets/generate-sounds.mjs`, `… qa-sounds.mjs`
  (an audio model describes each take; redo the bad ones with `--redo name:i`; most of the
  worlds' sounds for the gun were judged instead by their spectrograms and envelopes, and by their
  loudness in the game against the gun's shots and strikes), then
  `PACK=<id> node scripts/assets/process-sounds.mjs` (`--skip name:i:j` leaves out slice `j` of
  take `i`: a footstep that crunches). The base pack (`public/sounds/index.json`) already has
  explosions, brick, concrete, glass, wood, metal, collapse, footsteps, city ambience, wind, fire,
  and the machine gun with its casings and bullet strikes. Only make what's new or what should
  sound different here; a material that only needs another's sound higher or lower needs `pitch`,
  not a new sound.
- **Textures** (GPT Image 2.5): `scripts/assets/packs/<id>/textures.mjs` exports `textures` (use
  `tex` from `../../textures.mjs`, and state the real-world size of the frame in the prompt), then
  `generate-textures.mjs`. To process, `scripts/assets/packs/<id>/textures.py` sets `SETS = { name:
  function }`: `generic` for patternless sets (stone, plaster, sand, rust); `bricks(...)` /
  `lay_bricks` / `lay_boards` (see the base `process-textures.py`) for coursed or boarded ones.
  Run `PACK=<id> python3 -I scripts/assets/process-textures.py`. Look at the previews in
  `assets-src/packs/<id>/textures/previews/`. A mask of where a map is paint (Dust Town's
  `western_siding_paint`) makes a `tintMask`.
- **Props** (GPT Image 2.5 concept, then image-to-3D, then Blender). Two image-to-3D models:
  Meshy 7.1 ($0.80; the default) or Tripo P2 (`generator: 'tripo'` on a prop, or `export const
  generator = 'tripo'` in the list; billed in $0.01 credits, usually cheaper; `tripo` overrides its
  input: `face_limit`, `texture_quality`, `pbr`). **Prefer Tripo P2** (the user recommends it; its
  test hydrant came out cleaner than Meshy's, and every world's props since are Tripo's): use
  `generator: 'tripo'` unless a prop does better on Meshy. A world's budget of image-to-3D
  generations counts either.
  `scripts/assets/packs/<id>/props.mjs` exports `props` (see the base `props.mjs` for the fields;
  import `concept` from `../../props.mjs`), then `generate-props.mjs concept`, look at the concepts,
  set `pick`, then `generate-props.mjs 3d`, then
  `PACK=<id> blender -b --factory-startup --python scripts/assets/process-props.py`. Check the
  previews, and set `yaw` (front to -Z) and `paintOut` (made-up lettering and badges) as needed.
  Also per prop:
  - `scale: [x, y, z]` (stretch after fitting to `metres`), `roughness`/`metalness: [min, max]`.
  - `paint: { hue: [from, to], minSat, grow? }`: that paint turns grey and tintable per copy
    (`addProp({ tint })`). `grow` (texels) takes the paint's rims and the light grey the bake left
    round it (the panel gaps) for paint too, so a copy painted another colour shows no pale seams
    (the base pack's sedan: `grow: 3`).
  - `glow: [{ box, minLuma, color, strength }]`: an emissive map (a vending machine's front).
  - `round: 'x' | 'y' | 'z'`: collides as a 16-sided prism round that axis, and rolls (a drum,
    a barrel, a reel); `parts: [{ box, round? }]`: a hull for each box, welded (the first the
    main body: a forklift's body and forks, a wagon's bed and wheels).
  - `--colliders` fits the colliders again to the GLBs as they are; `finish-props.py` in the pack
    runs after (`--no-finish` skips it) for what a pack needs besides.
- **HDRIs**: Poly Haven (CC0) has many skies. Download a 1k or 2k `.hdr` from
  `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/<name>_1k.hdr` into `public/packs/<id>/hdri/`
  (see the API: https://api.polyhaven.com/assets?t=hdris).
- Credit everything in `public/packs/<id>/CREDITS.md`, and keep a ledger of the paid calls
  (`assets-src/packs/<id>/ledger.jsonl`: a line a call, with its endpoint and `costUSD`).

## The picture

The picker shows `public/thumbs/<id>.jpg`: a 640 × 360 JPEG (under ~80 KB) from a view that says
what the world is, without the HUD, the crosshair or the weapon in hand. Shot at 1280 × 720 and
scaled down (`x, y, z` the feet, flying; `tx, ty, tz` what they look at):

```sh
SHOT_DISPLAY=:1NN node scripts/shot.mjs '/?world=<id>' --port 5331 --size 1280x720 --wait 1000 --out thumb.png \
  --eval "8000|for (const id of ['overlay', 'hud', 'weapon', 'crosshair']) document.getElementById(id).style.display = 'none'; demo.camera.layers.disable(2); demo.player.fly = true; demo.look(x, y, z, tx, ty, tz)" \
  --eval "2500|0"
convert thumb.png -filter Lanczos -resize 640x360 -strip -interlace JPEG -quality 86 public/thumbs/<id>.jpg
```

Without one the card keeps an empty frame.

## Checking it

- Typecheck: `npx tsc --noEmit -p .`; tests: `npm test`; build: `npx vite build`.
- Look: `SHOT_DISPLAY=:1NN node scripts/shot.mjs '/?world=<id>' --port 5331 --wait 1000 --out x.png
  --eval "6000|document.getElementById('overlay').classList.add('hidden'); demo.look(x, y, z, tx,
  ty, tz)" --eval "1500|0"`. Chrome runs on a virtual display, never the desktop. For scripted
  checks: `demo.blast(x, y, z, radius, normal?)`, `demo.shoot(x, y, z)` (a rocket from the eye at a
  point), `demo.weapon('gun')` (or `'launcher'`), `demo.fire(n)` (n rounds of the gun, or n
  rockets, from the one in hand, at its pace, where the crosshair is), `demo.gun`, `demo.weapons`,
  `demo.stats()` (`pieces`, `standing`, `loose`, `hanging`, `particles`, `marks`, ...),
  `demo.profile` (the frame times), `demo.rt` (what the hooks get), `demo.def` (the world's
  definition: wrap `demo.def.onShot` to count what the world hears), `demo.destruction` and
  `demo.pipeline`. Look at the screenshots, from the player's height and from above, before and
  after blasts.
- It should stand: nothing loose (`demo.stats().loose`) for 10 s after loading but what's meant to
  move (Dust Town's tumbleweeds, a sign swung by the wind more than 10 cm), and the count of
  standing pieces (`stats().standing`) the same throughout. What hangs on hinges at rest isn't
  counted loose (it's `stats().hanging`); in the first second after load it is, until it has hung
  still.
- A collapse: four blasts 1 s apart at the foot of the biggest building, then count what's loose at
  +10, +20 and +40 s, the farthest piece, and pieces under the ground. Every world's numbers and
  Brick Street's to compare are in `docs/changelog/phase-d/README.md` (Checked together): Brick
  Street's building at x 10–22 left 389–692 loose at +10 s, 5–188 at +20 s and none at +40 s.
- The gun: square on to a piece of each of the world's main materials 5-6 m off,
  `demo.weapon('gun'); demo.fire(70)` at one spot, then the trigger held 20 s while the view sweeps
  across (wrap `demo.gun.onHit` to count what broke): what gives way when (each world's README has
  its own), pieces added, the most loose at once, the fastest piece let go (in the six none over
  20 m/s but once, 22, in Harbor Yard) and frames over 40 ms. Brick Street's brick wall, four runs:
  52-63 of the 70 rounds broke something, +1,200-1,600 pieces, 675-843 loose at most, 1-74 frames
  over 40 ms in the sweep, the worst 46-120 ms; with the GPU quiet the sweep cost little more than
  standing (`docs/changelog/phase-e/README.md`). Check the strike sounds (`bullet` per material)
  and the marks while at it.
- The world's answers to the gun: bursts of 1, 3, 28 and 70 rounds at each thing that answers (and
  into the sky), counting what plays (wrap `demo.audio.engine.play`) and what's drawn, from the
  player's height. Each answer should come once a burst or by its own cooldown, not once a round:
  81 rounds fired at one of Brick Street's parked cars gave one alarm, three windows, one flock of
  pigeons and one hush; Sun Temple's goddess rang 5 times for 70. Time the hooks (Market Town's
  `onShot`: 0.018 ms a round) and the world's `update()` while firing, against Brick Street's at
  the same time. Fire into the water too: no strike, nothing heard but the gun.
- A breakable ground: a crater (`demo.blast(x, top, z, 2.3, [0, 1, 0])`, or a rocket) in a few
  spots (the open area across, the depth, the chunks round the rim, what it added), walking down
  into it and out the far side, footsteps and bullets on its bed and its sides where it meets the
  scenery (each struck as it's drawn: open a pit at the area's edge), 10 s of the gun held at one
  spot (the pothole, its chunks, what it added), and the seam where the slabs meet the drawn
  ground or the static pieces past them, from the player's height in the world's light.
- The budget: after a collapse has settled, set `demo.destruction.maxPieces` a few hundred under
  `demo.stats().pieces`: the rubble should go down to it at about 25 a second, nothing standing
  lost, the pile looking much the same from 20 m (Sun Temple, 300 under: in 20 s).
- Pipelines: none should be made after the card. Count them by wrapping the device's
  `create*Pipeline` methods (`demo.world.device`) once the page is ready, then stand and blast,
  switch weapons and fire, crater the ground.
- The solver: `SHOT_DISPLAY=:1NN node scripts/solver-lab.mjs --port 5331 [--only seams,roll]` runs
  seven cases (pieces thrown at the ground, sliding, sliding over seams, stacked, pinched, rolling,
  landing), each with its threshold, and exits 1 if one fails. Run it after changing
  `vendor/three-avbd`; each patch there is listed, with its repro, in
  `vendor/three-avbd/VENDORED_COMMIT`.
- Sound: record what the engine plays (its `output` node into a MediaStreamDestination, Chrome
  started with `--autoplay-policy=no-user-gesture-required --mute-audio`; `ffmpeg -i rec.wav -af
  ebur128=peak=true -f null -` for the loudness), or count plays by wrapping
  `demo.audio.engine.play`.
- Performance: 60 fps standing (on the RTX 4090 here), and as few frames over 40 ms in a big
  collapse as Brick Street's (its four blasts: 1–35 of them from the first blast to +10 s, the worst
  41–115 ms, in eight runs). The GPU is shared: compare against Brick Street measured at the same
  time, and repeat runs.
- Why the library is as it is, and what it was measured at: `docs/changelog/phase-c/`,
  `docs/changelog/phase-d/` (the solver's and the collapse's fixes), `docs/changelog/phase-e/`
  (the breakable ground, the gun, its model and its sounds) and `docs/changelog/phase-f/` (the
  worlds hearing the gun, a pit's floor and sides, the pothole, the piece budget).
