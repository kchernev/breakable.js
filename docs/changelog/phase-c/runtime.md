# Runtime: what changed

The runtime team's changes in this phase: the demo every world runs in (`src/demo/main.ts`), the
world contract (`src/demo/worlds/types.ts`, all but `WorldAudio`), the sky (`src/demo/sky.ts`), the
effects (`src/demo/effects.ts`), the player (`src/demo/player.ts`), `textured()`
(`src/demo/textures.ts`) and the weather (`src/demo/weather.ts`: heat haze). In the worlds:
Market Town's `alignSky` was removed (`medieval/scenery.ts`, its call in `medieval/index.ts`), and
Brick Street's and Dust Town's `sky` and `look` were retuned to keep their look with the sky turned
right (`nyc/index.ts`, `western/index.ts`: below).

Tests (no GPU): `tests/runtime.test.ts` (the player's bounds and the scenery's solids on the fake
world, a ray from inside a solid, the quay a player wades back to; what `warm()`, `puff()`, the
smoke settings and the dust palette emit; the collapse cloud's sum; the sky's turn against three's
own lookup). What needs a GPU was checked in the browser (Brick Street, Market Town, Dust Town,
Neon Alley, Harbor Yard, Sun Temple).

## What every world sees differently (defaults)

- **The sky is turned the right way.** `sky()` turned the background and the lighting by
  `found − azimuth`, but three shows what was at azimuth a at a + rotation, so the sun in the sky
  sat at `2 × found − azimuth` while the light came from `azimuth`. Checked, looking toward the
  light from 80 m up: Brick Street's and Dust Town's glow was behind the viewer (about 200° off),
  Sun Temple's 70° off. Now it's `azimuth − found`: the glow sits where the light comes from
  (checked in Brick Street, Market Town, Harbor Yard and Sun Temple, and Neon Alley's moonlit
  clouds; Dust Town draws its own background, see below). The light's own direction is unchanged;
  what turned is the background and the environment's lighting. The turn is `aimSky(hdr,
  azimuth)` in `sky.ts`, tested against three's lookup (the rotation's inverse, then
  `equirectUV`). No world's azimuth was changed.

  The environment's lighting has the HDRI's sun in it (without shadows), so turning it moved that
  light too, and it was strong: in Brick Street about as strong as the sun light. Each world was
  measured against the old turn on the same page (its start view, and turned 90°, 180° and 270°
  from it): how much brighter the surfaces are on average (the sky left out, in sRGB), and in
  brackets the mean difference per 32 px cell either way, which counts a facade that got brighter
  and one that got darker both:

  | | start | 90° | 180° | 270° | what was done |
  | --- | --- | --- | --- | --- | --- |
  | Brick Street, turned right as is | +28 % (31 %) | −17 % (41 %) | −43 % (62 %) | −1 % (44 %) | |
  | Brick Street, retuned | −1.4 % (3 %) | −2.6 % (6 %) | −5.4 % (8 %) | −4.4 % (7 %) | `look.fill` 3.9 from where the old turn put the sky's sun, `environment` 0.55 → 0.05, hemisphere 0.35 → 0.7 |
  | Dust Town, turned right as is | −4.6 % (22 %) | −6.4 % (17 %) | −0.9 % (2 %) | −0.8 % (9 %) | (the review: the left facades at the start −36 %, the right +12 %) |
  | Dust Town, retuned | +0.5 % (3 %) | +0.4 % (2 %) | +0.1 % (1 %) | +0.2 % (3 %) | `look.fill` 2.4 likewise, `environment` 0.45 → 0.12 |
  | Harbor Yard | +1.9 % (7 %) | −7.5 % (8 %) | +1.5 % (11 %) | +17 % (17 %) | none: overcast, the brighter side of the sky moved to where the light is (the haze toward it whiter); a fill doesn't help, and less environment would dull its wet concrete |
  | Sun Temple | −1.4 % (4 %) | −3.8 % (12 %) | +8.7 % (13 %) | +12 % (16 %) | none: the sun is high, the start view as before |
  | Neon Alley | +3.5 % (8 %) | −2 % (14 %) | +3.7 % (8 %) | +5 % (15 %) | none |
  | Market Town | 0 | 0 | 0 | 0 | none: `alignSky` had made the same turn |

  The searches for these (environment, hemisphere, exposure, a fill's strength) and the checks are
  in the runtime team's scratch scripts (`tune.mjs`, `verify.mjs`). A blast's cloud, which takes the
  hemisphere and the environment but not the fill, was compared too: Brick Street's and Dust
  Town's look the same. What a world sees now that it didn't: looking toward the sun, the sky's glow
  (which the old turn put behind the viewer), and in glossy surfaces the sky's sun where the sun is.
  - Market Town: its `alignSky` did the same turn; removed, the same look.
  - **Dust Town: still wrong in its background.** Its `backdrop()` (`western/scenery.ts`) loads its
    own sky and turns it with the old formula (`found − want`), so its glow is still opposite the
    light. Fix: use `sky.backgroundHdri` (below) and drop `backdrop()`.
  - Sun Temple's sea reads `scene.backgroundRotation`, so it follows by itself.
- **Effects are warmed at load.** The demo calls `effects.warm()` once the world is built: seven
  particles (a puff of each kind, a bit of each kind) and a faint flash, three far planes away,
  gone in 0.3 s. `demo.stats().particles` reads 7 for that moment; one of the three flash lights is
  busy for 1.2 s.
- **The scenery's fixed bodies that stand above the ground are solid to the player.** Every fixed
  body a world adds in `scenery()` that rises over its `groundAt` somewhere (Market Town's town
  walls, towers and background houses, Dust Town's ruined corral walls, Sun Temple's hulls along
  the shore) is now a wall the player stops at and a top they can stand on, as pieces are. Before,
  only pieces were. The bodies that are the ground itself or under it (each corner at most 5 cm over
  `groundAt` there) are left to `groundAt`, as before: every world's ground boxes, Harbor Yard's quay
  deck and seabed, and 999 of Sun Temple's 1,102 terrain hulls (`Solids.above()`, below). Counts per
  world (fixed bodies, the player's): Brick Street 3, 0; Market Town 23, 22; Dust Town 19, 18; Neon
  Alley 1, 0; Harbor Yard 2, 0; Sun Temple 1,102, 103. Checked: walking west into Market Town's
  scenery wall stops at its face (x −41.65); in Harbor Yard, walking off the quay into the water
  (to y −2.9) and back, at x 0, 5 and −12, the player climbs back onto the quay each time (the
  deck's face had held them in the water, review finding); the player's update stays at about 0.1
  ms with Sun Temple's solids. Rockets still go off on every fixed body (the launcher keeps them
  all).
- **Screen-space reflections default to long rays at half resolution**: `distance` 100 (was 25),
  `quality` 1 (was 0.75), `resolution` 0.5 (was 1), `thickness` 0.15 (as before). Only Harbor Yard
  has reflections; it sets `distance: 30` itself, and its wet concrete looks the same from its start
  at half resolution (compared side by side). Half resolution costs about a quarter of the pixels
  the old default did.
- **The cloud over a collapse** takes the colour of the material with the most volume in the
  section (it took the first piece's), and its amount scales with `dustAmount` (below; 1 by default,
  so the same amount). The sum is `collapseDust(pieces, amountOf)` in `effects.ts` (tested).
- **`textured(set, { metalMap: true })`** defaults `metalness` to 1 (it was 0, so the map was
  multiplied by 0 and the material wasn't metal). Every current use passes `metalness` itself, so
  nothing changes today.

## New, and what it replaces

### `sky.elevation`: the sun's height, whatever the HDRI's

```ts
sky: { hdri: '/packs/western/hdri/goegap_1k.hdr', azimuth: 1.3, elevation: (65 * Math.PI) / 180 }
```

Radians above the horizon, like `azimuth`. Default: the HDRI's own sun's, raised to about 14° when
lower (as before). The sky's glow stays where the HDRI has it; only the light moves. Replaces Dust
Town's `NOON` raise of `sky.sunDirection` in `scenery()` (`western/scenery.ts`); lets Market Town
set its golden hour at 9–11° (the HDRI's sun is low, so it got the 14° floor). Checked: Brick
Street with `elevation: 0.17` lights from 9.7° on its azimuth.

### `sky.backgroundHdri`: show one sky, light with another

```ts
sky: { hdri: '/packs/western/hdri/goegap_1k.hdr', backgroundHdri: '/packs/western/hdri/qwantani_noon_puresky_1k.hdr', azimuth: 1.3 }
```

Default: the background is `hdri`. The background is turned so its own brightest texel (its sun)
is at `azimuth` too. Replaces Dust Town's `backdrop()` (`western/scenery.ts`), which also had the
turn backwards. The brightest-texel search stays inside `sky.ts`: with this, no world needs it.
Checked: Brick Street with Dust Town's noon sky as its background shows that sky's sun on the
light's azimuth.

### `look.fill`: a light from the shaded side

```ts
look: { fill: { intensity: 2.4, azimuth: -2.66, elevation: 0.81 } } // Dust Town
```

A directional light without shadows: what the sunlit street, walls and sky bounce back into the
shade. `azimuth` and `elevation` in radians, as the sky's (default opposite the sun, as high);
`color` (default the sun's); `intensity` (required). Default: none. It's made with the other lights
before the first frame (see the lights rule below), so it costs nothing to compile later; it lights
surfaces only (the particles take the sun, the hemisphere and the environment, as before).

Why it exists: Brick Street's and Dust Town's looks were made while sky.ts turned the environment
the wrong way, so its sun (the HDRI's sun disc, which the environment's lighting has, without
shadows) lit them from another side than the sun light's, about as strongly as the sun light. With
the sky turned right, that light lands on the sunlit side instead: Brick Street's start view came
out 28 % brighter and its view toward the sun 43 % darker, Dust Town's shaded facades a third
darker and its sunlit ones brighter. The two worlds now have a fill from where that light came from (`azimuth` = 2 × the HDRI sun's azimuth
− the light's, at the HDRI sun's height) and less of the environment; numbers in "The sky is
turned the right way" above.

### `?sky={...}`: try skies without editing code

As `?look=`: JSON merged over the world's `sky`, e.g.
`?world=western&sky={"elevation":1.13}`.

### `effects.warm()`

Called by the demo after `build()`; worlds don't call it. It uses every kind of puff and bit and a
flash once, beyond the camera's far plane (wherever that is: `far` below), on the ground, for 0.3
s: nothing is seen, nothing is left behind. Replaces the warm-up explosions in Sun Temple's
`update()` (`temple/index.ts`, `state.warm`: an explosion, dust and an impact 3 km off) and Harbor
Yard's (`harbor/index.ts`, `state.warm`; keep its `fires?.puff(deep, …)`: its fires are its own).
Remove them: at a `far` over 3000 m they'd show.

What it does to the first blast, measured (three loads each, as first reported, couldn't tell it
from noise): ten loads with it and ten without, alternating (without: main.ts served with the call
taken out, in flight only), on the shared GPU with other agents' Chromes running. The worst frame in
the second after a blast on what's ahead of the start, then after a second blast 6 m aside:

| | first blast's worst frame (ms) | median | second blast, median |
| --- | --- | --- | --- |
| Brick Street, with `warm()` | 43, 34, 34, 40, 66, 46, 39, 33, 46, 33 | 39.5 | 37.5 |
| Brick Street, without | 54, 42, 44, 50, 40, 50, 72, 59, 43, 64 | 50 | 32.5 |
| Market Town, with `warm()` | 45, 42, 39, 49, 33, 34, 36, 48, 37, 42 | 40.5 | 33 |
| Market Town, without | 66, 37, 41, 56, 46, 44, 47, 41, 50, 38 | 45 | 34.5 |

In Brick Street it takes about 10 ms off the first blast's worst frame (a rank test puts the
difference at p ≈ 0.03); in Market Town about 4 ms, which ten loads don't establish (p ≈ 0.1),
though the two worst frames (56, 66 ms) were both without it. With it, the first blast costs about
what a second one does. The aim of under 40 ms is met at the median in Brick Street, just missed in
Market Town, and not every time in either.

What's left in those frames isn't compiling: no render or compute pipeline is created when the
first blast goes off in Brick Street, Market Town, Dust Town or Neon Alley (checked by wrapping the
renderer's pipeline creation), with or without `warm()`. The demo's first frames already compile
the effects (their sprites are drawn, invisible, until the renderer has seen them), and broken
pieces are drawn by the same mesh and material as standing ones (broken faces are an attribute, not
another material), so a `compileAsync` of "the materials broken pieces use" has nothing to compile
and wasn't added. What `warm()` removes is the first *use* of the particle pools on the GPU. The
rest is the GPU's work (the solver's; the CPU part of those frames is 2–8 ms). Sun Temple's first
blast also builds its flock's material then (`build:temple:flock`, 2–3 ms of CPU, and the ambient
occlusion's graph again): an object first shown after the start compiles then; show it from the
start, out of sight, or give it its material up front.

### `effects.puff(at, options)`: smoke or steam in its own colour

```ts
// A steam vent: a puff every 0.1 s
rt.effects.puff(vent, { color: 0xf0f2f4, rise: 2.5, size: 1.2, life: 2, opacity: 0.45, velocity: [0, 3, 0] });
// A fire's black smoke
rt.effects.puff(top, { color: 0x1a1816, rise: 2, size: 4, life: 8, opacity: 0.8 });
```

One puff each call, its colour as given (not pulled toward the dust palette, as `dust()` is).
Defaults: `color` 0xc8c8c8, `rise` 0.8 m/s (slowing as it cools), `size` 1.5 m across (it starts at
a third and grows), `life` 4 s, `opacity` 0.5, `velocity` still (the wind and the swirl take it).
Replaces Neon Alley's vents (`neon/life.ts` `update()`: `rt.effects.dust(VENTS[i], …, 0xd0d8e0)`)
and could replace Harbor Yard's own smoke in `fire.ts` (drawn there because `dust()` turned black
smoke brown).

### `look.smoke`: the explosion's cloud

```ts
look: { smoke: { color: 0xece8e0, life: 0.55, opacity: 0.8 } } // white marble dust, gone in ~6 s
```

`color`: the billow's colour (default the dust palette's tans and greys); the smoke rising out of
it is a darker shade of it. `opacity`, `life` and `scale`: times the default (1). `scale` shrinks
the cloud (fewer, smaller puffs, less spread) without touching the fireball, the flash, the sparks
or the chips. Changeable at run time: `rt.effects.smoke = { … }`. Checked in Sun Temple: the
default brown cloud still hides the temple at 8 s; `{ color: 0xf0ece4, life: 0.55, opacity: 0.8 }`
reads as marble dust and has cleared by then. Replaces Market Town's wrapping of `explosion`
(`scale * 0.55`, which also shrank the fireball and the flash) in `update()` (`medieval/index.ts`,
`thinned`): `smoke: { scale: 0.55 }` or `{ opacity: 0.6, life: 0.6 }`.

### `look.dustPalette`: what all dust is made of

```ts
look: { dustPalette: { colors: [0x9a9c9c, 0x84888a, 0xa8a6a2], blend: 0.8 } } // steel and concrete grit
```

`colors`: the colours each dust puff and flake is mixed from (default, or empty: `0xb8a48c,
0x8a8378, 0xc6b8a2, 0xa38e74, 0x9a9184`, warm tans and greys). `blend`: how far a material's own
dust colour (`WorldDefinition.dust`) is taken over the palette, 0–1 (default 0.45, as before:
steel's grey came out brown; outside 0–1 it's kept to it). At 1 the dust is the material's colour,
lightened; at 0 the palette's alone. It applies to the blast's billow too (unless
`look.smoke.color` is set). Changeable at run time, as the smoke is: `rt.effects.dustPalette = { … }`
(read at each puff). (It was `look.dust` during this phase, beside `WorldDefinition.dust`, which is
something else; no world had used it. An empty palette crashed the effects; now it's the default.)

Dust has three settings, by what they're about: `look.dustPalette` (all dust, the look);
`WorldDefinition.dust` (each material's colour) and `WorldDefinition.dustAmount` (each material's
amount), beside `chips`, by material. For Harbor Yard (steel, fuel)
and Neon Alley; Market Town's dust colours (`dust` in `medieval/index.ts`, made cool and grey so
the warm palette didn't turn them rust) can be its real ones with a cooler palette.

### `WorldDefinition.dustAmount`: how much dust a material raises

```ts
dustAmount: { steel: 0.15, container: 0.15, tank: 0.1, glass: 0.3 }
```

Times the default (1): the dust from its pieces turned to dust (the `dust` event's volume), and the
cloud over a section of it coming down (`8 + volume × 6` puffs, by each material's share of the
section's volume). A steel frame falling raises grit, not a masonry cloud. Replaces Market Town's
`fx.dust` (× 0.4) and `fx.dustRegion` (× 0.2) wrappers in `update()` (`medieval/index.ts`).

### `look.haze`: heat haze

```ts
look: { haze: { strength: 1.5, from: 40, height: 4 } } // the defaults
```

What's seen far and low wavers: noise rising through the air shifts each pixel a little (about
`strength` pixels at 1080 lines) where what it shows is over `from` m away (fully by twice that) and
under `height` m (above y = 0). One full-screen pass of two noise lookups and three texture reads a
pixel: not measurable over the noise here (the whole post chain drawn back to back at 2× the pixels
took 0.3–1.7 ms a frame with it and without it). Checked in Dust Town looking out over the desert:
the horizon, the bases of the mesas and the far scrub shimmer, the town and the near ground stay
still. Default: off. For Dust Town (with its haze skirt, which is a colour, not a shimmer: keep it).
`heatHaze()` in `weather.ts` is the node, if another pipeline wants it.

### `WorldDefinition.walkable(x, z)`: where the player may walk

```ts
walkable: (_x, z) => z > QUAY.edge + 0.3, // Harbor Yard: not out onto the water
```

A step from where it's true to where it's false stops at the edge (along the edge is fine: the
player slides). From outside (flown out and landed), any way back is allowed. Flying goes anywhere.
Default: anywhere. For Harbor Yard (today `groundAt` lowers the player into the water); Market
Town's background houses are walls now without it (above).

### The scenery's fixed bodies are solid (no option)

See above. `Solids` (`player.ts`) takes the bodies (boxes as boxes, hulls as their hulls, spheres as
their boxes) and casts rays against them on the CPU; `solids.raycast(origin, dir, max)` returns the
nearest shape the ray enters (a shape the ray starts inside is passed through: it used to come back
at distance 0 and hide every other shape, so a player inside one walked through all the others).
`solids.above(groundAt)` is the same shapes without those that are the ground itself or under it.
main.ts gives the launcher `new Solids(fixed bodies)` and the player `solids.above(def.groundAt)`:

```ts
const solids = new Solids(world.bodies.filter((b) => b.fixed));
const footing = solids.above(def.groundAt);
```

Replaces nothing in code. What it means for the worlds' colliders, which were made for debris and
are now walked against too:

- **Market Town**: its round towers' bodies are 7 × 7 m boxes (`medieval/scenery.ts`, the
  `world.addBox({ size: [7, 9.5, 7] … })` for a tower of radius 3.4–3.6), so the player meets an
  invisible corner about 1.35 m out on the diagonals (and so does debris). A hull of 12–16 points
  round the tower (`world.addHull`) would fit it. The stepped ruin has bodies for its three tallest
  steps only: the lower steps are walked through, as before.
- **Sun Temple**: its terrain hulls follow `terrain()` at their corners and so are the ground
  (left out); the player walks on `groundAt` there, as before. The 103 kept are the shore's cells
  with a corner clamped up to `SEA − 14`: along the waterline, at 43 of 78,796 points sampled every
  0.5 m above the sea, the player stands 0.25–1 m over the drawn ground.

No world needs to choose which bodies the player meets beyond that (the review suggested a
`solid(body)` filter): leaving a rough collider out would let the player walk through what it
stands for (a tower), where a closer collider fixes it for debris too.

### `WorldDefinition.far`: the camera's far plane

```ts
far: 2000, // Sun Temple: the hills and the far shore
```

Default 600 m (as before). Fog should end before it. Lets Sun Temple put its hills past 600 m.

### `WorldDefinition.destruction`: the Destruction's options

```ts
destruction: { shatterSpeed: 5, heavy: 1.2, maxLoose: 2000 },
```

Any of `DestructionOptions` (`src/lib/destruction.ts`) but `world`, `scene`, `materials` and
`ground` (which the demo sets: `ground` is `WorldDefinition.ground`). The demo's own defaults
(`maxLoose` 3000, `capacity` 600k) apply unless the world sets them. Whatever the library adds to
its options (the solver team's `killBelow`, `maxSpeed`) is passed the same way.

### `WorldDefinition.onStart(rt)`

```ts
onStart(rt) {
  rt.destruction.on('fracture', (e) => …);
  birds = rt.sound.play('ambience.birds');
},
```

Called once, after `build()`, when the sound packs have loaded (or failed to: a warning, and it's
called anyway). `update()` runs from the first frame, before it too (the sounds take a moment), so
`update()` mustn't count on it. Loops can be played then (they wait for the first click to be
heard); one-shots return null until the player clicks. Replaces subscribing on the first
`update()`: Neon Alley's `s.subscribed` (`neon/life.ts` `update()`), Market Town's `birds ??=` /
`market ??=` (`medieval/index.ts` `update()`).

### `rt.ambience`: the world's ambience loops

```ts
rt.ambience.get('ambience.cicadas')?.setVolume(0, 0.25); // hushed by a blast
rt.ambience.get('ambience.cicadas')?.setVolume(1, 10); // back
```

The sound team's `DemoAudio.ambience` (a `Map<string, Voice>` of `WorldAudio.ambience`, by sound
name), in the runtime. Empty until the sounds have loaded; filled by the time `onStart` runs. See
`sound.md` for how its volume and the height shift combine. Lets Sun Temple list its
cicadas in `audio.ambience` instead of playing them itself in `update()`.

### Lights: the rule (no pool)

Adding or removing a light after the first frame, or switching a light's `castShadow`, recompiles
every lit material: measured in Brick Street, adding one point light made a 575 ms frame; changing
an existing light's intensity, none. So: make every light a world will use in `scenery()` or
`build()` (nothing is compiled before the first frame), at intensity 0 until wanted, and move,
colour and switch it by its intensity. Neon Alley's four lights in `scenery()` are right as they
are. A pool in the demo (`rt.lights`) would do no more than that and cost each idle light in every
lit pixel; it's written in `scenery()`'s doc comment instead.

### `look.reflections`: `thickness`, `quality`, `resolution`, and longer rays

```ts
look: { reflections: { strength: 1 } } // distance 100, quality 1, resolution 0.5, thickness 0.15
```

`thickness`: how thick (m) what's in the depth buffer is taken to be; `quality`: ray steps per
pixel of the ray on screen (0–1); `resolution`: of the reflection pass, as a share of the
screen's. **For Neon Alley to try:** screen-space reflections do reflect the alley's tall signs in a
wet street. With its street swapped for a plain mirror (roughness 0.04) at run time, the defaults
above showed the signs down the alley and the lit shops in the street from the start and from
x −24 (the old 25 m reached the far ones; 100–150 m reach the taller near ones: from eye height, a
sign 10 m up reflects ~6 × the ground point's distance along the ray). No rain was seen in the
reflections. What SSR can't do that `wet.ts` does: stretch a reflection into a streak along the
view (its blur is round), and reflect what's off screen. So: set `reflections: { strength: 1 }`,
let the puddles go under 0.1 roughness (mirror) and the wet asphalt 0.15–0.3 (blurred), keep the
tile, the shutters and the glass out of range as now, and keep `wet.ts`'s streaks for the asphalt
if they still read better. Cost: on this GPU the reflection pass at these defaults wasn't
measurably over the frame without it (at 2× the pixels, about 1 ms full resolution, nothing
measurable at half); the other agents' GPU load makes finer numbers unreliable.

### `textured(set, { ao })`: the packed map's occlusion

```ts
surface: textured('brick_wall_005', { ao: 1 })
```

Default: none (as before). The render team's `FragmentMesh` takes a surface's `aoMap` on pieces'
own faces (`render.md`); this sets the set's `_arm` map as it, at strength `ao`. Off by
default because it changes every textured world's look; checked on a brick box beside one
without: darker joints, nothing else. `repeat()` clones it with the other maps.

### For scripted checks

`demo.rt` (what the hooks get) and `demo.pipeline` (the post-processing: `demo.pipeline.render()`
draws a frame) are on the `demo` object.

### Particles against glass (request 11)

`render.md`: glass now writes depth (`FragmentMesh`), which fixed dust over windows;
"No change in `effects.ts` was needed." None made.

## What a world must change

Nothing to keep working and looking as it did; but note:

- **Brick Street and Dust Town**: their `sky.environment`, `look.hemisphere` (Brick Street) and
  `look.fill` were set by the runtime team (above). Keep them when editing those blocks: without
  the fill, Brick Street's start view is 28 % brighter and its view toward the sun 43 % darker.
- **Harbor Yard**: nothing. Walking off the quay into the water and back works without `walkable`
  (the deck's body is the ground, left to `groundAt`); `walkable` is there to keep the player out of
  the water altogether.
- **Market Town**: its round towers' colliders are walked into now, 1.35 m out on the diagonals
  (above); a closer hull fixes it.
- Nobody had used `look.dust` (now `look.dustPalette`).

To adopt the rest:

- **Dust Town**: `sky: { …, elevation: (65 * Math.PI) / 180, backgroundHdri:
  '/packs/western/hdri/qwantani_noon_puresky_1k.hdr' }` and drop `NOON` and `backdrop()` from
  `scenery.ts` (its background glow is opposite the light until then; `look.fill` sets its own
  direction, so it stays where it is); `look.haze`; the tin's `metalness: 1` can go.
- **Market Town**: `look.smoke` and `dustAmount` instead of `thinned` in `update()`; `onStart` for
  the birds and the market; `sky.elevation` for a lower sun; `look.dustPalette` if its dust colours
  should be its real ones.
- **Sun Temple**: remove `state.warm` from `update()`; `look.smoke` (white, shorter); `far` for the
  hills; the cicadas in `audio.ambience` and `rt.ambience` to hush them.
- **Harbor Yard**: remove `state.warm`'s effects (keep its fires' puff); `walkable` for the quay
  edge if the water should be out of bounds; `look.dustPalette` greys and `dustAmount` for steel;
  `puff()` for the tank smoke if `fire.ts`'s own isn't wanted.
- **Neon Alley**: `onStart` instead of `s.subscribed`; `puff()` for the vents; `look.dustPalette`
  cooler; try `look.reflections` (above).
- **Brick Street**: nothing.

## For docs/making-a-world.md (its owner)

That guide still describes the contract as it was. What to add, ready to paste into "The definition":

- `sky`: also `elevation` (the sun light's height, radians; default the HDRI's sun's, raised to
  about 14°) and `backgroundHdri` (another sky to show, its sun turned onto the light's azimuth).
  Try skies with `?sky=<URL-encoded JSON>`, as `?look=`.
- `look`: also `fill` (a shadowless light from the shaded side: `{ intensity, color?, azimuth?,
  elevation? }`), `smoke` (the blast's cloud: `{ color, opacity, life, scale }`), `dustPalette`
  (`{ colors, blend }`: what all dust is made of, and how far a material's own dust colour counts)
  and `haze` (heat shimmer: `{ strength, from, height }`). `reflections` now run at half resolution
  by default, with rays to 100 m (`{ strength, distance, thickness, quality, resolution }`); "about
  2 ms" no longer holds: at the defaults the pass wasn't measurable over the frame here.
- `scenery()`: its fixed bodies that stand above `groundAt` are walls and floors to the player
  (and every fixed body stops rockets). Make colliders follow what's drawn. Bodies that are the
  ground itself (each corner within 5 cm of `groundAt` or under it) are left to `groundAt`. Make
  every light the world will use here or in `build()`, at intensity 0 until wanted: a light added
  later recompiles every lit material (over half a second).
- `walkable(x, z)` (where the player may walk), `far` (the camera's far plane, default 600 m),
  `destruction` (the Destruction's options: `shatterSpeed`, `heavy`, `maxLoose`, …), `dustAmount`
  (how much dust a material raises, times 1).
- `onStart(rt)`: once, when built and the sounds have loaded (subscribe to events, start loops);
  `rt.ambience` has the ambience loops by name. The effects also have `puff(at, { color, rise,
  size, life, opacity, velocity })` (steam, chimney or fire smoke in its own colour).
