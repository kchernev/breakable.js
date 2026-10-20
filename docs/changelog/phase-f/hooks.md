# Hooks: the worlds hear the gun, and the shared demo fixes

The hooks team's changes in this phase: four new hooks in the world contract (`onShot`, `onBurst`,
`water`, `pitSide`), a bullet into a crater striking what the ground is made of there, and four
fixes the last checks found (a blank screen from `repeat()`, chips floating over the road, the
gun's shots dropped under heavy fire, the side of a pit struck as the rim's top).

Files: `src/demo/worlds/types.ts` (the hooks), `src/demo/main.ts` (wired), `src/demo/gun.ts` (the
burst's report, a pit's floor and sides), `src/demo/weapons.ts` (`gunHooks`, `waterOf`),
`src/demo/textures.ts` (`repeat()`), `src/demo/effects.ts` (where chips land: `impact()`'s floor,
and the options' `floor`), `src/demo/audio.ts` (the echo takes the burst; the strikes outweigh the
rubble for a voice), `src/lib/audio.ts` (voices kept for the player's own sounds), tests
`tests/weapons.test.ts`, `tests/effects.test.ts`, `tests/audio.test.ts` and
`tests/textures.test.ts` (new).

**Two worlds have one line to add** (below: Brick Street and Harbor Yard draw a pit's side as
concrete where the gun now strikes it as the ground's layers). Otherwise every world loads, looks
and plays as before; what's new is there for each world to use. The gun is as the user asked: 14
rounds a second at power 6, no reload, and no world's materials made tougher.

## For the world teams: the gun's hooks

Until now a world heard the gun only through what its rounds broke (`'fracture'`, `'collapse'`,
...): its reactions to rockets (`onBlast`) never happened for the gun. Now:

- `onShot(hit, rt)`: each bullet that strikes something (a piece, the scenery or the ground; not
  the sky or the water), after the strike's chips, mark and sound. `hit` is the gun's `BulletHit`
  (`src/demo/gun.ts`): `at`, `normal`, `direction`, `distance`, `piece` (null: the scenery or the
  ground), `material` (the piece's; down in a crater through a breakable ground, what the ground is
  made of there, below; null for the scenery and the world's own ground), `kind` (`MaterialKind`:
  brick, concrete, metal, wood, glass, dirt) and `broke` (the piece gave way). Up to 14 a second
  while the trigger is held: keep it light, and don't play a sound on every one.
- `onBurst(burst, rt)`: once a burst ends (the trigger let go, or the gun put away), after the
  gun's echo. `burst` is `{ rounds, at, seconds }`: the rounds fired, where most of them struck
  (the median of the strikes, each axis apart, so a stray round or two into the distance don't move
  it; null when none struck anything: all into the sky or the water), and how long it lasted, from
  the first round until the trigger was let go (28 rounds: 1.92 s). For the noise of the gun: a
  hush, birds taking off, a siren after a long one.
- `water(x, z)`: where the ground is water. Bullets go into it (nothing seen or heard, no
  `onShot`), and a blast within a metre over it (`groundAt` there is taken as the water's surface)
  leaves no scorch. Without it the demo guesses as before: where `walkable` says no and `groundAt` is
  under -0.5 m (Harbor Yard's harbour). Sun Temple's sea, a fountain or a river can say so now.
- `pitSide(at, ground)`: what the side of a pit through a breakable ground is where a bullet
  strikes it (below). A material name; `null` for the scenery's own stone (a hole, as on any wall);
  nothing (`undefined`, the default) for the ground's layer at that height.

An example (the names of the world's own sounds and helpers are made up):

```ts
// worlds/<id>/index.ts
/** When the street went quiet for the gun (rt.time; Infinity: it isn't quiet). */
let hushed = Infinity;

const world: WorldDefinition = {
  // ...
  // The fountain's basin: bullets go into it, blasts leave no soot on it
  water: (x, z) => Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.radius,
  onShot(hit, rt) {
    // A parked car shot (a metal prop): its alarm, as wreckage landing on it sets it off
    if (hit.piece?.prop && hit.kind === 'metal') carAlarm(hit.at, rt);
    // A round into a sign's box: a spray of sparks (its own sound, now and then)
    if (hit.material === 'signbox') {
      rt.effects.sparks(hit.at, hit.normal, 0.4, 0x9fd8ff);
      if (Math.random() < 0.3) rt.sound.play('spark.zap', { at: hit.at });
    }
  },
  onBurst(burst, rt) {
    // A long burst hushes the street as a blast does; pigeons go up from round where it struck
    if (burst.seconds < 1.5) return;
    rt.ambience.get('ambience.city')?.setVolume(0.25, 0.4);
    hushed = rt.time;
    if (burst.at) rt.sound.play('pigeons.flap', { at: [burst.at[0], burst.at[1] + 4, burst.at[2]], delay: 0.4 });
  },
  update(dt, rt) {
    // The street comes back a while after the gun stops
    if (rt.time - hushed < 8) return;
    rt.ambience.get('ambience.city')?.setVolume(1, 10);
    hushed = Infinity;
  },
};
```

What's worth knowing:

- `onShot` comes for the bullet's strike, not for what it broke: a round that cuts a piece also
  sends the library's events (`'fracture'`, `'dust'`, `'debris'`, `'collapse'`), as a blast does.
  Reactions that answer a break (a pane's alarm, a neon sign's sparks) are best left on those, so a
  rocket and a burst both set them off; `onShot` is for what a round does without breaking
  anything (a car's alarm, a bell's ring, a ricochet's spark off a pipe) or for counting rounds.
- `hit.piece?.prop` is the prop's model when a prop was struck (props never break; light ones are
  pushed). `hit.piece?.state` says whether it was standing, rubble or loose.
- A burst of one round is a burst: tapping the trigger calls `onBurst` each time. Weigh by
  `rounds` or `seconds`. A world that wants "the gun has been going for a while" while it's still
  held can count `onShot`s itself, against `rt.time`.
- Both are `WorldDefinition` methods, so `this` is the definition, as for `onBlast`.

## A crater's floor and sides (with the library's `GroundOptions.bed`)

Market Town and Neon Alley reported that a bullet into a crater's floor struck as the ground's
lowest layer whatever the floor was drawn as, and that the side of a pit against the scenery struck
as the scenery's stone. Now, in the gun's trace (`pitAt` in `gun.ts`):

- **The floor** (the bed, below the layers) strikes as the ground's bed: `GroundOptions.bed`, a
  material name (the library team's, this phase; default `under`, else `material`), kept as
  `ground.bedMaterial` (`ground.bed` is still the bed's height). Its kind, chips, dust, mark and
  sound are that material's, and `hit.material` names it. Give a world's bed the material it's drawn
  as: Neon Alley's floor is drawn as wet earth but its lowest layer is the concrete `base`.
- **The sides**, where the ground meets the scenery (a fixed body hit inside the ground's area or
  within 5 cm of its edge, below its top), strike as what the world's `pitSide` says, else as the
  layer at that height: the top layer down to its slabs' bottom (as laid), the one under it below
  that. The scenery's face above the ground's top is the scenery's stone, as before. The bed doesn't
  cover the sides (`GroundOptions.bed` is the floor only; the library's comment says so now).

  The layers are right where a world draws its pit sides as the layers: Market Town's square, Neon
  Alley's street, Harbor Yard's deck edges (concrete over gravel). They are wrong in two places,
  drawn as concrete from the bed up, where the gun can't tell (the physics has only a box there):
  - **Brick Street**: the sidewalks' side at the facades is the buildings' footing
    (`nyc/scenery.ts`, `concrete_wall_008`). Without the hook it strikes as paving, and under the
    paving as earth: a brown pock and clods on a concrete wall. In `nyc/index.ts`:

    ```ts
    // The pit's side along the facades is the buildings' concrete footing, not the sidewalk's layers
    pitSide: (at) => (Math.abs(at[2]) >= STREET.front - 0.05 ? null : undefined),
    ```
  - **Harbor Yard**: the crane rails' beams are concrete from the bed up (`harbor/scenery.ts`, the
    rail beams' sides and ends). Without the hook they strike as slab, then gravel. In
    `harbor/index.ts` (`BEAMS` imported from `./ground.ts` with `APRON`):

    ```ts
    // The crane rails' beams are concrete from the bed up, not the apron's layers
    pitSide: (at) => (at[0] > BEAMS.x0 - 0.05 && at[0] < BEAMS.x1 + 0.05 && BEAMS.rails.some((z) => Math.abs(at[2] - z) <= BEAMS.half + 0.05) ? null : undefined),
    ```

  Both checked in the page with the hook set there (`fix-pitside.mjs`, below): every strike on the
  footing and the beam then is the scenery's stone, a hole, and the floor beside them is still the
  bed.
- **The view down into a pit.** `groundAt` steps up where the area ends (the bed inside, the top
  outside), and the gun's search along the ground found that step before the scenery's face when
  looking down into a pit from above: the strike was drawn on the rim's top, not on the side. The
  ground is now searched only up to 2 cm short of the scenery the bullet meets, so the face is
  struck. Elsewhere nothing changes: where the scenery is the ground body itself (its top at
  `groundAt`), it was and is struck as the ground.
- The world's own ground (`groundKind`: dirt where the steps say dirt, else stone) is as before.

Checked: Market Town's square, a pit opened at its east edge (x 14.65): the side 12 cm down
`cobbles:concrete`, 68 cm down `earth:dirt`, the floor `earth:dirt`, the side from over the far rim
`cobbles` (`out/pit-medieval-now.png`: the marks in the setts' band and the earth). Neon Alley's
south edge at x -20: `asphalt`, then `base`, the floor `base` (it sets no `bed` yet). In both, a
hole in the side, pocks in the earth.

## Fixes

- **`repeat()` (src/demo/textures.ts) left a blank screen when its maps hadn't arrived.** It clones
  the cached maps; three's `Texture.clone()` marks the copy for upload, and while the image wasn't
  there the renderer read `image.complete` off a null image every frame and threw: the page stuck at
  "Shaders…" for good (reproduced on Brick Street with the crater planes' maps held back 20 s: 1,072
  errors in the first minute, a black page, still erroring after the maps came). Now a copy made
  before its image arrived isn't marked; `texture()`'s loader marks it once the image is there (the
  copy shares the image). With the same maps held back the page loads at once, those maps show
  black until they arrive, then as they should: no errors. `tests/textures.test.ts` checks it on a
  stand-in `<img>`. Neon Alley's crater floor works round it with its own uvs
  (`neon/scenery.ts`, `underStreet`); it can use `repeat()` again if it likes.
- **Chips from debris that isn't ground floated.** `sprayDebris` (main.ts) gave `effects.impact`
  no floor, so a spray's chips landed on the effects' ground at y 0: 15 cm over Brick Street's
  asphalt, in the air over a crater, through a floor. `impact(at, normal, color, floor?)` now takes
  one, and every debris spray lands on what's under where its piece was (`floorUnder`: the first
  piece down, or `groundAt`), as bullet strikes already did. Brick Street, a crater and a front
  brought down into the street: every spray over the road landed on the asphalt (-0.15) or the
  rubble on it, the others on sills, floors and the sidewalk under them (`chips.mjs`; a terracotta
  pot shot apart on the road: `out/chips2-pair.png`, its chips on the asphalt). `floorUnder` looks
  down only as far as `groundAt` now (it looked 50 m). Its raycasts cost about 14 µs each: through
  Brick Street's four-blast collapse, all of the destruction's raycasts (these, the player's
  footing, the steps) took 0.1 ms a frame (median), 0.8 ms at most.

  The worlds' own `impact` calls (Market Town's and Dust Town's iron sparks, Harbor Yard's,
  Sun Temple's and Brick Street's sprays) gave no floor either, and a world had no way to find one.
  Now the effects find it themselves: `EffectsOptions.floor(from)` is what a bit falling from a point
  lands on, and `impact()` and `bullet()` not given a floor, and `sparks()` (a sign's, a
  transformer's: they fly up to a second), ask it from just off the surface (5 cm out along the
  normal and 5 cm up, so not the wall or the beam struck). The demo gives it
  `floorUnder`, so the worlds' calls land right as they are; the gun's strikes use the same default
  (main.ts no longer works it out), the debris sprays still pass theirs. Brick Street, a crater
  blown in the road, `rt.effects.impact(at, [0, 1, 0], ...)` as the worlds call it
  (`fix-floor.mjs`): sparks over the road land at -0.15, on the sidewalk at 0, 0.4 m over the
  crater's floor on it (-0.74 to -0.76 in two runs), off a wall face over the crater on what's
  under it, and `sparks()` 3 m over the crater on its floor (-0.66); all of them at y 0 before.
- **The gun's shots dropped under heavy fire** (Neon Alley: `gun.shot` dropped at the cap of 40
  while its loops held 7). Two things dropped them, and both are fixed in the engine
  (`src/lib/audio.ts`), for every sound in the listener's head (not placed in the world: the
  player's own, the gun, the launcher, steps, and the ambience bed):
  - **Voices kept for them.** `SoundEngineOptions.reserve` (default 8): sounds in the head may take
    8 voices past `maxVoices`; sounds placed in the world never take theirs (they give way to each
    other only); and with those taken too, a sound in the head takes the least heard of the world's,
    however loud. A shot at half its pack level (0.15, its voice's weight 0.09 with its priority of
    0.6) is quieter at the ears than most bullet strikes within 6 m (0.13-0.37), so with 40
    voices taken it lost the steal to them. The head's voices count toward the 40 too (a world
    sound plays while fewer than 40 are taken in all), so the world doesn't keep 40 of its own:
    with 8 loops and 4 shots going it has 28, and the 8 past 40 are used only once it holds the
    rest. The option's comment said it as though the world kept all 40; it says this now.
  - **Never masked.** The engine drops a one-shot more than 30 dB under the loudest sound of the
    last moment (`window`: the bricks under a blast). A blast 6 m off masked the next two shots,
    every time. Sounds in the head are now always played; the blast's own dulling (`deafen`) still
    muffles everything for a moment, as it should.

  Neon Alley, 20 s of the trigger held into the shop fronts 5 m off, the view sweeping, a blast 6 m
  off every 5 s, the sound running (muted Chrome): with the reserve alone 274-276 of 280 shots played
  (each drop right after a blast, masked); with both, 277 of 277, the voices at 40-41 with 8 loops;
  held 30 s with six blasts, 421 of 421.
  `tests/audio.test.ts` checks the reserve, the steal and the masking.
- **The bullets' strikes dropped under heavy fire.** In the 28 voices left to the world, the
  strikes fought the rubble, the debris and the blasts' tails for a voice at the same weight, and
  lost a third of the time: in Neon Alley the strikes of a held trigger came and went. Now
  `bullet.brick`, `.concrete`, `.metal`, `.wood`, `.glass` and `.dirt` play at priority 2 here
  (`WEAPONS` in `src/demo/audio.ts`, as the shot has its own): what the player shoots at is what
  they listen for, so a strike takes the voice of a quieter sound of the world's. Every world's
  materials use those six. Neon Alley, the run above (20 s held, four blasts), the engine's admit
  instrumented (`fix-reasons.mjs`): strikes heard 274, 273 and 269 of about 290, 9-15 dropped for
  want of a voice; at priority 1 in the same page, 178 and 151 heard, 109 and 128 dropped. The
  world's other sounds lost little to them: 540 played against 560 and 561. Brick Street at the
  same time: 285 heard, 4 dropped. Every shot played (281-284), none cut short by another sound;
  the voices peaked at 40. (A strike also weighs twice for masking: under fire, sounds of the
  world's under -33 dB at the ears, not -39, go unheard.)

## Checked

On display :101, the dev server on 5331 (it served every edited file: checked with curl), the GPU
shared with other agents (the machine at a load of 9-73; frame rates in the screenshots are not
measurements). Scripts and screenshots:
`scratch/phase-f/hooks/`
(`lib.mjs`, `worlds.mjs`, `slowtex.mjs`, `pit.mjs`, `voices.mjs`, `chips.mjs`, `chips2.mjs`,
`raycost.mjs`, `water.mjs`; `out/`).

- **Every world** (`worlds.mjs`): loads with no errors or warnings, nothing loose 10 s after load
  but Dust Town's four movers, looks as before (`out/sheet-start.png`). 28 rounds where the start
  view looks: `onShot` once a strike, after its sound, with the runtime; `onBurst` once,
  `{ rounds: 28, at: the middle of the strikes, seconds: 1.91-1.97 }` (Harbor Yard's start view
  looks over the water: none struck, `at: null`); every `gun.shot` asked for played.
- **Harbor Yard's water** (`water.mjs`, no `water` hook: the guess): 14 rounds into the harbour,
  no strikes; a blast on the water, no scorch; one on the quay, a scorch.
- Typecheck clean; `npm test`: 216 tests, all passing (in one full run with the machine at a load
  of 73, the timing tests `tests/hull.test.ts`' hull of 200 points under 15 ms and
  `tests/collapse.test.ts`' resting checks in 2 ms a frame failed, and passed alone, as before).

After the review (same display, same server; curl showed 5331 serving the edited `gun.ts`,
`main.ts`, `effects.ts` and `audio.ts`; the edits to `types.ts` and to `src/lib/audio.ts` are
types and comments only, which Vite drops). Scripts `fix-pitside.mjs` (from the reviewer's
`pitside.mjs`), `fix-reasons.mjs` (from `reasons2.mjs`), `fix-floor.mjs`, and `worlds.mjs` and
`pit.mjs` again:

- **Pit sides** (`fix-pitside.mjs`, slabs taken out by the facade or the beam, `gun.trace` and 8
  real rounds from above). Brick Street with its line set in the page: the footing 8 cm, 70 cm and
  1.2 m down `null:concrete`, all 8 rounds `null:concrete` (a dark hole on the footing:
  `out/fix-pitside-nyc-hook-crop.png`; without it `paving`, `earth`, `earth`, a brown pock:
  `out/fix-pitside-nyc-none-crop.png`), the floor `earth:dirt`. Harbor Yard with its line: the
  beam's side 10 cm and 50 cm down and all 8 rounds `null:concrete`, the floor beside it
  `gravel:dirt` (without it `slab`, then `gravel`). Market Town, no hook (`pit.mjs`): the side
  `cobbles` 12 cm down, `earth` below, the floor `earth`, from over the rim `cobbles`, as before.
- **Every world** (`worlds.mjs`): loads with no errors or warnings, 28 rounds from the start view,
  `onShot` once a strike after its sound, `onBurst` once (1.92-1.95 s; Harbor Yard's `at: null`),
  as before (`out/sheet-fix-fired.png`).
- Typecheck clean; `npm test`: 217 tests, all passing (in one earlier full run the timing test
  `hulls of many points scale` failed at a load of 5, and passed alone). New checks: the world's `pitSide` (null, a
  material, nothing; not asked of the floor) in `tests/weapons.test.ts`, and chips not given a
  floor landing on the options' floor, asked from just off the surface, in `tests/effects.test.ts`.
  `npx vite build` to scratch: works.

## For `docs/making-a-world.md` (its owner's to change)

- The definition: `water(x, z)` beside `walkable` (and the water sentence under `walkable` points to
  it).
- Reactions: `onShot(hit, rt)` and `onBurst(burst, rt)` beside `onBlast`; the paragraph that says
  "Bullets don't call `onBlast`, and there's no hook for them yet" is out of date.
- Breakable ground, "Steps and strikes": a bullet into a crater's bed strikes the ground's bed
  (`GroundOptions.bed`, default the lowest layer), and its sides against the scenery the layer at
  that height, unless the world's `pitSide(at, ground)` says otherwise (a material; null: the
  scenery's stone). Set it wherever a pit's side is drawn as something other than the layers: a
  building's footing, a beam, a kerb.
- The effects (the list that has `impact(at, normal, color)`): `impact(at, normal, color, floor?)`. Its chips land on `floor`, else on what's
  under them (the demo's `floorUnder`, asked from just off the surface), so a world's sparks or
  spray over a crater or a raised floor needs no floor of its own; `bullet()` and `sparks()` the
  same.
- Sound: sounds in the listener's head (the player's own) have voices kept for them (`reserve`,
  past `maxVoices`: the head's voices count toward that too) and are never masked by a louder
  sound a moment before. The gun's strikes play at priority 2.

## Still open

- No world uses the hooks yet (the world teams' work this phase).
- **Brick Street and Harbor Yard: set `pitSide`** (the lines above, in `nyc/index.ts` and
  `harbor/index.ts`: the world teams' files). Until they do, a round into the facades' footing or
  a crane rail's beam down in a pit strikes as the ground's layers (a pock in earth on concrete);
  before this phase it struck as the scenery's stone, so this is a step back there until then.
- Neon Alley's crater floor is drawn as earth but strikes as its concrete `base` until it sets
  `bed`.
- Chips are given the floor under where they start; one thrown a couple of metres over a crater's
  rim lands at that height in the air beside it (as bullet strikes' chips do). The puffs of powder
  still rest on the effects' ground at y 0.
