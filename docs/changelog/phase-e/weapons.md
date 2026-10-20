# Weapons: the machine gun

The weapons team's changes in this phase: a machine gun beside the rocket launcher, switching
between them, bullets in the library (`Destruction.shoot`: chipping, damage per piece, breaking,
pushing), bullet strikes and marks on surfaces in the effects (chips, dust, sparks, bullet holes,
dents, scorch marks), and the gun's sounds and mix.

Files: `src/demo/weapons.ts` (new: the weapon interface, switching, the HUD), `src/demo/gun.ts`
(new: the gun), `src/demo/launcher.ts` (one of the weapons; its view-model helpers shared; the kit
loads the gun), `src/demo/effects.ts` (bullet strikes, the muzzle's light and smoke, casings,
tracers, decals), `src/demo/audio.ts` (the gun's sounds), `src/lib/bullets.ts` (new: the damage
rules, the push, material kinds), `src/lib/destruction.ts` (`shoot` and the damage per piece only),
`src/lib/destruction-audio.ts` (`MaterialSounds.bullet`, `DestructionSounds.bullet`),
`src/lib/index.ts` (exports), `src/demo/main.ts` (input, the weapons, the strikes, the HUD, `demo.*`),
`index.html` (the weapon HUD, the controls), tests `tests/bullets.test.ts`, `tests/weapons.test.ts`
and `tests/effects.test.ts`.

**No world has to change anything.** Every world gets the gun, its strikes, sounds and marks, and
scorch marks under every blast. A world can tune what a bullet sounds like on its materials
(`MaterialSounds.bullet`, below), and should check the kinds the demo guessed for them.

## The user's change: a much stronger gun, no reloading (2026-10-16, after the review fixes)

The user asked for the machine gun to be "a lot more powerful" and to have no reloading. This
supersedes the brief and anything below about a magazine, rounds or a reload; don't bring them back,
and don't tune a world's materials tougher to make the gun weaker again.

- **No magazine, no reload**: the gun fires for as long as the trigger is held. `gun.rounds`,
  `gun.ammo()`, `gun.reload()`, `onReload` and `onEmpty` are gone, as are `Weapon.reload`,
  `Weapons.reload`, <kbd>V</kbd> and the middle button, and the HUD's rounds (it shows the two
  weapons and which is in hand). The reload animation is gone; the model's `magazine` part just
  stays in place. `gun.reload` and `gun.empty` stay in the base sound pack, unused by the demo.
- **14 rounds a second** (was 11), a tracer every other round (was every third), a little more
  shake per shot (0.18).
- **Power 6** (`POWER` in gun.ts, was 1): `Destruction.shoot(at, dir, 6)`. A brick, a board or a pane
  goes at the first hit, a Brick Street pier in 2, a 2 m concrete block in about 8 (was 43), a
  steel plate in a few dozen. Loose things are pushed 6 times harder (still at most 6 m/s).
- **A heavy round's break is a small blast** (library, `Destruction.shoot`): with power over 1, the
  cut's radius, its cells' speed and its cell budget grow by the cube root of the power (×1.82 at
  6: radius up to 0.73 m, 5.5 m/s, 22 cells), and the standing pieces within half that radius of
  the hit are broken with it. Each round that breaks something blows out a hole a little wider
  than itself. Power 1 behaves exactly as before.
- Tests: `tests/weapons.test.ts` (14 a second, a tracer every other, held for 10 s it never stops,
  the HUD without rounds) and `tests/bullets.test.ts` (a heavy round takes the bricks beside the
  one struck; the 2 m block in at most 12).
- After the worlds' checks (2026-10-17), three fixes in the library for what they found under the
  stronger gun:
  - A loose piece in the line of fire was pushed again by every round, so it sped up past the 6 m/s
    a bullet gives: a tin roof sheet juggled 47 m across Dust Town, Market Town's apple baskets
    skimmed across the square, cells in a bored tunnel shot out of the back of the building. Now a
    bullet raises a piece's speed along its way to its push, and doesn't add to it.
  - A piece too small to cut, struck off its middle, reported `broke` and stood (its small blast's
    reach from the edge didn't take in its middle): 929 of 1,109 rounds at Neon Alley's steel did
    nothing. Now it comes loose whole, on the bullet's way.
  - `materialKind` reads a material's bullet sound first: Sun Temple's terracotta (it shatters,
    and sounds `bullet.brick`) chipped like glass; now it chips like fired clay.
  Tests for each in `tests/bullets.test.ts` (each fails without its fix).

## Playing it

- <kbd>1</kbd> the launcher, <kbd>2</kbd> the machine gun; the mouse wheel goes round them (once a
  turn of it: a notch, or a touchpad's swipe and its glide, which end with a 150 ms pause),
  <kbd>Q</kbd> back to the last one (not while flying: there Q goes down). The one in hand lowers out
  of view (0.15 s) and the other comes up (0.15 s). Nothing fires meanwhile; a trigger held through
  the switch fires the gun as soon as it's up (the launcher waits for a click).
- The gun fires while the button is held: 14 rounds a second, for as long as it's held (no
  magazine, no reload: the user's change above).
- The HUD's lower right shows both weapons, the one in hand bright. The controls in the card list
  the keys.

## The gun (`src/demo/gun.ts`)

- **Its model**: `kit.gun` from `loadKit()` (`public/packs/kit/models/gun.glb`, the gun-model team's,
  `gunmodel.md`): held at the lower right like the launcher, its muzzle at (0.19, -0.2,
  -0.76) in camera space at 0.66 of its size, aimed at the crosshair 30 m off; drawn as the launcher
  is (layer 2, `VIEW_LAYER`; its depth squeezed to the front, so it never goes through a wall; lit by
  the world, its own AO). Without the kit (or without `gun` in its `index.json`), a drawn gun of
  boxes and tubes in the launcher's drawn style.
- **Bullets** go along the crosshair from the eye (hitscan), off it by up to the spread (a cone's
  radius, anywhere round it): 0.0025 rad for the first round, 0.0035 more each round to 0.03 at most
  (more while walking), closing at 1.5/s while firing and 5/s after. So the first round goes where
  it's aimed, a long burst opens to about half a metre across at 10 m (measured: rounds after the
  20th within 0.27–0.28 m of the aim point, 0.42–0.48 m across), and a pause closes it again. They
  reach 400 m. The first thing along the way is struck: a piece (`Destruction.shoot`, standing,
  rubble, props or loose ones), the scenery (`solids`) or the ground (`groundAt`). The world's
  ground is a fixed body too, its top where `groundAt` says: a scenery hit within 3 cm of
  `groundAt` on a face turned up (normal y over 0.7) is the ground, of the ground's kind (dirt in
  Dust Town and Sun Temple), and the water check applies to it. The water (`water`, below) and the
  sky take them silently.
- **Each round**: the muzzle flash (a star facing the eye and a plume, 0.045 s, turned at random),
  a brief light at the muzzle (an effects flash light that a blast never gives up for it) and a
  wisp of smoke; a casing out of the ejection port to the right, up and back (it tumbles, bounces on
  what's under where it falls and lies there 4–6 s; now and then, a third of the time, it's heard
  landing); a tracer every third round; the gun jolts back and up; the view climbs (0.0055 rad a
  round, aside up to 0.002, less as a burst goes on; settling at 3/s while firing and 7/s after,
  about 1° at most through a long burst, back where it was within half a second of letting go) and
  shakes a little (`player.shake` 0.14). The climb is laid over the player's own aim each frame (the
  camera's turn, not `player.pitch`), so it never fights the mouse and always settles back.
- Idle sway, the lag behind the view as it turns, a dip with each footfall and landing, a little
  lower while walking: as the launcher's.

### API

```ts
import { Gun } from './gun.ts';
const gun = new Gun(camera, destruction, def.groundAt, {
  kit: kit.gun,          // the model, muzzle and ejection port (loadKit); default a drawn gun
  effects,               // muzzle, casing, tracer (the demo's Effects); default none
  player,                // shaken a little by each round; default none
  solids,                // the scenery's fixed bodies stop bullets; default none
  kindOf: (m) => kind,   // what each material is (default materialKind(m, its material))
  ground: (x, y, z) => kind, // what the ground is where it's struck (default 'concrete')
  water: (x, z) => bool, // where the ground is water: nothing seen or heard (default nowhere)
});
// main.ts: water where the world doesn't let the player walk and its ground lies below -0.5 m
// (Harbor Yard's water; not Market Town's lanes by its scenery houses, kept clear of the player)
gun.onHit = (h: BulletHit) => {};  // at, normal, direction, distance, piece | null, material | null, kind, broke
gun.onShot = () => {};             // each round
gun.onBurstEnd = (rounds) => {};   // the trigger let go, or the gun put away
gun.onCasing = (at, delay) => {};  // a casing heard landing at `at` in `delay` s
```

It's a `Weapon` (`weapons.ts`): `trigger(down)`, `burst(n)` (n rounds at its rate, as if held; a
burst asked for while it's lowered waits for it to come up), `footfall(speed)`,
`update(dt, moving)`, `lowered` (0 in hand, 1 out of view), `view`, and `automatic` (true: it fires
while held, so a trigger held through a switch fires it once it's up).

## Switching (`src/demo/weapons.ts`)

```ts
const weapons = new Weapons([launcher, gun]); // the first in hand
weapons.select('gun');   // or an index; weapons.cycle(±1); weapons.swap() (Q)
weapons.scroll(e.deltaY, e.timeStamp); // the wheel: once a turn of it (±50 px, ended by 150 ms without events)
weapons.trigger(true);   // to the one in hand (held through a switch: to an automatic one once it's up)
weapons.burst(n);        // to the one in hand, or the one coming up; footfall(speed)
weapons.update(dt, moving); // every weapon (rockets fly on while the launcher is down)
weapons.show(element);   // the HUD (#weapon), written only when it changes
```

`groundKind(def)` says what the world's own ground is by its footstep sound there (dirt, sand,
gravel, grass, soil, mud, earth: `'dirt'`; else `'concrete'`): Dust Town's and Sun Temple's are
dirt, the others stone.

The launcher is the other `Weapon`: `trigger(true)` fires (as a click did), `burst(n)` fires n
rockets one per reload (it reloads by itself). Lowered, it drops 0.32 m and
tips its muzzle 0.65 rad down (`LOWER`), and is hidden once out of view (drawn for the first 0.5 s
so its shaders are made at load, as is the gun's, which starts lowered). Its own behaviour, its
hooks and tests are unchanged.

### For scripted checks

- `demo.weapon('gun' | 'launcher')`, `demo.fire(n = 1)` (n rounds of the gun, or n rockets, from the
  one in hand, or the one coming up once it's up, at its pace, where the crosshair is: `demo.weapon('gun');
  demo.fire(10)` fires 10), `demo.gun`, `demo.weapons`. Switching away drops what's left of a burst.
- `demo.stats().marks`: the decals on surfaces.

## Bullets in the library

### `Destruction.shoot(at, direction, power = 1, range = 500): ShotHit | null`

What a bullet from `at` along `direction` strikes first within `range` m: a standing piece, rubble,
a prop or a loose piece (where it is now: its last readback carried on by its velocity), or null.

```ts
const hit = d.shoot([x, y, z], [dx, dy, dz]);
if (hit) {
  hit.piece; hit.point; hit.normal; hit.distance; // as RayHit
  hit.material;  // the piece's material
  hit.broke;     // it gave way: it breaks there (now, or over the next frames within the breaking budget)
  hit.damage;    // how much of what it can take it has taken, 0–1 (0: it never breaks, a prop or a static piece)
}
```

- **Pushed**: a loose piece, rubble or a prop at rest is pushed along the bullet's way at
  `bulletPush(mass, power)` m/s (`0.008 × power / mass`, at most 6; under 0.08 not at all): Neon
  Alley's crate (0.0015) skitters off at 5 m/s (six rounds moved one 0.63 m), a bin (0.015) slides
  at 0.5 m/s, a trash can 0.27, a hydrant or a car not at all. Rubble and props wake (and settle
  again); a hung sign swings.
- **Damage**: each bullet adds `power` to what the piece has taken. Nothing is cut until that passes
  `bulletsToBreak(material, piece.size)`: glass (`shatter`) at the first; otherwise
  `3 × (impact / 25) × (2.5 if plastic) × (size / 0.25)^1.5`, rounded, at least 1. That's 3 for a
  quarter-metre brick, 9 for a Brick Street pier (0.5 m), 2 for a thin board, 43 for a 2 m × 1 m ×
  0.5 m concrete block, a few hundred for a steel plate (60 × the size term: a container panel
  about 200). Props and static pieces never break.
- **Breaking**: past it, the piece is cut where it was struck, as a small blast of it alone would
  (radius `0.8 × size` kept to 0.15–0.4 m, from 8 cm in front of the hit, so its cells go on along
  the bullet's way at about 3 m/s; at most 12 cells): it goes through the same breaking budget
  (`frameBudget`) and the same weighing as blasts (`'fracture'`, `'dust'`, `'debris'`, what falls).
  A piece too small to cut comes loose whole. Rubble struck past it wakes and is cut as it moves;
  a loose piece is cut where it is. Its cells start with nothing taken, so a block chipped away
  gives way bit by bit, and what was holding up what's above can bring it down.
- The chips a bullet throws are the demo's to draw (the library sends no event for them): the hit
  says where and what.

### The rules, separately (`src/lib/bullets.ts`, exported)

- `bulletsToBreak(material, size)`, `bulletPush(mass, power?)`: above.
- `materialKind(name, material, sounds?)`: `'brick' | 'concrete' | 'metal' | 'wood' | 'glass' |
  'dirt'` (`MaterialKind`), for the sound and the look of a strike: glass if it shatters, metal if it
  bends (`plastic`); else what its `bullet` sound says, earth if its name says so (dirt, earth, soil,
  sand, mud, gravel, turf, grass), what its other sounds are named after (`brick.break`,
  `wood.impact`...), brick by name, wood if it has a grain or a density under 1.1, else concrete.

## Strikes and marks (`src/demo/effects.ts`)

### `effects.bullet(at, normal, { kind, chips?, dust?, floor? })`

By what was struck: 7–11 chips thrown back out of the hole (in the material's chip colour, landing
on `floor`), 2–3 small puffs of powder (in its dust colour, blended over the palette as dust is)
and a few flakes; off brick and concrete now and then a spark or two; off metal a spray of sparks
(9–16, short), a glint of light and hardly any dust; off glass only glittering bits; off dirt more
clods thrown higher and a bigger puff. main.ts calls it from `gun.onHit` with the world's
`chips` and `dust` colours for a piece's material; the world's own ground has none, so dirt gets
earth's (chips `0x8c7658`, dust `0xbca78a`) and the rest a grey.

### `effects.muzzle(at, dir)`, `effects.casing(at, velocity, floor)`, `effects.tracer(from, to)`

The muzzle's light (peak 14, 6 m, gone in a tenth of a second) and its smoke; a brass casing (a
bit of a new kind: a little cylinder, tumbling twice as fast as a chip, glinting broadside on,
bouncing 0.4 and lying still once stopped, 4–6 s); a tracer (a white-hot streak 7 m long, flying at
520 m/s, about 1.3 px wide at any distance; up to 24 at once, drawn while one flies).

Flash lights: a *minor* flash (the muzzle's, a metal spark's) takes an idle light or another minor
one, never one a blast is using, and fades in a tenth of a second (`flashLight(lights, minor)`,
exported from effects.ts for its test).

Bits now land on a height of their own (`floor`, default the effects' ground): casings on what's
under where they fall, chips under where they were struck (main.ts: the ground or the piece under
the point). The other emitters are as before.

### Decals: `effects.decal(at, normal, { kind?, size?, piece?, color? })`, `effects.scorch(at, normal, radius)`

One decal system for every mark on a surface: `'hole'` (a bullet hole: a black core in a
shadowed crater toward the material's colour, a lighter chipped lip, powder round it; 12 cm),
`'dent'` (metal: a dark dimple in a ring of bright scuffed metal; 9 cm), `'pock'` (dirt: a soft dark
pit; 16 cm) and `'scorch'` (a blast's soot, streaked out from the middle in blotches of 3D noise
through its box, so no grid shows on a surface turned any way; `scorch()` makes one 2.6 times the
blast's radius across, up to 10 m). One scorch darkens what's at its middle to a quarter (its soot,
0.25, multiplied in). A new one makes those already round it lighter, by up to half their soot the
nearer their centres (none past the mean of the two radii), so blasts in one spot never stack to
black: one 0.25, two 0.16, three 0.13, ten about 0.11 at the middle. main.ts puts a hole (a dent on metal, a pock on dirt)
where each bullet struck, unless the piece gave way, is glass, or is flying; and a scorch where
each blast went off (rockets and `demo.blast`).

The CPU side (the ring of slots, which piece each is on, moving them onto cells on `'fracture'`,
dropping them with what's gone, softening scorches, the upload ranges) is `DecalSlots`, exported
from effects.ts and tested in `tests/effects.test.ts`; `Decals` draws from its floats.

How they're drawn: each decal is a box standing out of and into its surface (2 cm–1 m each way),
one instanced draw for all of them (a ring of 2048, `EffectsOptions.decals`; the oldest fifth fade
out as new ones come). A box is drawn where the scene's depth puts a surface inside it, facing its
way, and multiplies what's drawn there (darker, or a little lighter at a hole's lip): it takes the
light, the shade and the fog where it is, and with no surface in it, it shows nothing: **no decal
ever hangs in the air**. One on a piece (`piece`) is placed in its body's frame and drawn where the
solver's buffer has that body now, so it goes where the piece goes (a wall section falling, rubble
thrown, a prop knocked over: a taxi's dents went with it when it was thrown). A prop's reach 25 cm
into it (a prop is struck on its collider, which only roughly wraps what's drawn). When a piece
breaks, each of its decals goes onto the cell its centre is on (or is dropped with what turned to
dust), and one on a piece that's gone is dropped.
A scorch stays where the blast was and darkens whatever is there: what's left round the crater,
its floor, the rubble that lands in it. Not on the view model (nothing within 15 cm of the eye),
nor on surfaces turned across it (a corner), nor through glass (it's on the pane's depth).

`EffectsOptions.destruction` (main.ts passes it) is what lets decals follow pieces; without it
every decal stays put. `effects.objects` now has the decals and the tracers too (main.ts puts them
on the particles' layer, out of the AO pre-pass); the puffs and the decals share one copy of the
scene's depth a frame.

## Sounds

- `gun.shot` each round, in the player's head (no delay, not placed), a take of its own at a
  slightly different pitch each time (the engine never plays the same take twice running), at half
  its pack level (`SHOT` 0.5 in audio.ts) and priority 0.6 (it gives way to a blast for a voice, and
  masks less of the world); `gun.tail` once a burst ends, louder for a longer burst (0.4 + rounds /
  20, at most 1), through the world's reverb (send 0.45);
  `casing.drop` at the feet a moment after one round in three (the sound's cooldown thins it).
- Where a bullet strikes: `DestructionSounds.bullet(at, material, kind?, glance?)` (audio.ts calls
  it from `gun.onHit`): the material's `MaterialSounds.bullet`, else `bullet.<kind>`; and now and
  then off metal (8 %) and brick or concrete (3 %), more often only when it truly grazes (+20 % ×
  (glance − 0.75) / 0.25: within about 15° of the surface; glance is 1 − |d·n|), and never two
  within 0.6 s, `bullet.ricochet`. A burst at the road a few metres ahead is all grazing hits
  (mean glance 0.8): 3 ricochets in 56 rounds; at a taxi's side 2 in 34; at a container wall struck
  at a grazing angle (glance 0.84) 6 in 57. A name that isn't loaded plays nothing.

### `MaterialSounds.bullet?: string`

What a bullet striking the material sounds like, per world, in `audio.materials` (it plays at the
material's `pitch`, as its other sounds do; `pitch: { bullet: 0.9 }` for this kind alone). Default
`bullet.<kind>` of `materialKind`. Brick Street's `earth` (the ground team's) sets `'bullet.dirt'`.

### Mix (Brick Street, at a brick wall 4 m off; recorded from the engine's output)

| | Loudness |
| --- | --- |
| Standing (the bed) | -32.3 LUFS integrated, -29.9 momentary at most |
| A 3.6 s burst at the wall, its strikes and casings (the shot at its pack level) | -13.8 short-term, peak -2.2 dBFS |
| The same at half the shot's pack level (as it is now) | -16.9 short-term, -15.8 momentary at most, peak -4.3 dBFS |
| A rocket's blast 20 m off | -21.0 short-term, -14.9 momentary at most, peak -5.0 dBFS |

So a burst sits about 13 dB over the street's bed and no louder than a blast down the street at its
peak. A bullet's strike at a wall within 6 m is as loud as the pack makes it (`bullet.brick` 0.43,
full within 6 m): about as loud as the shot. Voices: 40 rounds with a blast in the middle of the
burst: every round, strike and casing played, the blast's bang and debris played and were still
playing 1.8 s later (`explosion.near` priority 5 against the gun's 0.6 and the strikes' 1).

## Measured

- **Frame times** while firing for 5 s at a wall at 6 m (55 rounds, the main material of each
  world), against standing there 5 s before (the GPU shared with other agents' Chromes; Brick Street
  run between each world; display :102, 1280 × 720): see the table below.
- **CPU**: a round costs about 0.25 ms (the gun, its trace and the shot: `demo.profile`'s player
  column, 0.06 standing, 0.22–0.33 firing); the destruction's column goes from 0.13 to 0.6 ms
  firing at Brick Street's wall (the breaks). A bullet that only chips costs the raycast (the grid,
  and a sphere test over the loose pieces); one that breaks costs 1.3–3 ms (the weighing after it,
  `settle()`, most of that) and the first break of a big piece up to 7 ms (its Voronoi cut). Breaks
  share the 4 ms budget with blasts.
- **No pipelines made after the card**: switching, firing, the strikes, decals, tracers, casings, a
  reload and a rocket after it made none (Brick Street, Harbor Yard with its reflections, Neon Alley;
  `GPUDevice.create*Pipeline` counted). The decals and the tracers are drawn from the start (empty),
  the gun's view model and flash for the first half second (below the view).
- What breaks when (20 rounds at 5.5 m, 4 cm or so apart): Brick Street's pier gave way at the 28th
  round at one spot, then its cells one or two rounds each; Market Town's oak 3 of 20, plaster 11 of
  20 (thin infill), limestone none; Dust Town's siding 8 of 20 (boards), adobe 1, tin none (dents);
  Neon Alley's concrete and tile none; Harbor Yard's containers none (dents), its crates and cardboard
  18 of 20; Sun Temple's limestone 2 of 40.

Mean frame interval (ms; 60 fps is 16.7), the worst frame, and frames over 40 ms in the 5 s,
standing and then firing; two runs each world, Brick Street between every run (ten runs):

| | Standing: mean; worst; over 40 | Firing: mean; worst; over 40 | The gun's CPU a frame (ms) |
| --- | --- | --- | --- |
| `nyc` (brick), 10 runs | 17.6–23.6; 30–103; 0–6 | 16.8–25.0; 31–84; 0–9 | 0.22–0.37 |
| `medieval` (limestone) | 19.6, 21.4; 84, 70; 5, 4 | 23.7, 17.6; 54, 32; 7, 0 | 0.17–0.22 |
| `western` (siding) | 17.2, 21.0; 37, 34; 0, 0 | 19.1, 18.1; 39, 32; 0, 0 | 0.43–0.45 |
| `neon` (concrete) | 18.8, 20.2; 30, 58; 0, 2 | 18.2, 17.4; 32, 128; 0, 1 | 0.13–0.14 |
| `harbor` (container) | 17.1, 16.9; 37, 29; 0, 0 | 16.8, 17.6; 25, 27; 0, 0 | 0.14–0.15 |
| `temple` (limestone) | 19.8, 17.2; 95, 30; 1, 0 | 21.5, 17.4; 66, 50; 10, 1 | 0.51–0.65 |

Firing costs no more than the noise of the shared GPU in the means (Brick Street's ten firing
runs span the same range as its ten standing ones). The worst frames while firing are mostly the
breaks: in a separate run at Brick Street's wall, logging each frame over 40 ms, the one with the
pier's first cut was 50 ms (14 ms of it CPU, the shot itself 5–7 ms), and the others (40–66 ms)
came a frame or two after a break, their CPU mostly the render call (3–13 ms: new cells to draw, on
the shared GPU). Sun Temple's
first run had 10 frames over 40 ms firing and its second one; Neon Alley's one 128 ms frame (second
run) came with nothing breaking (its destruction's CPU stayed at 0.12 ms) and wasn't seen again.
The gun's own CPU is the trace: Sun Temple's ground is a noise function looked up every half metre
along the ray. Particles while firing: about 500 (Dust Town 1,400: adobe and boards breaking up);
55 marks.

## Checked

- `npx tsc --noEmit -p .` clean; `npm test` passes (`tests/bullets.test.ts`: the damage rules,
  pushes, a brick giving way after a few hits and only chipped before, glass at the first, a 2 m
  block and steel, breaking where struck, static pieces and props, loose pieces struck where they
  are, material kinds; `tests/weapons.test.ts`: the rate, the tracers and casings, the spread and
  the climb settling, the magazine, the click, the reload by itself and by hand, the scenery, the
  ground, the water and the sky, the world's ground as a fixed body being the ground, where casings
  land, switching in about 0.3 s with a held trigger firing the gun once it's up, changing one's
  mind halfway, a burst asked for as the gun comes up, the wheel once a turn, the HUD, `groundKind`
  with Dust Town's and Brick Street's steps, rockets flying on while the launcher is down, the
  launcher's burst; `tests/effects.test.ts`: the decals' ring and uploads, decals following pieces
  onto their cells and going with what's gone, a slot written over letting go of its piece,
  scorches softening, the flash lights). The launcher's tests pass unchanged. The strike-sound test
  draws its random numbers from a seeded generator, so it gives the same result every run.
- In the page (display :102), all six worlds: they load with no console errors or warnings and
  look as before (the launcher in hand; the new HUD at the lower right); a rocket goes off as
  before; the gun switched to, fired at each world's main materials (screenshots firing, after, and
  close up: holes, dents, chips, dust, sparks, splinters, breaks), reloaded, switched back. A facade
  shot then brought down with rockets; scorch marks on the road and round craters; a crate shot
  across Neon Alley.
- Scripts and screenshots: `scratch/phase-e/weapons/`
  (`drive.mjs` runs a list of steps on :102; `frame.js` stands the player square on to a piece of
  a material; `out/`: the screenshots, `out/perf.txt` the frame times, `out/rec/` the recordings).

## What each world should do

Nothing is needed. To make it its own:

- **Check the kinds the demo picked** for its materials (the sound of a strike and its look:
  `materialKind`), and set `bullet` in `audio.materials` where one is wrong. As picked:
  - `nyc`: brick, brickPainted, plaster, pot: brick; concrete, asphalt: concrete; earth: dirt;
    painted (the frames), wood, foliage: wood; metal, grate, sheet: metal; glass, lamp: glass.
  - `medieval`: limestone, limestoneTower, rubble, rubbleTower: brick (they share brick's sounds);
    plaster, tile: concrete; oak, boards, cloth, hay, produce: wood; iron: metal; bronze (the bell)
    concrete (it doesn't bend); glass, lantern: glass.
  - `western`: siding, timber, stave, paint, signpaint, hay: wood; adobe, brick: brick; stone:
    concrete; tin, iron: metal; bronze concrete; glass: glass.
  - `neon`: concrete: concrete; tile, render: brick; steel, signbox, shutter, grate: metal; neon,
    lightbox, lamp, glass: glass; awning, lantern, wood: wood.
  - `harbor`: every steel thing (container, steel, cladding, tank, roof, ...): metal; concrete:
    concrete; wood, cardboard: wood; glass, lamp, beacon: glass.
  - `temple`: marble, drum, triglyph, ruin: brick (brick's sounds); limestone: concrete;
    terracotta: glass (its sounds are glass's: a strike shows glittering bits, no hole; `bullet:
    'bullet.brick'` would make it chip); timber, bark, foliage, cypress: wood; bronze: metal.

  Stone that shares brick's sounds (Market Town's, Sun Temple's marble) may want `bullet:
  'bullet.concrete'`; its look (chips, powder, a hole) is the same either way.
- **Water**: main.ts takes the ground as water where `walkable` says no *and* `groundAt` is below
  -0.5 m (Harbor Yard's water at -1.8 m). Market Town's `walkable` shuts out its scenery houses
  with a 1.8 m margin and the lanes between them: those cobbles are struck as any other ground.
  Better would be an explicit `water?(x, z): boolean` in the world contract (`worlds/types.ts`, not
  the weapons team's file), set by Harbor Yard (`z < QUAY.edge`) and Sun Temple (its sea), and
  passed to `Gun` as it is. Until then Sun Temple's sea (no `walkable`) gets puffs on the sea bed
  80 m down, out of sight in practice.
- **A breakable ground** (the ground team's `addGround`): `groundAt` should give its bed, as Brick
  Street's does, so bullets strike the slabs as pieces (and a crater's floor once they're gone).
- `chips` and `dust` colours per material are what a strike is drawn in: every world has them.

## Not done, and known issues

- The library doesn't send chips of a strike as events: the demo draws them from the hit. A library
  user without the demo's effects gets no chips (the breaks' `'debris'` and `'dust'` are sent as
  for blasts).
- No hands: the reload is the gun turning and the magazine moving on its own, like the launcher's.
- A bullet hole is a mark, not geometry: a piece only changes shape when it gives way.
- Decals on loose pieces: none are made on a piece that's flying when struck (its pose is a
  readback old); those made on it before it came loose go with it.
- A scorch shows on anything in its box, so pieces flying through it are darkened while they're in it.
- Water is guessed from `walkable` and `groundAt` (above), until the world contract says.
- README (not the weapons team's file) still calls the demo "six worlds to blow apart with a rocket
  launcher" (line 14), and its controls line (110) has no <kbd>1</kbd>/<kbd>2</kbd>, wheel,
  or <kbd>Q</kbd>. Suggested: "six worlds to blow apart with a rocket launcher and a machine gun",
  and "click to fire (hold for the machine gun), 1 / 2 or the wheel to switch weapons (Q the last
  one)".
- Hits on the ground of the dirt kind take earth's colours, not the world's own ground colour (the
  world contract has none for it): in Dust Town the strike's puff is a shaded tan, a little darker
  than the bright sand.
- The view's climb is applied to the camera after the player sets it each frame: a script that sets
  `demo.camera.rotation` itself sees it added to.

## Review fixes

An independent review found three major problems and seven minor ones. Each was judged on its
merits; all were real and are fixed:

1. **Ground hits in the dirt worlds came out as concrete** (about half: the world's ground is also a
   scenery body with its top at `groundAt`, and `Gun.trace` took that as the scenery). Now a
   scenery hit on a face turned up within 3 cm of `groundAt` is the ground (`Gun.groundStrike`: its
   kind, the water check). Dust Town and Sun Temple, 17 rounds at the street: 17 dirt (were 11 and
   10 concrete), 17 `bullet.dirt`, no ricochets; soft pocks in the sand, no black holes. Ground
   strikes of dirt get earth's chip and dust colours.
2. **Bullets vanished in Market Town's lanes**: water was everywhere `walkable` said no. Now it
   also needs `groundAt` below -0.5 m. Market Town, 15 rounds at the cobbles by the scenery
   houses: 15 hits, 15 marks, 15 strike sounds (were 8). Harbor Yard: 10 rounds into the water, no
   hits; at the quay's last 0.3 m, struck.
3. **Scorch marks stacked to black**: one now darkens to 0.25 at its middle (was 0.07) and
   softens those round it (above). Brick Street, three blasts in one spot: the crater's earth and
   rubble stay brown, darkened. Thirty overlapping: grey, not black. The mottle is 3D noise in the
   decal's box: a scorch beside a taxi's side shades it evenly, with no grid of blobs.
4. **A trigger held through a switch was dropped**: `Weapons` keeps the button; an `automatic`
   weapon gets it once up. In the page with real events: 2, then the button held 1.5 s: 14 rounds
   (were 0).
5. **`demo.weapon('gun'); demo.fire(n)` fired nothing**: the gun no longer drops its queue while
   lowered; `Weapons.select` drops the queue of the one put away. In the page: 10 of 10.
6. **The strike-sound test failed at random** (a ricochet after the strike): it reads the first
   sound of each strike, and its ricochet counts come from a seeded generator.
7. **Too many ricochets**: see Sounds. 3 in 56 rounds at the road (were 11 played of 18 tried).
8. **A touchpad scroll switched several times**: `Weapons.scroll`, once a turn of the wheel. 50
   steps of 6 px 16 ms apart: one switch (was three).
9. **Docs**: the spread is a cone's radius, a long burst about half a metre across at 10 m (was
   "25 cm"). README is flagged above.
10. **No tests for the trickiest logic**: `DecalSlots` and `flashLight` came out of the shader and
    light code to be tested; tests for them, `groundKind`, the HUD, the ground tie, the wheel, the
    burst as the gun comes up and the trigger held through a switch. The new weapons tests fail
    on the code before these fixes (checked on a copy: the ground tie, the held trigger, the burst,
    the wheel).

Checked after: typecheck clean; the six worlds load with no console errors or warnings and look as
before; firing, reloading and a rocket in each; no pipelines made after the card in Brick Street
(switching, firing at brick and the ground, a reload, a dry click, a rocket, a blast); 2048 holes
and 30 scorches on and off in turn: 23.9, 25.4, 26.8 ms a frame on against 25.2, 25.9, 24.1 off.
Standing and firing 5 s each, twice, at the same time on a shared GPU (load average about 30):
Market Town 32.2, 28.6, 31.9, 29.8 ms standing against 30.4, 30.4, 34.4, 32.1 firing; Brick Street
27.7, 28.8, 29.3, 29.4 against 31.8, 27.0, 29.3, 30.9: within the noise, the gun's own CPU 0.2–0.75
ms a frame. `npm test`: all of ours pass; `tests/hull.test.ts`'s timing check (200 points under
15 ms) failed under that load (18 ms) and passes alone: not the weapons team's code.
Scripts and screenshots: `scratch/phase-e/weapons-fix/`
(`mk.py` writes the step files; `out/`).
