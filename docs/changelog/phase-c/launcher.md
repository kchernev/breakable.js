# Launcher: what changed

The launcher team's changes in this phase: the first-person launcher and its rockets
(`src/demo/launcher.ts`), where `main.ts` makes and wires it (the import, `loadKit()` next to the
props' loading, `new Launcher(…)`, and the footfall lines after `new DemoAudio(…)`), and a new
asset pack, the kit: `scripts/assets/packs/kit/` (the list and the Blender script),
`assets-src/packs/kit/` (raw takes, previews, ledger) and `public/packs/kit/` (models, credits).
Tests: `tests/launcher.test.ts` (no GPU: `tests/fake-world.ts` for the pieces a rocket hits,
`Solids` for the scenery, a stand-in for the effects, and a kit with `index.json`'s numbers).
After review: rockets come down where the crosshair is at any range, they stop on the scenery
(`solids`), the idle muzzle flash no longer cuts a patch out of Harbor's reflections, and the
launcher model is mirrored so its sight is on the left as described.

No world has to change anything, and no world had worked around the launcher (nothing in
`src/demo/worlds/` touches it), so there is nothing to adopt: every world gets the new launcher as
it is. The hooks worlds and the demo use are kept: `onBlast` (`Blast`: `at`, `normal`, `rocket`),
`onLaunch(rocket, fired)`, `onTrail(at, velocity)`, `fire()`, `fireFrom(from, to)` (`demo.shoot`),
`update(dt, moving)`, `view`, and `groundAt` (the constructor's `ground`). One new option,
`solids`; main.ts passes it, so every world gets it without changing anything.

## What every world sees differently (defaults)

- **The launcher is a real model.** A made-up shoulder-fired launcher (an olive-drab tube with worn
  paint, a flared back, a ribbed muzzle collar, pistol and front grips, an optical sight on the
  left, the shooter's side) with the warhead of a made-up rocket (olive, a pale yellow band, three
  fins) standing out of its muzzle.
  It replaces the dark blue tube with the green tip. Without the kit (it fails to load) the old
  drawn tube is used, with a warning in the console.
- **Smaller, lower right.** It comes in from the lower right corner, its muzzle right of and below
  the crosshair (about 62 % across and 65 % down), and covers less than a quarter of the view. The
  model is drawn at 0.55 of its size: at full size the near end of the tube, a hand's breadth from
  the eye, filled half the view.
- **Lit by the world.** It's drawn with the scene: the sun (and its shadows: in a building's shadow
  it's in shade), the sky's environment light and reflections, the hemisphere light, the point
  lights and the blast flashes. It has a baked ambient occlusion map instead of the screen-space AO
  (which doesn't reach it, see below). It looks olive at noon, warm at golden hour, grey under the
  harbour's overcast, dark with coloured highlights in Neon Alley's night.
- **It never goes through a wall.** Its depth is squeezed into the front tenth of the depth buffer,
  so it's drawn over anything further than ~5.5 cm from the eye, and still in its own order. It's on
  layer 2 (`VIEW_LAYER`), which the player's camera now sees: the AO pre-pass (main.ts's
  `solidCamera`, layer 0) leaves it out, so it casts no AO halo on the wall behind it. With
  reflections on (Harbor Yard) it writes `shine` 0: it reflects nothing.
- **It moves.** A slow sway (breathing), a dip with each footfall and landing (in step with the
  footsteps: the lowest point ~60 ms after each), a little lower while walking, a lag behind the view
  as it turns, a kick back and up when fired with a little camera shake (`player.shake` 0.45), and a
  reload timed to the fire rate (0.75 s, unchanged): from 0.2 s (as the reload sound starts) the tube
  dips and swings in side on, the next rocket shows ahead of the muzzle at 0.34 s and slides in by
  0.6 s, and the tube is back up at 0.75 s.
- **Firing**: a muzzle flash (a star and a plume of flame, 0.07 s, and a light with a few sparks:
  `effects.sparks(muzzle, forward, 0.12, 0xffb45a)`), and a back-blast behind the shoulder (a jet of
  smoke, `effects.trail`, and a grey cloud 2 m back, `effects.dust(…, 0.3, 0x8f8c87)`). The flash's
  light is one of the effects' three flash lights, taken for its fade (as a blast's or a spark's).
- **Rockets** (the player's and scripted ones, `demo.shoot`): the rocket model, spinning slowly, with
  a white-hot flame at the nozzle. It leaves the tube at 20 m/s and coasts for 0.08 s (about 1.6 m:
  you see it leave the tube, and no smoke fills your face), then its motor lights (flame, trail,
  `onTrail`) and it speeds up at 160 m/s² along its aim to the old 48 m/s. It arrives about 0.1 s
  later than before over any distance past ~8 m. Same 6 s limit, same sounds. A fired rocket starts
  at the view model's size and grows to full size over its first 0.2 s (unseen).
- **Rockets come down where they're aimed.** A rocket's path is now worked out from its age: along
  its aim as far as its speed has taken it, and below that by its drop (1.5 m/s², as before), so
  it's the same at any frame rate. It's aimed above its target by as much as it will have dropped
  by then (`launch()`: the flight time from the speeds above, a few rounds to settle it), so it
  comes down on the target, its path rising above the straight line by at most ~0.3 m over 60 m,
  ~0.8 m over 100 m. Before, it aimed straight at the target and fell short by its drop: on a wall
  30 m off it hit 0.3 m low before this phase and 0.5 m low in this change's first version (its
  speed-up scaled the fall too), and ground shots at 50 m landed 18–19 m short. Now within a
  centimetre at 5 to 120 m on walls, the ground and a slope (the tests allow 5 and 10 cm, at 30, 60
  and 144 fps), and 0.00 m off the crosshair point in Dust Town, Harbor Yard and Sun Temple (in the
  browser: ground shots at 12 to 70 m and the start views). `fireFrom` (`demo.shoot`) too: it goes
  off at the point given, unless something is in the way.
- **`onTrail(at, velocity)`**: `at` is now the rocket's nozzle (it was its middle), and it's called
  only once the motor has lit. `velocity` is the rocket's (its speed along the aim plus its fall).
- **What it's aimed at**: the first of a standing piece, the scenery (`solids`) or the ground
  (`groundAt`) along the view, within 300 m; with none, a point 200 m along the view. Before, only
  pieces: a shot at the open ground aimed at a point 200 m along the view (under the ground), and
  one at a town wall aimed at whatever was behind it.
- **The scenery stops rockets** (every world: main.ts passes its `solids`). Medieval's town walls
  and towers, Dust Town's corral, Sun Temple's rock, every world's ground body: a rocket goes off on
  them, as on a piece (`onBlast` with the point and the face's normal). Before, rockets flew through
  them. The fixed bodies are where they are drawn, and none of the six worlds has an invisible one in
  the air, so nothing new stops a rocket mid-air.
- **Up against a wall**: when a piece or the scenery is between the eye and the muzzle, the rocket
  goes off there at once (`onLaunch`, then `onBlast` with that point). Before, it started inside the
  wall and flew through it.
- **First shot**: the rocket's and the flash's shaders are made while the world loads (a speck of a
  rocket at the muzzle and the flash drawn black for the first half second of frames), so the first
  shot doesn't stall (it took 55–100 ms frames before this was done; now none over the frames
  around it).
- **The flash is drawn only while it shows** (0.07 s a shot), and during that warm-up. Drawn black
  all the time, as at first, it wrote the beauty pass's other outputs (`shine`, `normal`: MRT outputs
  other than `output` aren't blended), and with reflections on (Harbor Yard) the wet ground around
  the muzzle lost its reflections. Idle frames are now the same with or without the flash.
- **Cost**: the view model is 15,839 + 3,959 triangles and one draw each, plus three flash quads.
  Measured at the start of Brick Street, frame times with it shown and hidden were the same within
  noise (55.5 / 50.8 / 55.0 / 51.3 fps alternating, the GPU shared).

## New

### `loadKit(base?)`: the launcher's and the rocket's models

```ts
import { Launcher, loadKit } from './launcher.ts';
const kit = await loadKit(); // '/packs/kit/models/': index.json, launcher.glb, rocket.glb
```

Resolves to a `Kit`; rejects if `index.json` or a model can't be loaded (main.ts warns and uses the
drawn tube). A `Kit` can also be made by hand (that's what the drawn one is):

```ts
interface Kit {
  launcher: THREE.Object3D; // tube along -Z, +Y up, metres, origin on the axis where it's held
  rocket: THREE.Object3D;   // nose along -Z, origin on its axis halfway along
  muzzle: V3;               // the tube's axis at the muzzle and the rear end (launcher's frame)
  rear: V3;
  length: number;           // the rocket's length
}
```

### `new Launcher(scene, camera, destruction, ground, options?)`

The fifth argument is new; without it the launcher works as before but with the drawn tube, no
muzzle-flash light, no back-blast, no camera shake, and rockets that fly through the scenery.

```ts
const launcher = new Launcher(scene, camera, destruction, def.groundAt, {
  kit: await kitLoading, // default: the drawn tube and rocket
  effects,               // the muzzle flash's light and sparks, the back-blast (default none)
  player,                // shaken a little by each shot (default none)
  solids,                // the scenery's fixed bodies: aimed at, and rockets go off on them (default none)
});
```

`effects` needs only `sparks`, `trail` and `dust` (the demo's `Effects`); `player` only `shake`;
`solids` only `raycast(origin, dir, max)` → `{ point, normal, distance } | null` (main.ts's
`Solids`, the one the player walks against: `new Solids(world.bodies.filter((b) => b.fixed))`,
made before the pieces). A ray that starts inside one of them ignores them all, as the player's do
(`Solids.raycast` reports the body it starts in at distance 0).

### `launcher.footfall(speed)`

A foot came down (or the player landed) at `speed` m/s: the view model dips with it, swaying to
one side then the other. main.ts calls it from the player's `onStep` and `onLand`, after the sounds
that were there:

```ts
const footstep = player.onStep;
player.onStep = (on, speed) => (footstep(on, speed), launcher.footfall(speed));
```

### `VIEW_LAYER` (2)

The view model's layer. The launcher enables it on the camera it's given. A pass that should leave
the view model out (an AO or depth pre-pass) renders with a camera that doesn't see layer 2, as
main.ts's `solidCamera` (layer 0 only) already does. Anything else a world puts on layer 2 is drawn
by the player's camera as usual.

## For the runtime team (main.ts)

- The view model relies on two things in main.ts staying as they are, or being kept in step:
  the AO pre-pass camera seeing only layer 0, and the reflections pass's MRT output being named
  `shine` (the view model writes `shine: (0, 1)` so it doesn't reflect; with no such output the name
  is ignored).
- Its materials (`ViewMaterial`) leave the pass's screen-space AO out
  (`setupAmbientOcclusion` without the context's `getAO`) and use their own baked AO map.
- One edit after review: `new Launcher(…, { kit, effects, player, solids })` passes the `solids`
  main.ts already made for the player.

## The assets (PACK=kit)

- `scripts/assets/packs/kit/props.mjs`: `launcher` and `rocket` (GPT Image 2.5 concepts, two takes
  each, `pick`ed; Tripo P2, `generator = 'tripo'`).
- `scripts/assets/packs/kit/view-models.py` (Blender, instead of `process-props.py`): weld,
  decimate, lay the tube's axis (circles fitted to its two ends) or the rocket's along -Z, origin on
  the axis (at the pistol grip, found as the rear of the two lumps under the tube; halfway along for
  the rocket), scale, bake AO into the occlusion channel of the occlusion/roughness/metalness map and
  export it, WebP textures (2048 / 1024), previews in `assets-src/packs/kit/props/previews/`, and
  `public/packs/kit/models/index.json` (files, sizes, triangles, the muzzle and the rear).
  A prop with `mirror: true` is mirrored left to right after it's squared up (its faces turned back
  out, its UVs and maps unchanged). The launcher has it: its prompt said the muzzle points right
  and it's seen from its left side, which can't both be, and the concept (and so Tripo's model)
  showed its right side with the sight drawn on it. Mirrored, the sight is on the left, the
  shooter's side, as described. The prompt now says the muzzle points left, for any new take (which
  would then need no mirror, and likely `yaw: 180`); the takes on disk were made with the old
  wording (their `concept<i>.json` has it). Rebuilt with no paid call; `index.json`'s numbers are
  unchanged (the axis is on x = 0). The rocket has three fins (the prompt asked for four).
- Rebuild: `PACK=kit FAL_KEY=… node scripts/assets/generate-props.mjs concept --takes 2`, then
  `… 3d`, then `PACK=kit ~/.local/bin/blender -b --factory-startup --python
  scripts/assets/packs/kit/view-models.py`.
- Paid calls (`assets-src/packs/kit/ledger.jsonl`): 4 GPT Image 2.5 images ($0.041 each) and 2
  Tripo P2 models ($1.20 each), $2.56 in all; within the budget of 6 images and 3 models.
- Credits: `public/packs/kit/CREDITS.md`.

## Not done

- No hands or arms: the reload is the tube dipping and a rocket sliding into the muzzle on its own.
- The flash and back-blast use the effects as they are (`sparks`, `trail`, `dust`); a dedicated
  muzzle-flash or back-blast emitter in `effects.ts` (the runtime team's) would allow a denser,
  longer back-blast cone.
- During the flash itself (0.07 s) its quads still write `shine` and `normal`, so the reflections
  around the muzzle drop out for those few frames, under the flash. Blending those outputs
  additively (`MRTNode.setBlendMode`) would need the launcher to know main.ts's output names.
