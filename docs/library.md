# The library

Breakable.js is `src/lib/` (its exports: `index.ts`). Back to the [README](../README.md).

Structures are convex pieces bonded where they touch. A blast cuts what it reaches into Voronoi
cells (small at the hit, bigger further off), throws the near ones, and whatever no longer carries
its weight to the ground falls: whole sections at a time, turning over the edge they're out past,
held together by joints that break when they land. Bullets chip what they strike and, once it has
taken enough, break it where they hit. The ground can break too: a road or a square laid as slabs
that a blast craters and sustained fire digs a pothole into. Past a budget of pieces, the rubble of
a long session shrinks away, what's least to be seen first.

It also sounds like it: a Web Audio engine for hundreds of short sounds placed in the world, a
binding that turns the destruction's events into breaks, knocks, shards, landings, rumbles and
bullet strikes, and a pack of sounds made for it (Stable Audio 3).

## Using it

```ts
import * as THREE from 'three/webgpu';
import { World } from 'three-avbd';
import { arch, cylinder, Destruction, groundPresets, presets } from 'breakable.js';

const world = await World.create({ renderer, maxBodies: 60_000 });
const destruction = new Destruction({
  world,
  scene,
  materials: {
    brick: presets.brick(), concrete: presets.concrete(), glass: presets.glass(), wood: presets.wood({ grain: { axis: 'v', stretch: 4 } }),
    asphalt: groundPresets.asphalt(), earth: groundPresets.earth(),
  },
  // A budget for long sessions: past it, rubble at rest shrinks away, what's out of view first
  maxPieces: 9_000,
});

// A ground that breaks, laid first: asphalt over earth in slabs, on the world's fixed ground body
// with its top moved down to road.bed under them (what stands on a slab goes with it)
const road = destruction.addGround({ material: 'asphalt', under: 'earth', area: [-20, -6, 20, 6], top: 0 });

// Build from boxes (or convex hulls): pieces that touch face to face are bonded
destruction.addBox({ material: 'brick', size: [3, 3, 0.3], position: [0, 1.5, 0] });
destruction.addBox({ material: 'concrete', size: [3.2, 0.25, 2], position: [0, 3.125, 0.85] });

// Beyond boxes: the hull of any points, with helpers for columns, gables, arches, round towers
destruction.addConvex({ material: 'concrete', points: cylinder(0.4, 1.2, 16), position: [4, 0, 0], smooth: 0.5 });
for (const v of arch(2.4, 0.5, 0.6)) destruction.addConvex({ material: 'concrete', points: v.points, position: [8, 3, 0] });

// Pieces that don't touch face to face (a bracket, a tilted stair stringer) can be bonded by hand
destruction.bond(stringer, landing, 0.02);

// Make what's built stand as built (strengthens bonds the intact structure leans on hard)
destruction.reinforce();

// Break things
destruction.explode({ at: [0, 1.5, 0.3], radius: 2 });
const hit = destruction.raycast(origin, direction); // exact, on the CPU: no GPU round trip
const shot = destruction.shoot(muzzle, direction, 6); // a bullet: what it struck, and whether it gave way (shot.broke)

// Or let things go by hand: a front off its building, a sign swinging from its bracket
destruction.release(front, [0, 0, 1.5]);
destruction.hinge(sign, [x, y, z], [0, 0, 1], { to: bracket });

renderer.setAnimationLoop(() => {
  world.update(dt);
  destruction.update(dt); // finishes blasts, weighs the structure, freezes rubble, uploads geometry
  renderer.render(scene, camera);
});

destruction.on('dust', (e) => /* turned to dust: a puff */);
destruction.on('debris', (e) => /* thrown but too small to be a body: chips, shards */);
destruction.on('collapse', (e) => /* a section came down */);
destruction.on('landed', (e) => /* a section or a heavy piece touched down: e.at, e.mass, e.speed */);
```

What else it does:

- **Letting go**: `loosen(piece)` (one piece, whole), `release(pieces)` (a section, its bonds to
  each other made joints), `push(piece, velocity)` (a loose piece, rubble or a prop), `unbond(bond)`
  and `reweigh()` (after weakening bonds from outside), `hinge(piece, anchor, axis)` (signs, doors,
  bells; it falls when what it hangs from goes). `loosePieces`, and a `'state'` event for every
  piece let go, come to rest, woken or gone.
- **Materials** (`BreakableMaterial`): physics (`density`, `friction`), how it breaks
  (`fragmentSize`, `minSize`, `dustSize`, `maxPieces`, `shatter` for glass, `reach` for how far a
  blast's pressure breaks it, `minBodySize` below which thrown pieces are particles, not bodies,
  `grain` for wood that splits into splinters along its boards, `landing` for tiles and pots that
  break where they land however light), how it stands (`support`: what its bonds carry per m²
  sideways or hanging; `compression`: how many times more pressed; `impact`: how hard a falling
  piece must hit it, and how many bullets it takes), how metal bends (`plastic`), whether it's
  heard (`audible`), and how it's drawn: `surface` (any node material, with its map, normal map,
  roughness and occlusion used), `inside` (the colour of broken faces) and `insideTexture` (their
  own maps, crushed brick or concrete's gravel), `uvScale` (one number or `[u, v]`), `uvJitter`
  (each block its own patch of the map), `tintMask` (where a piece's tint goes: the paint, not the
  rust) and `glow: 'standing'` (a neon tube or a lit window goes dark once knocked loose).
- **Pieces' looks**: in a material's surface nodes, `pieceState()` (standing, loose, rubble, broken
  face), `pieceTint()` and `pieceFrame()` (where on its block a point is, kept by its cells:
  drafted margins, flutes, undersides) read the piece being drawn. `smooth` shades curved pieces
  round; `textureFrame` lines maps up across pieces (and keeps a piece's look when it's made again).
- **Bullets**: `shoot(at, direction, power?, range?)` strikes the first standing piece, rubble,
  prop or loose piece (where it is now) and pushes what's free to move (`bulletPush`). Each round
  adds its power to what the piece has taken, and once that passes `bulletsToBreak(material,
  size)` (by its `impact` and size: a brick a few, a concrete block dozens, steel hundreds, at
  power 1) the piece breaks where it was struck, as a small blast of it alone, wider for a heavier
  round. Into a breakable ground a round bites: what's in its reach goes as spray and a chunk
  thrown up out of the hole to one side of the line of fire, and the rest of the slab stands round
  it in a few blocky cells, so sustained fire digs a ragged pothole rather than a heap of wedges.
  Props and static pieces never break. `materialKind` says what a material is for a strike's sound
  and look (brick, concrete, metal, wood, glass, dirt).
- **Breakable ground**: `addGround({ material, under?, bed?, area, top?, depth?, underDepth?,
  cell?, textureFrame?, toss? })` lays a road, a square or a field as slabs over a rectangle, a top
  layer over one under it, on the world's fixed bed (`Ground.bed`, its height; `bed` says what a
  pit's floor is made of, `Ground.bedMaterial`). A slab is held up only by what's under it; a blast
  leaves a crater and throws its chunks up and out round the rim; bullets bite into it.
  `groundPresets` has asphalt, cobbles, sand, paving, earth, gravel and fill; `groundAt(x, z)` is a
  ground's bed inside its area, `piece.ground` the ground a slab was laid as.
- **Rubble goes**: small rubble shrinks away into what it lies on once it has lain its material's
  `rubbleLife`, and past `maxPieces` (pieces in all; a field too, as `killBelow` is) so does the
  rest of what's at rest, up to about 25 pieces a second: out of the `viewer`'s view first (the
  scene's first camera), the smallest-looking first, the top of a pile before what's under it.
  What stands, props, and anything moving or hanging never go.
- **Bonds** form within 2 mm and 2.6° of facing each other, or as loosely as a piece says
  (`bond: { gap, angle }`: a dome's rings).
- **Shapes**: `cylinder`, `frustum`, `prism`, `ringSegment`, `arch`, `pointedArch` (Gothic),
  `arcBlock`, `domePiece`.

### Sound

```ts
import { SoundEngine, DestructionSounds, loadSoundPack, packMaterials } from 'breakable.js';

const engine = new SoundEngine();            // starts on the first click or key (browsers insist)
engine.listen(camera);
await loadSoundPack(engine);                 // public/sounds: blasts, breaks, impacts, ambience…
const sounds = new DestructionSounds(engine, destruction, {
  materials: { ...packMaterials, tile: { ...packMaterials.glass, pitch: 0.8, land: 'brick.impact.large' } },
});

destruction.explode({ at, radius: 2 });
sounds.blast(at, 2);                         // the bang, the debris raining after, ears ringing if close
const shot = destruction.shoot(muzzle, direction);
if (shot) sounds.bullet(shot.point, shot.material); // its crack, thunk or ping, a ricochet now and then

engine.play('ambience.city');                // loops wait for the first click
engine.play('rocket.loop', { follow: rocketMesh });   // moves with it, Doppler and all
engine.play('explosion.far', { at, delay: 1.4 });     // weighed when it reaches the ears

renderer.setAnimationLoop(() => {
  // …
  destruction.update(dt);
  sounds.update();                           // after destruction.update
  engine.update(dt);
});
```

- **The engine** (`audio.ts`) plays sounds of several takes each, a different one each time at a
  slightly different pitch. A sound placed in the world is panned, fades with distance, loses its
  treble to the air, arrives late (sound is slow: a blast 100 m off is heard 0.3 s after it's
  seen) and is wetter the further it is (a made-up street reverb: slaps off the facades, a darkening
  tail). Voices are limited: the quietest give way (a loop only to its own sound, so beds last
  through any blast), a sound repeated in the same place too soon is dropped, and sounds placed in
  the world more than 30 dB under the loudest one a moment ago aren't played at all (right after a
  blast, you don't hear the bricks); a delayed sound is weighed when it arrives, not when it's
  asked for. The listener's own sounds, in the head (a gun's shots, steps, the bed), have voices
  kept for them past the limit (`reserve`) and are never masked, so a burst into a busy street
  never loses a shot. Three
  buses: `sfx`, `debris` (the many small sounds, which a blast ducks so it punches through) and
  `ambience` (ducked too). A soft ceiling keeps the output under -1.4 dBFS. `deafen()` dulls
  everything and rings in the ears for a moment; `output` is the last node, to record what's heard.
  A `Voice` can be faded (`setVolume`), mixed apart from that (`setMix`) and sped up or slowed
  down (`setRate`: a windmill's clank in the gusts).
- **The binding** (`destruction-audio.ts`) listens to the destruction's events. Breaks crack where
  they happen; loose pieces knock or thud where they strike (`impact` events, louder for faster and
  heavier pieces, lower for heavier ones; a brick on a fire escape rings the iron too); shards and
  chips too small to be bodies patter where and when they'd land; sections rumble as they come down
  and grit trickles after; standing structure creaks as bonds give way, metal groans; a section of
  a material with a `land` sound lands as one thud, louder and lower the heavier, instead of its
  pieces' patter. A blast makes hundreds of events in a few frames, so events of a sound close
  together are one sound (louder for being many), each sound has an allowance per frame and per
  second, and a bouncing piece is heard once. Impacts come back from the GPU a readback at a time
  (several steps' worth): they're spread back over the steps they happened in, so a pile settling
  keeps its rhythm.
- **Materials** map to sounds with `MaterialSounds` (`break`, `impact`, `heavyImpact`, `debris`,
  `strain`, `collapse`, `settle`, `land`, `bullet`; `pitch` to share another material's sounds
  higher or lower, `heavy` for its own heavy threshold); `packMaterials` has them for the presets.
  A bullet's strike is the material's `bullet` sound, else `bullet.<kind>` of its `materialKind`.
- `Destruction`'s `audible` option (default 0.02, density × volume; a material may set its own)
  sets which loose pieces report their contacts for `impact` events, only while something listens
  for them.

### Props

```ts
import { loadPropPack } from 'breakable.js';

const props = await loadPropPack();          // public/models: GLBs with colliders and masses
destruction.addProp({ model: props.sedan, material: 'metal', position: [x, 0, z], rotation, tint: 0x96483c });
```

A prop is a model (any `Object3D`: a GLB's scene) on a body of its collider's convex hull, with
its model's mass. It rests (fixed, costing the solver nothing) until a blast throws it, something
strikes it or what it stands on goes, then tumbles and lands whole: props never break. A model may
collide as several convex parts welded into one (`colliders`: a forklift's body and forks), and a
round one as a 16-sided prism that rolls (`hullVertices`). Every copy of a model is one instanced
draw per part (`PropMesh`), each copy reading its body's pose from the solver's buffer in the
vertex shader, so a car thrown across the street moves smoothly between readbacks, and each copy
may have its own `tint` (on its paint alone, when the pack's pipeline masked it). The model's own
materials are kept, normal and emissive maps included. Rockets, bullets and the player's feet find
props with the same CPU raycast as everything else.

## How it works

- **Pieces** are convex polyhedra (`src/lib/convex.ts`): exact plane cuts, each cut face marked as
  broken so it draws with the material's inside. Standing pieces are fixed bodies in the solver,
  which cost it next to nothing.
- **Bonds** (`contact.ts`) are the area two pieces share face to face. They decide what holds up
  what.
- **Fracture** (`fracture.ts`): Voronoi cells of seeds drawn so their distances from the hit have a
  set median, which packs them near the break (stretched along the grain for wood). Cells go to the
  solver as hulls built straight from their faces (`hull-shape.ts`, matching three-avbd's own mass
  properties, at half the cost of rebuilding them from points). Every blast, hit and bullet shares
  one breaking budget a frame (`frameBudget`, 4 ms): the nearest pieces break at once, the rest
  over the next frames.
- **Bullets** (`bullets.ts`, `Destruction.shoot`): a ray against the standing pieces' grid and
  the loose pieces where they are now; the damage a piece has taken is kept per piece, and a break
  is a small blast of the struck piece alone (and, for a heavier round, of the pieces right round
  the hit), so it goes through the same budget, weighing and events as any blast. A slab of a
  breakable ground is cut as a bite instead (`bite()` in `destruction.ts`): a few seeds packed
  where it was struck and six more round them, above, below and four ways across the ground, so
  the bite is about a cube and what's left of the slab a few blocky cells whose cuts run straight
  out from the hole; what would stand as a sliver or a wedge by the hole goes as spray.
- **Breakable ground** (`ground.ts`): slabs whose bonds sideways are cut once laid, so each is held
  up only by what's under it, down to the bed; what a blast breaks out of a ground goes up and out
  along a cone (steeper from the crater's middle than its edge) once all the ground it reached is
  broken, passing through the crater's sides for a moment on the way out, so it lands round the rim
  instead of falling back in.
- **Collapse** (`destruction.ts`): after every change, what doesn't reach the ground (or a static
  piece) through bonds falls as connected sections, their bonds made breakable three-avbd joints
  (plastic ones for metal, so railings bend). Then the structure is *weighed*: each standing
  piece's weight flows toward the ground along its bonds, shared by what each can carry (pressed
  far more than sideways or hanging), and where in plan it bears: a piece whose weight has moved
  off what it stands on tips, and a span that lost a column comes down instead of standing as a
  shelf. Bonds asked for more than they can give break, round after round, so an undermined facade
  peels away a moment after the blast, not all at once. A section let go turns over the edge it's
  out past.
- **Impacts**: heavy falling pieces report contacts (three-avbd's GPU contact events). Striking
  standing structure hard enough breaks it there, a big piece that lands hard enough
  (`shatterSpeed`) breaks itself into chunks that carry on with its motion, and so does any piece
  of a material with a `landing` speed. A section or a heavy piece touching down is one `landed`
  event. A blast can cut what's already falling (`explode({ loose: true })`, as the demo's rockets
  do), where it is now, not where it was last read back.
- **Small stuff is particles**: cells a blast throws that are smaller than `minBodySize` (most
  glass, the smallest chips) never become bodies. They're `debris` events. Hundreds of tiny
  hulls cost the solver more than they show.
- **Reinforce**: `reinforce()` weighs the structure as built and strengthens any bond it leans on
  hard, so a roof carries its water tank. The extra strength is for the load as built: damage
  that sends more weight down a path overloads it, so what's undermined still falls.
- **Rubble** is read back a few times a second; pieces at rest over what holds them up (the
  ground, the scenery, what stands, other rubble: `support.ts`) are frozen back into fixed bodies,
  and wake when what they rest on goes (or the next blast). Rubble that came to rest joined stays
  joined; a piece jammed against what stands drops clear. Small rubble shrinks away after a while
  unless something rests on it, and past `maxPieces` the rest at rest goes the same way, drawn
  smaller each frame into the point under its middle: the rubble is kept as a set as pieces change
  state, so none of this looks at every piece every frame. Nothing loose goes faster than 40 m/s
  (`maxSpeed`), nor further in a step, and no contact pushes harder than that allows, so nothing is
  flung kilometres; round pieces and props roll a little way and stop (`rolling`), and what's flung
  far is taken out (`killBelow`, `killBeyond`).
- **Drawing** (`fragment-mesh.ts`): one draw per material for every piece. Each vertex carries its
  body's slot and the vertex shader reads the pose from the solver's buffer, as three-avbd's
  BodyMesh does. Unlike BodyMesh, every piece can be a shape of its own. Texture coordinates are
  box-projected in each piece's own frame, so maps stay on the pieces as they fly; a record per
  piece (its state, its texture frame and box) is uploaded only where it changes, for the
  surfaces that read it.

## The solver

three-avbd is vendored because the npm release (0.3.0) predates the two-level broadphase grid and
fixed-body probe skipping (Oct 2026), which a mostly standing, partly broken city leans on. It
resolves through the `three-avbd` alias (`vite.config.ts`, `tsconfig.json`), so switching to the
next npm release is a one-line change, once it has what the patches add.

It carries eleven local patches, each listed in `vendor/three-avbd/VENDORED_COMMIT` with where it
is, what it does, why, and a repro to report it upstream by:

- a removed body's slot waits a step before a new body takes it (reused at once, the new body took
  over the old one's warm starts and contacts);
- the broadphase grid in levels by size (Sun Temple's ~1,100 fixed cliff hulls had made its cells
  32 m: collision 1.8 ms a step, then 0.3);
- a speed limit (`World.maxSpeed`) on moves and on contact pushes, so a light piece jammed between
  heavy ones isn't flung kilometres;
- friction where a contact slips (`slipFriction`: light pieces slid on as if on ice), deep
  penetration pushed out (`pushOut`), speculative contacts with fixed bodies (`speculative`: thin
  pieces thrown at the ground went through it) and sliding over the seams of flush fixed bodies
  (`seams`), each on by default and switchable;
- substeps collide again (a copied manifold flung light pieces);
- rolling resistance per body (`BodyOptions.rolling`);
- the prefix scan's pipelines made once per device, and the contact-event pass made when a
  listener subscribes (both compiled mid-game before).

`scripts/solver-lab.mjs` checks the solver's behaviour in Chrome, seven cases with thresholds.
