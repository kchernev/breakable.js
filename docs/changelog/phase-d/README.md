# Phase D: the changes to the library, for world authors

These are the notes of phase D, kept as they were written when its library work ended (only their
links to each other changed, when they moved here from `docs/changes/`). In that phase two teams
changed the library at once: the solver team the vendored three-avbd (and the demo's load), the
collapse team `src/lib/destruction.ts`. Their own notes, with the numbers and the reasons, are next
to this file: `solver.md` and `collapse.md`. This page is the short account: what was new, every
default that changed, and what in each world could then go.

Since then the worlds have taken up what they wanted of it (each world's README says what it uses
and what it measured), `docs/making-a-world.md` describes what a world author needs of it (the
last section here, "Where `docs/making-a-world.md` is out of date", has been folded into it: read
that first), and `vendor/three-avbd/VENDORED_COMMIT` lists each solver patch with its repro for
upstream. Read these for why something is the way it is, and what it was measured at. "Per world"
and "Still open" below are as they stood then.

**No world has to change anything.** All six load with no console errors and stand, and their
biggest building comes down and settles with both teams' changes together (Checked, below). The
typecheck, the tests, the build and the solver lab pass. The workarounds below still work: they can
go when a world is next worked on.

## New

### Solver (`solver.md`)

- `DestructionOptions.rolling` (default 0.02): rolling resistance on every piece and prop; `0`: they roll on.
- `BodyOptions.rolling` (three-avbd, default 0): the same for a body a world adds to the physics world itself.
- `world.solver.params.slipFriction`, `pushOut`, `speculative`, `seams`: the solver's four fixes below, each on by default and switchable.
- `scripts/solver-lab.mjs`: the solver's behaviour checked in Chrome, seven cases with thresholds (`SHOT_DISPLAY=:1NN node scripts/solver-lab.mjs --port 5331 [--only seams,roll]`); exits 1 if one fails.

### Collapse (`collapse.md`)

- `DestructionOptions.killBeyond` / `d.killBeyond` (default 1000 m): loose pieces and props further than this from (0, 0) seen from above, or as high above the ground, are taken out.
- `DestructionOptions.passHeldOnly` (default false): a bond giving way passes on only what it holds, so what's under it isn't overloaded by what's coming off it.
- `BreakableMaterial.keepSmall` (default false): a blast's cells under `minBodySize` beyond its reach stand as bodies (the old way).
- `d.stats.hanging`: pieces hanging on a hinge from the world, from what stands or from what hangs (a chain), and what's joined to them.

## Changed defaults (every world gets these)

### Solver

- `maxSpeed` (40) caps moves and pushes, not only the speed a step leaves: a step moves nothing further than `maxSpeed` × dt, and no contact pushes harder than it takes to change its pair's speed apart by `maxSpeed` in a step. Nothing is flung kilometres; a few pieces a collapse are still thrown, at up to `maxSpeed`.
- So a light piece holds at most about 245 times its weight (40 m/s × 60 steps / 9.81); under more it's pressed into what it rests on. A lower `maxSpeed` lowers that (35: 214 times, 25: 153).
- Sliding friction works for light pieces (`slipFriction`): debris stops where friction says (it slid up to three times as far), and a contact that slid no longer pulls its piece back.
- Pieces slide over the seams of flush fixed bodies (`seams`): planks, slabs, paving, rubble.
- Deep overlaps are pushed out at up to 1 m/s (`pushOut`): a piece pressed into the ground rises out of it.
- Contacts with fixed bodies are found up to three steps ahead (`speculative`): thin pieces thrown at the ground stop on it. A contact event's begin impulse is the larger of the step's push and the meeting speed × reduced mass (about m·v).
- A slow frame's substeps collide again (`reuseManifolds` keeps the detecting step's pairs, not its contacts): 0.3-0.5 ms more GPU each.
- Rolling resistance 0.02 on every piece and prop: a drum 0.6 m across set rolling at 2 m/s stops in about 3 m, a baluster at once. Nothing in the air.
- A removed body's slot waits a step before a new body takes it (a full world takes it at once).
- The demo makes every pipeline before the card ("Shaders…", and one step of the world); the contact-event pass is made when the Destruction subscribes, the solver's scan pipelines once per device. Nothing compiles at the first rocket.

### Collapse

- Piles freeze sooner: the resting checks run every frame (2 ms), in stages, lowest first.
- A loose piece that stays within 10 cm of where it was for 6 s is at rest, however it creeps or jitters.
- A section at rest in part for 2.5 s parts there; the part at rest is looked at alone.
- A wedged piece waits only on what moves under it, for 6 s at most.
- Loose pieces and rubble hold up only what's higher (its centre over theirs): two blocks in a V don't hold each other up.
- A piece with nothing within 1 m under its centre of mass, propped on rubble or a loose piece no lower than itself, drops through it (as a jammed piece drops clear).
- A section at rest bent more than 4° at a joint from as it stood gives way there (not metal's `plastic` joints, nor prop welds).
- A falling section cracks where each piece first strikes: a joint breaks if the strike's energy is over its strength × 1 mm. Sections report their contacts whether or not anything listens for `landed` (every world listens already).
- A piece whose weight has moved off what it stands on holds by its pressed bonds as levers, at its material's pulled strength (they held nothing): a well-bonded plate stays, a weakened one falls.
- `stats.loose`, and the HUD's "moving", leave out pieces hanging at rest (still, or within 10 cm for 6 s).
- A piece hung from one that hangs, hangs (a chain, whole); one hung from a piece that fell comes to rest like anything else, and wakes with it.
- The loose cap (`maxLoose`) leaves props and what hangs; small rubble a hinge holds isn't cleared.
- A blast's cells under `minBodySize` are particles wherever they are (beyond its reach they stayed bodies).
- Loose pieces and props past 1 km out, or 1 km up, are taken out (`killBeyond`).

## Per world: what can now go

The "switched off" checks below were made in the page, with the world's code as it is (its function
replaced for the run): four blasts 1 s apart at the building named, as in Checked.

### `nyc` (Brick Street)

- Nothing in code: it has no `destruction` block (no `killBelow` of its own), no clean-up, and its ground boxes are 1 m. The few cells that still go through the sidewalk (Checked) leave by the box's bottom once pressed past its middle (`solver.md` 3); a thicker box wasn't tried.
- README, Known issues: "Glass at the edge of a blast's reach" is fixed in the library (cells under `minBodySize` are particles wherever they are); "The first loose contacts compile" and "The solver remakes its adjacency scan" are fixed (made at load, once). One pipeline is still made after the card: the hydrants' kernel, on the world's first `update` (`solver.md` 5).
- "Not used here: hinges" no longer holds: a piece hanging at rest isn't counted loose, so a hinge no longer fails the load check.

### `medieval` (Market Town)

- `destruction: { maxLoose: 1500 }`: can go, or stay as a cost cap. At the demo's 3000 the church tower's fall peaks at 1,950-2,200 loose (1,520-1,540 under the cap) and costs about the same: frames over 40 ms 1-9 against 2-8, worst 45-77 ms against 59-87 (eight runs and six, the same session); all of it is at rest by +20 s either way. Past the cap the smallest pieces go, among them the light cells the blasts throw furthest: at 3000, one run in eight put two of them 140 m out.
- The signs hung only after a blast (`onBlast`'s `hang()` within 6 m): they can hang from the start (`hang()` in `build()`). Hung at load in the page: 26 pieces `hanging` (the four boards and their pictograms), `stats.loose` 26 at once (just hung), then 0 but for one sample in 12 (9 at 3 s, swinging past 10 cm), and all four still hang after the tower's fall. With the breeze in `update` the HUD may read a few moving now and then.
- The roof bays (each rafter a bay of its own, 5 mm apart): `passHeldOnly: true` is the library's answer to "breaks all at once"; try it with the roof joined. Not tried here (it needs the roof built again); the collapse team found the nave roof and the tower's fall the same either way with the bays as they are.
- README, Known issues: "The loose cap takes hung signs and props", "Pieces at rest wait to settle" and "A sign a blast has hung stays loose for good" no longer hold. The tower's fall leaves 0-9 loose at +10 s and none at +20 s.
- `falls.ts` (`releaseFronts`, `leanFalls`) stays: nothing here changes how fronts and towers are let go.

### `western` (Dust Town)

- `destruction: { maxSpeed: 35 }` in index.ts ("the solver can fling a fragment at hundreds of m/s"): can go. Nothing goes faster or further than `maxSpeed` now; at 35 a light piece holds a little less (214 times its weight against 245).
- `clearRunaways()` in life.ts: keep it if the town should stay tidy. Switched off, four rockets along the saloon still put a few boards past its 70 × 60 m box (the farthest 78-91 m from the centre, two runs), none past 120 m. `killBeyond` can't stand in for it: it's a circle, and it takes props (the tumbleweeds).
- The let-go in `updateWalls` (the bay and porch hits, the ties cut, `d.release` turning out, the loose pieces pushed into the turn) and `updateTower` stay: nothing here lays a front out into the street.
- README, Known issues: "`demo.stats().loose` reads 13 at rest" is now `stats.hanging` 10 and `stats.loose` 4 at 10 s (the three tumbleweeds, and a sign the wind swings past 10 cm); "the solver makes some 20 prefix-scan compute pipelines" is fixed.

### `neon` (Neon Alley)

- Nothing in code: it sets no `maxLoose` (it has the demo's 3000) and no `destruction` block. `peelFacades` stays (its push is what puts a facade in the alley).
- README, Known issues: "Big collapses settle slowly" (four rockets at the end block: 209-379 loose at +20 s, 0-2 at +40 s, four runs), "Pieces thrown kilometres, or sinking through the street" (none past 120 m, the farthest 45-69 m; none under the street) and "Hung cables and lanterns stay loose for good" (they hang, in `stats.hanging`) are fixed, and so are its two library requests (a speed clamp, small cells as particles beyond a blast's reach).
- Not changed: whole towers still don't come down (`passHeldOnly` makes more of the end block stand, not less).

### `harbor` (Harbor Yard)

- `runaways()`, its `seen` map and its call in `update`: can go. Switched off, the crane's fall put nothing past 120 m in three runs (the farthest 95-96 m), and it never had anything to take out.
- `destruction.maxSpeed: 25`: the world's to keep or drop; at 25 a light piece holds 153 times its weight before it's pressed into what it rests on (245 at the default 40). `killBelow` stays (what sinks in the harbour).
- README, Known issues: 1 (the solver flings container pieces) and 2 (light pieces sliding on) are fixed, and the first frames after load are no longer slow (every pipeline is made before the card). 3 (a section creeping on its plastic joints) in part: after the crane's fall 9-177 pieces are loose at +20 s and 0-3 at +40 s, those mostly the open box's door leaves still turning slowly on their hinges (a leaf counts loose while it moves over 10 cm in 6 s). Library requests 3 and 6 are done.
- `tipStacks`, `buckle` and `jolt` stay: nothing here racks a box on three posts.

### `temple` (Sun Temple)

- `levers.ts` `settle()` (a span come to rest high up out past what it rests on, cut or knocked loose), with the `'state'` listener, `rested` and `knocked` that feed it: can go. Switched off, four flank blasts left as much stone at rest over 3 m along the flank as with it (4-7 pieces against 5, three runs each).
- `levers.ts` `cut()` and the undermined spans it lets go stay: with `cut()` off the same blasts left 27-44 stone pieces at rest over 3 m (three runs; 12-26 of them on nothing that stands, two runs), and with all of `Levers` off 72 (one run).
- With `passHeldOnly: true`, `Levers` cuts the same blocks every frame (`collapse.md` 4(b)): don't set it without a guard.
- README, Known issues: "A section bridging a gap freezes held" is the library's now (a joint bent open gives way; a piece over a gap drops through what props it); "No hinges here" no longer holds (the open door leaf could hang). "A bridge on shortened columns" (one load in six, one blast) wasn't checked.

## Checked together

Nothing had to be fixed where the two teams' changes meet: each had the other's coming in while it
worked. Checked after both were in:

- `npx tsc --noEmit -p .` (and the vendored three-avbd's own, `tests-gpu` included), `npm test` (161) and `npx vite build` pass; `scripts/solver-lab.mjs` passes all seven cases.
- Pipelines made after the card (`GPUDevice.create*Pipeline` counted): Brick Street 1 (a compute kernel: the hydrants', the solver team found), Harbor Yard and Market Town 0; none at the first blast.
- `'landed'` and `land` sounds: a Brick Street collapse sends 110-170 `landed` (two runs) and plays `brick.impact.large` about 100 times; Dust Town's 22. No contact events dropped in any run (`world.droppedContactEvents` 0).

Each world on display :103, the GPU shared with other agents' Chromes: loaded, watched for 10 s,
then four blasts 1 s apart at its biggest building's base, counted at +10, +20 and +40 s after the
last. Brick Street was run at the start, the middle and the end of each round. "Far" and "under"
look at every loose piece and rubble every 0.25 s (under: wholly 5 cm or 1 m under `groundAt`, where
there's ground, not water).

| | Runs | Loose 10 s after load | +10 s | +20 s | +40 s | Past 120 m | Under, 5 cm / 1 m | Farthest | Frames over 40 ms (first blast to +10 s); worst |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `nyc`, the building at x 10-22 | 8 | 0 | 389-692 | 5-188 | 0 | 1 piece, in 1 run | 0-9 / 0-2 (3 runs) | 30-133 m | 1-35; 41-115 ms |
| `medieval`, the church tower | 4 | 0 | 0-9 | 0 | 0 | 0 | 0 / 0 (1 run) | 32-59 m | 2-8; 59-87 ms |
| `western`, the saloon | 4 | 4 (10 hanging) | 88-261 | 3-19 | 3-8 | 0 | 3 / 0 (1 run) | 68-70 m | 2-13; 45-76 ms |
| `neon`, the end block | 4 | 0 | 994-1,316 | 209-379 | 0-2 | 0 | 0 / 0 (2 runs) | 45-69 m | 4-16; 51-127 ms |
| `harbor`, the crane | 4 | 0 | 307-382 | 9-177 | 0-3 | 0 | 0-1 / 0 (2 runs) | 93-96 m | 0-1; 35-52 ms |
| `temple`, the south flank | 4 | 0 | 11-40 | 0-3 | 0-3 | 0 | 0 / 0 (2 runs) | 39 m | 1-5; 41-123 ms |

- No console errors or warnings in any run. What's built stands: no world's count of standing pieces changed in its first 10 s.
- Dust Town at load: `stats.loose` reads 13 for the first second (the hinged pieces, not yet at rest), then 4 from about 6 s: its three tumbleweeds, and one of its 10 hanging pieces swinging. Its 3 at +40 s are the tumbleweeds; in one run five pieces of the saloon were still loose too.
- What's left at +40 s elsewhere: Harbor Yard's door leaves (above), three roof tiles in one Sun Temple run, a tile and a concrete piece in one Neon Alley run and two swinging lanterns in another.
- Brick Street's one piece past 120 m (133 m; not looked at closely) was most likely a chip a blast threw: a blast kicks its lightest cells at up to 2.1 times its speed (32 m/s for a rocket's 15), and one watched was still flying 92 m out at 24 m/s. In eight collapses watched every 0.1 s (Brick Street 4, Neon Alley 2, Dust Town 2), no piece was over 25 m/s later than 4 s after the first blast.
- Under the ground: in 2 of 7 Brick Street collapses two or three cells went 1 m or more under the sidewalk (the ones looked at: three cells of one concrete piece together, 0.2 s after a blast, at 12 m/s down). Elsewhere only a few pieces, shallow, and none left at +10 s.
- Screenshots (before, +10 s, +40 s, and from above at +40 s), scripts and JSON: `scratch/phase-d/integration/` (`run.mjs`, `ab.mjs`, `out/`). Brick Street's facade peels into the street and its slabs stand; Market Town's tower falls into the square and the nave keeps its west gable; Dust Town's saloon front lies flat in the street; Neon Alley's end block heaps across the alley's end; Harbor Yard's crane folds onto Block A's stacks; Sun Temple's south flank and that slope of its roof come down, the cella stands.

## Still open

- Flings are bounded at `maxSpeed`, not gone: a few a collapse in Neon Alley and Brick Street (`solver.md`).
- No true continuous collision: now and then a few cells of one piece go through the ground (above; 0-7 a collapse in the solver team's runs).
- A light piece under one over about 245 times its weight is pressed into what it rests on, the ground included.
- A blast throws its lightest cells at up to about 32 m/s, far enough to land 100 m off.
- The first rocket's worst frame: 33-117 ms in the solver team's runs, most of it GPU time on the shared GPU.
- Rubble doesn't weigh on what it rests on; weight isn't routed by stiffness (`collapse.md` 4(c)).
- Two blocks in a V over rubble less than 1 m under them can still settle there; the gap test is one line under the centre of mass.
- A hung piece swinging more than 10 cm counts loose while it does (a door leaf turning on a vertical hinge, a sign in a strong breeze).
- A section cracks only at each piece's first strike since it came loose; `'landed'` doesn't fire for a section landing on loose debris.
- The vendored GPU tests (`tests-gpu`) typecheck but can't run here (Dawn won't load under Node).

## Where `docs/making-a-world.md` is out of date

Its owner's to change; until then, read it with these:

- "A hung piece is a moving body for good" (Letting things go by hand): it swings while its hinge holds it to the world, to what stands or to what hangs; once what it hangs from has fallen it comes to rest like anything else. `stats.hanging` counts what hangs, and `stats.loose` (Checking it: "nothing loose for 10 s") leaves out what hangs at rest.
- "Two pieces wedged against each other can hold each other up" (What the library does by itself): only in part now (Changed defaults, Collapse).
- "Nothing loose goes faster than 40 m/s": nor moves further in a step, nor is pushed harder; the rolling default (0.02) and the 245-times limit belong beside it.
- The `destruction` options: `rolling`, `killBeyond`, `passHeldOnly`; and the material's `keepSmall`.
- Checking it: `scripts/solver-lab.mjs`.
