# Brick Street: credits

Brick Street's assets are the base pack's (`public/models` and `public/textures`, credited in their
`CREDITS.md`; `public/sounds`, generated for this project with Stability AI's Stable Audio 3 Medium
from the prompts in `scripts/assets/sounds.mjs`). This folder has what is its own on top of that.

## Sounds (`sounds/`)

`steps.metal`: footsteps on iron (a fire escape's grating, a car's roof), made from the base pack's
own sounds by `scripts/assets/packs/nyc/steps-metal.mjs` with ffmpeg: each `steps.asphalt` slice with
the first 0.3 s of a `metal.impact.small` take under it, a third higher, high-passed and faded. No
paid calls were made for it.

`pigeons.scatter`, `ac.hiss`, `lamp.short`, `water.leak`: what the street does when it's shot at,
generated for this project with Stability AI's Stable Audio 3 Medium (on fal.ai) from the prompts in
`scripts/assets/packs/nyc/sounds.mjs`, cut and levelled by `scripts/assets/process-sounds.mjs`. The
raw takes and how each was made are in `assets-src/packs/nyc/sounds/`; the calls and their cost in
`assets-src/packs/nyc/ledger.jsonl`.

## Textures (`textures/`)

`rocky_trail_02` (`_diff`, `_nor_gl`, `_arm`, 1k), the earth under the street: [rocky_trail_02](https://polyhaven.com/a/rocky_trail_02)
by Amal Kumar, Poly Haven, CC0. The same files as Market Town's (`public/packs/medieval/textures/`),
copied so this pack stands alone; greyed in the game (`EARTH_TINT` in `materials.ts`).
