# Sun Temple: the sanctuary answers the gun, and the last checks' issues

The Sun Temple team's work this phase. The world's README (`src/demo/worlds/temple/README.md`:
"Reactions", "The breakable ground", "Measured", Phase F) has the details and the numbers; this is
the short account.

Files: `src/demo/worlds/temple/index.ts` (the hooks), `flock.ts` (the falling leaves),
`materials.ts` and `ground.ts` (the ground's tuning, the beds), `README.md`; the pack:
`scripts/assets/packs/temple/sounds.mjs`, `textures.mjs`, `textures.py`,
`public/packs/temple/sounds/` (`bronze.ring`, `bay.echo`), `public/packs/temple/textures/temple_earth_*`,
`public/packs/temple/CREDITS.md`, `assets-src/packs/temple/` (the raws, `ledger.jsonl`,
`shots/phase-f/`); `public/thumbs/temple.jpg`.

## The sanctuary hears the gun

Every reaction a rocket sets off, a burst sets off too, scaled to it (`loud`: 0.25 + its rounds /
40, at most a rocket's 1), and once a burst, however many rounds:

- **The cicadas** stop at a burst's first strike (`onShot`) and come back after (15..30 s) × `loud`
  from its end (`onBurst`): a single round, back from 7 s; 28 rounds, back from 22 s after.
- **The jackdaws** go up off the roof nearest the strikes or the player at a burst's third strike
  (as it ends, for a burst into the sky), at most every 40 s, as after a blast.
- **The bay** throws a burst back: `bay.echo` (new, the far rattle of a burst off cliffs) from 400 m
  out, 1..1.5 s after the trigger's let go, louder for a long burst (about 10 dB under the burst).
- **The bronze goddess rings** when she's shot: `bronze.ring` (new: a ping and the deep hum of
  hollow bronze) at 0.72..0.8, a tripod higher; once a second at most, softer while still ringing:
  70 rounds at her, 5 rings.
- **Shot olive leaves flutter down**: `Leaves` in `flock.ts`, an instanced mesh drawn from the
  start: 6 leaves out of the struck face of a crown (10 when it broke), at most 40 at once and 20 a
  second more; they tumble down, drift on the breeze, lie 5 s and shrink away.
- **The sea** takes bullets (`water`), and **a pit's side** against the land strikes as it's drawn,
  earth over rock, the court's too (`pitSide`).

## The last checks' issues

- **A court crater plugged with flags**: two kinds of chunk stood in the hole, flag plates that fell
  back in and the rubble's 0.6 m cells thrown up and falling back. The court throws harder (`toss`
  0.55), the flags' cells under 0.25 m go as chips (`minBodySize`), and the rubble a blast or a
  bullet reaches goes as grit (`minBodySize` 0.75, `keepSmall` so the sides stand, 16 cells a slab):
  18 rockets into the court, every hole clear and stood in at 0.3..1.0 m down (before: 2 of 6 held
  the player at the top).
- **Field craters read as speckled red stone, with wedges on edge at the rims**: a second take of
  `temple_earth` (dry crumbs and clods of soil; one GPT Image 2.5 image), and the earth a blast
  reaches flies as soil (`minBodySize` 0.6, `keepSmall`): soil walls over a rock floor, a clod or
  two at most.
- **The picture** retaken with `docs/making-a-world.md`'s recipe: the temple over the court, the
  goddess, the tholos, the treasury and the sea (37 KB).
- **Terracotta** strikes as `brick` now (the library's fix): red-orange chips, no glitter.
- **Beds and budget**: both grounds' beds are `rock` (drawn as bare rock), `maxPieces` 7,250 (what it
  loads with and 1,500); checked: the rubble of four flank blasts goes down to a budget set under
  it, nothing standing lost. Steps on a crater's bare floor are stone.

Checked as before: it stands (5,752 pieces, nothing loose), no errors, no pipelines after the card;
the four flank blasts leave 16/0/0 and 75/0/0 loose at +10/+20/+40 s; standing and firing it costs
what Brick Street costs at the same time (25..30 ms a frame on the busy GPU, both). Spent: $0.49 by
estimate (one image, six Stable Audio takes, six QA calls).

## For others

- **Leaves under the gun raise soil's powder** (`src/demo/effects.ts`, not this team's): leaves
  strike as `dirt` (their `bullet.dirt`), and `effects.bullet` throws four dirt-sized puffs a
  strike, so 14 rounds into a crown raise a pale cloud round the falling leaves. A strike look for
  leaves (or the material's `dustAmount` applied to a strike's powder) would let it be a green haze.
- `docs/making-a-world.md` (not this team's): `onShot`/`onBurst`, `water`, `pitSide`, `bed` and
  `maxPieces` aren't in it yet (the hooks' and the pile's notes say where).
- Of the three loads behind the 18 court craters, two (12 craters) applied the ground's new
  settings in the page before they were in the code (the same values); the third ran on the code.
