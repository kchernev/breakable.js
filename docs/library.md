# The library

Breakable.js is `src/lib/` (its exports: `index.ts`). Back to the [README](../README.md).

Structures are convex pieces bonded where they touch. A blast cuts what it reaches into Voronoi
cells (small at the hit, bigger further off), throws the near ones, and whatever no longer carries
its weight to the ground falls: whole sections at a time, turning over the edge they're out past,
held together by joints that break when they land. Bullets chip what they strike and, once it has
taken enough, break it where they hit. The ground can break too: a road or a square laid as slabs
that a blast craters and sustained fire digs a pothole into. What's further off can stand as
scenery, costing nothing, until a blast or a round reaches it and it's built as pieces (dormant
things). A prop can break into shards cut from its own mesh. Past a budget of pieces, the rubble
of a long session shrinks away, what's least to be seen first.

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
  Static pieces never break, nor do props without shards (a prop with them takes its `rounds`, then
  flies apart: "Props", below). `materialKind` says what a material is for a strike's sound and
  look (brick, concrete, metal, wood, glass, dirt).
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
  What stands, props (but the pieces of a broken one), and anything moving or hanging never go.
- **Bonds** form within 2 mm and 2.6° of facing each other, or as loosely as a piece says
  (`bond: { gap, angle }`: a dome's rings).
- **Static pieces and anchors**: `static: true` (`PieceOptions`) never breaks or moves, and holds
  up what's bonded to it (a foundation, an unbreakable neighbour). `anchor: true` (`piece.anchor`)
  holds up what's bonded to it as the ground does, needing nothing under it, but breaks as any
  piece, and what it breaks into stands or falls as pieces do: a platform's slabs over the hollow
  its steps hide (Sun Temple's).
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

const props = await loadPropPack();          // public/models: GLBs with colliders and masses (and shards)
destruction.addProp({ model: props.sedan, material: 'metal', position: [x, 0, z], rotation, tint: 0x96483c });
const hydrant = destruction.addProp({ model: props.hydrant, material: 'metal', position: [x, 0, z] });
destruction.breakProp(hydrant, at);          // by hand: its shards fly apart from `at`
```

A prop is a model (any `Object3D`: a GLB's scene) on a body of its collider's convex hull, with
its model's mass. It rests (fixed, costing the solver nothing) until a blast throws it, something
strikes it or what it stands on goes, then tumbles and lands whole. A model may collide as
several convex parts welded into one (`colliders`: a forklift's body and forks), and a round one
as a 16-sided prism that rolls (`hullVertices`). Every copy of a model is one instanced draw per
part (`PropMesh`), each copy reading its body's pose from the solver's buffer in the vertex
shader, so a car thrown across the street moves smoothly between readbacks, and each copy may have
its own `tint` (on its paint alone, when the pack's pipeline masked it). The model's own materials
are kept, normal and emissive maps included. Rockets, bullets and the player's feet find props
with the same CPU raycast as everything else.

A prop without shards never breaks: it's thrown, tumbles and takes marks. A model with them
(`PropModel.shards`: the pieces it breaks into, each a prop of its own in the model's frame)
breaks:

- **Rounds**: each adds its power to what the prop has taken, and at its `rounds` (rounds of power
  1; default as many as a piece of its material half its size would take, at most 60) it flies
  apart from where the last one struck, pushed along the round's way (`shot.broke`).
- **Blasts**: a blast breaks a prop within 0.85 of its radius (`PROP_BREAK`), the shards thrown as
  it throws what it breaks; further off, the prop is thrown whole.
- `breakProp(piece, at, { blast?, along? })` does it by hand: the prop goes (its welded parts with
  it), its shards are added where it was, each moving as that point of it moved, and thrown by
  `blast` or pushed `along` and apart from `at`; it returns them, and emits `'fracture'` (`{ piece,
  pieces, at }`). `propFrame(piece)` is where a prop's model frame is now.
- Its shards are props marked `debris`: they don't break again, and at rest they're rubble the
  budget clears, as any piece's.
- `loadPropPack` loads a model's shards when its `index.json` entry has `shards: { file, parts: [{
  node, collider, mass }] }`: a GLB beside it (`<name>.shards.glb`, made by
  `scripts/assets/shatter-props.py`: the Voronoi cells of its mesh, their cut faces filled) holding
  only their shapes, which wear the prop's own materials, by name.

### Cars

```ts
import { addVehicle, loadVehicles, vehiclePresets } from 'breakable.js';

// What a car is made of (under these names, or give addVehicle your own)
const materials = { ...yours, carbody: vehiclePresets.carbody(), carglass: vehiclePresets.carglass(), tyre: vehiclePresets.tyre(), bumper: vehiclePresets.bumper() };
const cars = await loadVehicles();          // public/models/cars: the sedan, the taxi, the van and the GT15, in parts
const car = addVehicle(destruction, cars.sedan, { position: [x, 0, z], rotation, tint: 0x8b1e1e }, {
  latch: (car, part, at) => {},             // a door, the hood or the trunk lid sprung open
  tyre: (car, wheel, at) => {},             // a tyre shot out
  tank: (car, at, holes) => {},             // its fuel tank holed
});
car.shot({ piece: hit.piece, at: hit.point, direction });   // each round that strikes any piece of it
car.blast(at, radius);                                       // after destruction.explode, near it
car.burn();                                                   // burnt out: black
```

A car is its body, with its insides (seats, dash, floor, engine), and its parts on it, each a prop of its own:
four doors, the hood and the trunk lid on latches, four wheels, two bumpers, any trim (a taxi's roof
sign); and its windows, each a pane of tempered glass (`carglass`: a round and it's gone to small
cubes). At rest it's one, costing nothing: its parts bonded to its body, its panes welded into what
they're set in, all of it at rest as a prop is. A blast or a hard knock wakes it and it moves as
one, its bonds joints of painted sheet steel that bend before they tear: a bumper hangs off by a
corner before it drops.

- **Rounds** (`car.shot`): a tyre goes at the first (the wheel is made again on a squashed tyre, and
  the car settles onto its rim; a car in the air keeps it as it flies); a door, the hood or the trunk lid takes five to nine before its
  latch springs and it swings open on its hinge, outward, until a hard enough pull tears it off; a
  round on through the car past its tank holes it (what follows is the world's: `tank`). A round that
  struck a door with its window frame, or the cabin, through one of the panes breaks that glass.
- **Blasts** (`car.blast`, after the Destruction's own has thrown the car as one): what's within
  0.9 of the radius of it is torn off, the latches within 1.8 spring, the tyres in its heart go.
- A car's hulls overlap (the cabin's is solid, its doors and wheels lie in its body's), so its pieces
  don't collide with each other: each car is in one of eight collision groups, in turn (cars parked
  in a row get different ones), and collides with everything else, other cars too.
- `vehicleOf(piece)` is the car a piece is part of; `car.partOf(piece)` which part.
- A car's `tint` goes where its model says (`tintMask`): under its colour map's alpha (the props'
  paint mask), or on its materials named paint (the GT15's, white under the tint, clear coated).
  Without one, the model's own (`tint` in its index.json entry), else as it's drawn.

They're made by `scripts/assets/process-cars.py` from the prop pack's cars and a Blender file
([Assets](assets.md#the-cars)). The library gained what they needed, for anything:
`PieceOptions.rest` (a convex piece at rest as a prop is, joined only to what it's bonded to: a
car's window), `Destruction.shootPiece` (a round striking a given piece, whatever hull is round it),
`Destruction.retint` (a piece's tint, anew), a prop added already moving (`PropOptions.velocity`,
`spin`), a bond made between two loose pieces held by its joint at once, a prop model's
`tintMask: 'paint'` (its tint on its paint alone), a physical material's clear coat kept and turned with its body, and a shattered
piece's cells keep its collision groups.

### Dormant things

```ts
import { type Dormant } from 'breakable.js';

// A tower down the street: drawn as a box, solid as a fixed one, built as pieces once reached
const standIn = world.addBox({ size: [12, 40, 12], position: [60, 20, 0], fixed: true });
const tower: Dormant = destruction.addDormant({
  name: 'tower',
  bounds: { min: [54, 0, -6], max: [66, 40, 6] },
  bodies: [standIn],                        // taken out of the world as it wakes
  hide: () => towerMesh.removeFromParent(), // its stand-in goes
  build: (d) => buildTower(d),              // its pieces (addBox, addConvex...), made as it wakes
});
destruction.on('wake', (e) => /* e.dormant made into e.pieces */);
destruction.awaken(tower);                  // by hand: its pieces, now
const met = destruction.wakeAlong(rocket.position, rocket.direction, step); // a projectile, each step
```

A dormant thing (`addDormant(options)`, `DormantOptions`) is something that breaks, standing as
scenery until something reaches it: drawn by its stand-in (a mesh, an instance) and solid as its
stand-in's fixed bodies (`bodies`), it costs what scenery costs. A blast wakes what's dormant
within 1.25 of its radius (`DORMANT_REACH`) before it breaks anything, so it breaks the pieces as
it would any. `shoot()` wakes the nearest dormant thing its ray enters before what it strikes,
casts again into its pieces, and goes on to the next only if it passes through them (a gap, a
doorway); `wakeAlong(at, direction, range)` is that same walk for anything else that flies (the
demo's rockets call it each step), and returns what the ray meets, as `raycast()` does. A dormant
thing needs no body: a round or a rocket passing through its `bounds` wakes it and meets its pieces
(a tree, a bush). `blastOnly` ones wake only for blasts, and rounds strike their stand-in as
scenery (a stretch of ground: each round would lay it). `rayBox` (`math.ts`) is where a ray enters
a box.

- **Waking** (`awaken(dormant)`, which returns its pieces; `dormant.woken` once done): its
  `bodies` are taken out of the world, `hide()` takes its stand-in away, and `build(d)` makes its
  pieces, which are strengthened to stand as built (as `reinforce()` does, for them alone). What
  rested on its stand-in rests on its pieces now. Then the `'wake'` event (`{ dormant, pieces }`),
  and what's in its `with` list wakes after it.
- **What's on it**: a piece standing on the top of a fixed body in the world that isn't a piece (a
  dormant thing's stand-in, a quay wall) is on the ground, as one on a breakable ground's bed
  reaching its area is. A piece that leaves `'fixed'` wakes what's dormant resting on its top at the
  next `update()` (an upper section over one that gave way).
- **Its cost**: waking weighs only what its pieces are joined to (`weigh(within)`), and brings the
  scenery's shapes up to date rather than making them again: a house of 57 panels wakes in about
  3 ms among 8,000 pieces. A material only woken things use has no mesh, and so no shaders, until
  the first wakes (a frame of a quarter to half a second): `warm()` makes each material's mesh with
  a piece of it out of sight under the world, and returns what takes those pieces out again; draw a
  frame between the two, before play (the demo does, with its shader warm-up).

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
  piece, or an anchor) through bonds falls as connected sections, their bonds made breakable
  three-avbd joints (plastic ones for metal, so railings bend). Then the structure is *weighed*:
  each standing piece's weight flows toward the ground along its bonds, shared by what each can
  carry (pressed far more than sideways or hanging), and where in plan it bears: a piece whose
  weight has moved off what it stands on tips, and a span that lost a column comes down instead of
  standing as a shelf. Bonds asked for more than they can give break, round after round, so an
  undermined facade peels away a moment after the blast, not all at once. A section let go turns
  over the edge it's out past.
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
