# Developing

Running, checking and publishing the demo, and where everything is. Back to the [README](../README.md).

## Running it

```sh
pnpm install
pnpm dev          # the dev server (leave it running): http://127.0.0.1:5330 (demo), /lab.html (small test structures), /fx-lab.html (effects), /sounds.html (the sound packs)
pnpm test         # geometry, structure, ground, bullets, the piece budget, weapons, sound and runtime tests (CPU, no GPU needed)
pnpm typecheck
pnpm build
```

Needs WebGPU. On **Linux with NVIDIA**, Chrome needs it switched on, and Dawn's per-call check of
indirect dispatches costs ~0.5 ms each there (the solver makes ~90 a step). Without the flags the
page says WebGPU is off. `pnpm chrome` (or `pnpm chrome neon` for a world) opens the demo in a
Chrome of its own profile with them, leaving your usual Chrome as it is. It only opens the page,
so start `pnpm dev` first, in another terminal, and keep it running; if Chrome says
"127.0.0.1 refused to connect", the server isn't running. It does the same as:

```sh
google-chrome --user-data-dir=~/.cache/breakable-chrome --enable-unsafe-webgpu --enable-features=Vulkan \
  --use-angle=vulkan --ignore-gpu-blocklist --ozone-platform=x11 --enable-dawn-features=skip_validation \
  http://127.0.0.1:5330
```

(`skip_validation` is a development flag: use that profile only for the demo. Without it the
physics runs at ~25 fps on that platform. macOS and Windows don't need any of this.)

The demo is also published on GitHub Pages (`.github/workflows/pages.yml`: built on every push to
`master`, at `https://<user>.github.io/<repo>/`, once the repo is public; turn it on once in the
repo's Settings > Pages, Source "GitHub Actions"). `URL=https://<user>.github.io/<repo>/ pnpm chrome` opens it with the
flags above. Asset URLs in the code are relative to the page (`'packs/<id>/models/'`, no leading
slash), so the same build works there and at `/`.

Controls: mouse to look, click to fire (hold the button for the machine gun: it fires for as long
as it's held, and never needs reloading), 1 for the launcher and 2 for the machine gun (the wheel
goes round them, Q back to the last one), WASD to move (Shift runs, Space jumps), F to fly (Space
up, C or Q down), M for sound on or off, R to rebuild. In the overlay, Tab and the arrow keys go
between the worlds.

## The demo

`src/demo/` is the same for every world: the renderer (a GTAO pre-pass, bloom, and optionally
screen-space reflections, colour grading, heat haze and weather), the GPU physics, first-person
controls (walking into and onto the scenery as well as the pieces, down into a crater and out),
two weapons (`weapons.ts`: switching, the HUD): the launcher (a model lit by the world, rockets
that come down on the crosshair) and the machine gun (`gun.ts`: 14 rounds a second for as long as
the trigger is held, never reloading, its spread opening through a burst, a tracer every other
round, casings bouncing at the feet, the view climbing and settling), GPU particle effects
(`effects.ts`: fireballs, sparks, lit billowing dust and smoke, puffs of steam, chips, bullet
strikes, muzzle flashes, tracers), marks on surfaces (bullet holes, dents, pocks and blasts' soot,
which go with the piece they're on and onto its cells when it breaks), and sound (`audio.ts`).
Each world is a folder in `src/demo/worlds/<id>/`, which says what's built and of what, how it
looks (`sky.ts`: a Poly Haven HDRI turned so its sun comes from where it's wanted), how it sounds,
and how it reacts: to blasts (`onBlast`), to each bullet that strikes (`onShot`) and to each burst
of the gun as it ends (`onBurst`); its card in the picker is its `meta.ts` and
`public/thumbs/<id>.jpg`.
`worlds/registry.ts` finds the folders by itself.

`?look=<JSON>` and `?sky=<JSON>` override a world's look and sky for trying things out, e.g.
`?world=nyc&look={"weather":{"rain":1},"exposure":0.8}`.

## Layout

| Path | What |
|---|---|
| `src/lib/` | The library (its exports: `index.ts`) |
| `src/lib/destruction.ts` | Pieces, bonds, blasts, bullets (`shoot`, and their bite into a breakable ground), the weighing and collapse, letting go (`loosen`, `release`, `push`, `hinge`), rubble and the piece budget (`maxPieces`), impacts and landings, props, laying a breakable ground |
| `src/lib/bullets.ts`, `ground.ts` | How many rounds a piece takes, a bullet's push, what kind a material is; breakable ground (`Ground`, `groundPresets`, the slabs) |
| `src/lib/support.ts` | What a piece rests on: where it touches, which way each touch pushes, whether its weight is over them (resting, tipping) |
| `src/lib/convex.ts`, `fracture.ts`, `contact.ts`, `hull-shape.ts` | Convex pieces and their cuts, Voronoi fracture (with grain), the faces bonds are made of, cells as solver hulls |
| `src/lib/blast.ts` | A blast's push on the loose pieces, on the GPU |
| `src/lib/fragment-mesh.ts`, `materials.ts`, `shapes.ts` | One draw per material (and `pieceState`, `pieceTint`, `pieceFrame` for its surfaces), the materials and presets, shape helpers |
| `src/lib/prop-mesh.ts`, `prop-pack.ts` | Props drawn on solver bodies (a tint a copy), and loading a pack (colliders, welded parts) |
| `src/lib/audio.ts`, `destruction-audio.ts`, `sound-pack.ts` | The sound engine, the destruction's sounds, the base pack's settings and materials |
| `src/demo/` | The demo: the shared engine (main, audio, effects, sky, weather, player, weapons, launcher, gun) and the sound browser |
| `src/demo/worlds/<id>/` | One world each |
| `docs/making-a-world.md` | How to make a world |
| `docs/changelog/` | The notes of each phase, kept as written: what changed, why, and what it was measured at. `phase-c/`: the worlds' features; `phase-d/`: the solver's and the collapse's fixes; `phase-e/`: the breakable ground and the machine gun; `phase-f/`: the worlds answering the gun, a pit's floor and sides, the pothole and the piece budget. The scripts and screenshots behind their numbers (`scratch/<phase>/<name>/`) were working files and aren't kept |
| `src/lab/` | A test bench of small structures |
| `tests/` | `node --test` suites; `fake-world.ts` stands in for the GPU world |
| `.github/workflows/pages.yml` | Builds the demo and publishes it on GitHub Pages |
| `scripts/shot.mjs` | Screenshots on a virtual display (Xvfb) with the real GPU, for checking changes |
| `scripts/assets/` | Making the sounds, textures and props (fal.ai: Stable Audio 3, GPT Image 2.5, Tripo P2 and Meshy; Blender); `PACK=<id>` works on a world's own pack (`scripts/assets/packs/<id>/`) |
| `assets-src/` | The raw generations, with how each was made, and the ledgers of paid calls (in git: the notes only; the files: `pnpm sources:fetch`) |
| `public/sounds/`, `public/models/`, `public/textures/`, `public/hdri/` | The base pack: sounds, street props, textures, skies |
| `public/packs/<id>/` | A world's own textures, sounds, models and sky; `kit/`: the launcher, the rocket and the machine gun |
| `public/thumbs/` | The worlds' pictures in the picker |
| `vendor/three-avbd/` | three-avbd at commit 2bb1a31, compiled from source, with local patches |
