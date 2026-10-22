# Assets and credits

What the demo is made of, how it was made and how to remake it, and who made what. Back to the [README](../README.md).

## The sounds

`public/sounds/` (5.4 MB of MP3): 49 sounds in 208 takes and slices, generated for this project
with Stable Audio 3 Medium on fal.ai, then cut and levelled by script. The launcher, the rocket's
motor and fly-by, near and distant explosions, debris raining; the machine gun's shots, its echo,
brass casings, bullets striking brick, concrete, metal, wood, glass and dirt, ricochets, and a
reload and an empty click the demo doesn't use (`docs/changelog/phase-e/gunsounds.md`); brick,
concrete, glass, wood and metal breaking and striking; a collapse's rumble, creaks, settling dust;
footsteps on asphalt and on rubble, landing; city ambience, wind, a car alarm, distant sirens,
fire; a bird shot out of the air; a car's door and its hood springing open, a tyre bursting, petrol
running out of a holed tank and catching. The paid calls are in `assets-src/sounds/ledger.jsonl` (from the gun's sounds on). Each
world adds its own in `public/packs/<id>/sounds/`; `sounds.html` plays every pack, a world's at
that world's levels.

To remake or extend it (the prompts are in `scripts/assets/sounds.mjs`; each take's prompt, seed
and model are kept next to it in `assets-src/sounds/`; `PACK=<id>` works on a world's pack):

```sh
FAL_KEY=… pnpm sounds:generate        # what's missing; --redo name:i to replace a take
FAL_KEY=… pnpm sounds:qa              # an audio model describes each take: music? voices? glitches?
pnpm sounds:process                   # trim, loop, slice footsteps, level, mono, MP3 + index.json
```

Shots are trimmed of silence (or cut to the rise into their loudest part) and faded out; loops
have the model's own fades cut off and their end crossfaded into their start; footsteps come as
one take of a walk, cut at each step. Sounds placed in the world are mono, the player's own
stereo; everything is levelled by its loudest 400 ms (never past -1 dBFS). Every world's bed is
about -33 LUFS standing at its start, its steps as loud as Brick Street's.

## The textures

Besides the Poly Haven sets, `public/textures/gen_*` were made for this project with GPT Image 2.5
(fal.ai) and made to tile in code (`scripts/assets/process-textures.py`): dark brown brick and
brick painted cream (2 m tiles, the bricks re-laid on an exact running bond so every join falls in
the mortar), NYC sidewalk flags, broken brick and broken concrete (for broken faces), black-painted
iron chipped to rust (the fire escapes), weathered painted boards. Each has colour, OpenGL normal
and packed occlusion/roughness/metalness maps, derived from the colour. The worlds' own sets are
made the same way, in `public/packs/<id>/textures/`.

```sh
FAL_KEY=… node scripts/assets/generate-textures.mjs   # the raw images that are missing
python3 -I scripts/assets/process-textures.py         # seamless, then the maps
```

## The props

The street's props (`public/models/`) and each world's (`public/packs/<id>/models/`) are GPT Image
2.5 concepts made 3D by Meshy 7.1 or Tripo P2 and finished in Blender by
`scripts/assets/process-props.py`: welded, squared to the axes, scaled to their real size,
decimated, their paint made tintable, a convex collider each. `docs/making-a-world.md` has the steps
and the fields of a pack's `props.mjs`.

Each prop also has the pieces it breaks into, beside it as `<name>.shards.glb`
(`scripts/assets/shatter-props.py`). Its mesh, welded so the image-to-3D model's cracks close, is
cut into the Voronoi cells of seeds spread over its surface (as far apart as they can be, 5 to 14
of them by its size), each cut filled flat in the colour inside it (its colour map's average,
duller and darker: the `<name>.inside` material). The file holds only the pieces' shapes: they keep
the prop's UVs and its materials by name, and the game takes those from the prop. Its `index.json`
entry gets `shards`: the file, and each piece's `node`, `collider` (the hull of its points, at most
16) and `mass` (the prop's, shared out by the hulls' volume); `process-props.py` writes the entry
back in the same layout. A prop broken (`Destruction.breakProp`, `src/lib/destruction.ts`) is
swapped for its pieces. 24 props have them, 44 KB to 1.5 MB a file (16.5 MB in all); the kit's
weapons and the base pack's taxi, sedan and van (the street's cars come apart instead) have none.

```sh
blender -b --factory-startup --python scripts/assets/shatter-props.py -- [pack ...] [--only=name,name]
```

`pack` is `base` (`public/models`) or a pack's id; with none, every pack. Processing a prop again
with `process-props.py` makes its entry anew, without its `shards` (`--colliders` keeps them), so
it is shattered again after.

## The cars

`public/models/cars/` holds four cars cut into the parts they come apart into
(`src/lib/vehicle.ts`), each with a cabin made to fit it: the sedan, the taxi and the van, modelled
by script in Blender for this project, and the Ubix GT15, a made-up sports car, from its own
Blender model. With their insides they're 120k (the van), 138k (the sedan), 144k (the taxi) and
145k (the GT15) triangles; 3.9 to 6.1 MB a car (its `.gltf` and `.bin`), their textures shared in
`textures/`.

- **Modelled by script** (`scripts/assets/car_model.py`, from the designs in
  `scripts/assets/car_designs.py`): the sedan, a modern mid-size saloon (creased along its shoulder
  and belt, its head and tail lamps wrapping round its corners, a chrome strip along the belt,
  19-inch double-spoke alloys); the taxi, a full-size cab in a Crown Victoria's shape (a checker
  stripe along its sides, a roof sign reading TAXI, 16-inch steel wheels under chrome caps); the
  van, a high-roof panel van in a Transit's shape (a sliding door on its right, two barn doors at
  the back, black bumpers and cladding along its foot, steel wheels). A body is one surface, lofted
  along the design's lines (the sill's, the shoulder's, the belt's, the glass's, the roof's: Hermite
  curves through their points, turning sharply at the creases) through its stations across them
  (the doors' seams, the windscreen's foot, the roof's end) and closed at each end by a Coons patch;
  its right half is drawn, then mirrored and welded to it. Each cell between two lines and two
  stations is a region (a door, the hood, a pane, a pillar's black), so every seam runs along a line
  or a station. The wheel arches are cut out of it, and the rest cut into it by projecting an
  outline from the front, the rear, the side or the top: the lamps (sunk in, with lenses and lit
  bands), the grilles and intakes (with their slats), the plates' recesses, grooves pressed in
  and painted areas (the checker stripe, the black trim). The panes are set in a black surround and
  the parts gapped and lipped where they meet; then come the wheels (tyres, alloy or steel rims,
  brake discs and calipers) and the details: mirrors, door handles, number plates with their
  characters, wipers, exhausts, the sedan's aerial fin, the van's step and its barn doors' hinges.
  The paint is white under each copy's tint (`tintMask: 'paint'`), clear coated. The shapes were
  drawn up against 8 reference pictures in `assets-src/cars/refs/` (the sedan and the van from the
  side and three-quarters front and rear, the taxi from the side and three-quarters front), made
  with GPT Image 2.5 and used only for reference; `--views` renders a model from the same sides into
  `assets-src/cars/<name>/views/` to set beside them. Each car goes to
  `assets-src/cars/<name>/source/<name>.blend`, its parts already objects of their own, named for
  `process-cars.py`.
- **Into parts** (`process-cars.py`, by way of `car_blend.py`): each car's file opened, its
  modifiers applied; its objects are its parts (the doors, the hood, the trunk lid, the bumpers, the
  wheels, the cab's roof sign), its glass material's islands its panes, each a glass piece of its
  own (a hull 6 mm thick). The GT15's file is its own (`assets-src/cars/gt15/source/`): scaled to
  its real size, its doors one mirrored object split down the middle, its materials set to export as
  they look (its paint white under each copy's tint, clear coated; its tyres' colour ramp baked into
  a texture), and each part's faces cut down by its role's share (`decimate`).
- **The insides** (`car_insides.py`), from each car's `cabin`: front seats and a rear bench in
  leather, quilted leather or cloth, a dashboard with lit gauges under a hood, a screen and vents,
  the steering wheel, the console and its gear lever, carpet and pedals, a headliner following the
  roof, visors, mirror and belts, the door cards, and the inside of the body where it's seen from the
  seats lined in plastic; a cab's partition and meter, a van's cargo bay in plywood. Under the hood
  (or the GT15's rear deck) an engine, in the trunk a lining round a spare wheel, under each lid its
  underside. They're lined with the `cars` texture pack (`public/packs/cars/textures`): GPT Image
  2.5's leather, cloth, carpet, plastic, headliner and plywood made to tile, a quilted leather and a
  carbon weave drawn in code, and its pictures of the gauges and the screen.

The body collides as two hulls, under its waist and its cabin (its glass and its roof), each 4 cm in
from its skin so a round meets a door, a wheel or a pane first.

```sh
blender -b --factory-startup --python scripts/assets/car_model.py -- [name ...] [--views]   # the sedan, taxi and van as .blend files
PACK=cars FAL_KEY=… node scripts/assets/generate-textures.mjs           # the insides' surfaces
PACK=cars python3 -I scripts/assets/process-textures.py
blender -b --factory-startup --python scripts/assets/process-cars.py -- [name ...]   # the parts, index.json, previews
```

A new car is a design in `car_designs.py` (its lines, stations, regions, features, wheels and
details) or a Blender file of its own (`blend`, `objects`, `looks`), and an entry in `cars.mjs`:
its hinges, waist and roof, cabin, engine and trunk boxes, fuel tank and tint. Then its views are
set beside its references, and the previews in `assets-src/cars/previews/` looked at: as it stands,
from the driver's seat, through its open doors, its engine bay, and pulled apart.

`process-cars.py` can still cut a prop of the pack into parts from Hunyuan 3D v3.1's split of it
(`split-cars.mjs`, on fal.ai), as the first sedan, taxi and van were made; no car comes from a prop
now, and those splits (`assets-src/cars/<name>/split/`) are no longer used.

## The asset sources

`public/` holds everything the demo loads, and is in git as it is (about 175 MB, no file over
6 MB). What it was made from, `assets-src/` (every take, concept image and raw model: about
1.2 GB), is not: git keeps only its notes (`.json`, `.jsonl`, `.md`: each take's prompt, seed and
model, the picks, the ledgers of paid calls). The files themselves are attached to a GitHub
release, one archive per pack, listed with their files and checksums in `assets-src/sources.json`.
They're only needed to redo or re-cut an asset:

```sh
pnpm sources:fetch                # download and unpack what's missing (or: pnpm sources:fetch medieval,kit)
pnpm sources:pack --tag sources-v2   # after new takes: archives into release/, and sources.json
gh release create sources-v2 release/sources-*.tar --title "Asset sources" --notes "assets-src's raw files"
```

A fetch leaves files that are already there as they are, and checks each archive's checksum.
The screenshots the worlds' checks took (a pack's `review-*`, `fix-*`, `shots/` and `phase-*/`
folders, about 950 MB, which the world READMEs cite) are in neither git nor the release.

## Credits

- **three-avbd**: MIT, © Steven Bobyn (an implementation of Augmented Vertex Block Descent, Giles,
  Diaz, Yuksel, SIGGRAPH 2025).
- **Skies**: all from [Poly Haven](https://polyhaven.com), CC0. Qwantani afternoon and late
  afternoon (the base pack, by way of
  [three-voxel-destruction](https://github.com/sbobyn/three-voxel-destruction)); Syferfontein 6d
  Clear (Market Town), Goegap and Qwantani Noon (Dust Town), Kloppenheim 07 (Neon Alley),
  Kloofendal Overcast (Harbor Yard), Pizzo Pernice, graded deeper blue by script (Sun Temple). By
  Greg Zaal, Jarod Guest and Andreas Mischok.
- **Textures**: photographed sets from Poly Haven, CC0, by Dimitrios Savva, Dario Barresi,
  Charlotte Baglioni, Amal Kumar and Rob Tuytel: the base pack's brick, concrete, plaster and
  asphalt, Market Town's cobbles, trail (Brick Street's and Neon Alley's earth too), roof, slate
  wall, limewash (regraded) and planks, Sun Temple's marble rock and cliffs, rough wood and willow
  bark. The rest (the base pack's `gen_*` and 36 sets in the worlds' packs, six of them for the
  breakable grounds: Dust Town's earth and broken dirt, Harbor Yard's gravel and broken slab, Sun
  Temple's earth, taken again for crumblier soil, and fill; and seven for the cars' insides) were
  generated for this project with OpenAI's GPT Image 2.5 on fal.ai, from text prompts alone, and
  made to tile and into maps by script. The cars' quilted leather and carbon weave are drawn by
  script.
- **Sounds**: generated for this project with Stability AI's Stable Audio 3 Medium on fal.ai, from
  text prompts alone (no recordings or sound libraries; fal.ai describes the model as trained on
  licensed data, for commercial use), each take checked with fal's audio-understanding model or, for
  most of those made for the worlds' answers to the gun, by its spectrogram and envelope: the base
  pack's 49 (the machine gun's 12 among them: its shot, echo, casings, six bullet strikes, ricochet,
  reload and empty click; and a bird struck, and five for the cars coming apart), 15 to 18 in each world's pack but Brick Street's, and four in Brick
  Street's (pigeons taking off, an air conditioner's gas hissing out, a lamp shorting, a tank
  leaking). The others for the gun: Market Town's bell struck and a sign creaking on its rings,
  Dust Town's bell struck, a tank spurting and its stream, Neon Alley's sign dying, lamp popping
  and steam bursting, Harbor Yard's fuel and drum leaks and spilt fuel catching, Sun Temple's
  bronze ringing and a burst's echo off the bay. Some were finished by script: Dust Town's tin
  crashes layered and its boardwalk steps mixed from its own takes, Brick Street's iron steps from
  the base pack's and its air conditioner's take laid out clank first, the machine gun's reload laid
  out from its takes' moves, its echo cut from after a shot's crack, Neon Alley's rain equalised
  and its lamp's pop cut from its hum, a stream's rumble cut in Dust Town, the bay's echo trimmed
  of its first 150 ms. Neon Alley's sign buzz is synthesised (numpy).
- **The cars in parts**: the sedan, the taxi and the van are original models made for this
  project, modelled in Blender by script (`scripts/assets/car_model.py`, their designs in
  `car_designs.py`): no image-to-3D, scanned, stock or third-party models, so no licence but this
  project's own (MIT). No maker's name, badge or logo is on them; their only lettering is the
  cab's TAXI and the made-up number plates, in Blender's own font. Their shapes were drawn up
  against 8 reference pictures generated for this project with OpenAI's GPT Image 2.5 on fal.ai,
  from text prompts alone, used only for reference and not shipped (`assets-src/cars/refs/`). The
  Ubix GT15 is a made-up sports car, the Blender model of this project's authors' own game (*Ubix
  GT15 Nordschleife*). Every car's insides are made in code, lined with the `cars` pack's
  textures: seven of GPT Image 2.5's made to tile, two drawn in code, and its gauges and screen.
- **Models**: made for this project with generative AI and cleaned up in Blender (no scans, stock
  models or photographs; made-up lettering and badges painted out): concept images with GPT Image
  2.5, then image-to-3D, Meshy 7.1 for the base pack's street props (cabs, sedan, van, hydrant,
  trash can, mailbox; the street's cars that come apart are the scripted models above) and Tripo
  P2 for every world's (Market Town's barrels, carts, hay wagon and baskets; Dust Town's wagon,
  safe, pump and rocking chairs; Neon Alley's scooter, hawker cart and bin; Harbor Yard's
  forklift, yard tractor, drum and reel; Sun Temple's statue, tripod, amphora and lion) and for
  the player's kit: the launcher, the rocket and the machine gun (a made-up light
  machine gun in the launcher's olive drab: no real weapon's design, no maker, no markings; its
  roughness remapped and its magazine cut out as a mesh of its own by script). Neon Alley's plastic
  crates are procedural. The pieces the props break into are cut from the props' own meshes by
  script (`scripts/assets/shatter-props.py`).
- **Made in code**: Neon Alley's glyph atlas (a made-up script, no real letters or brands), Dust
  Town's painted signs (marks that read as lettering but aren't), the mesas, scrub, birds and the
  skylines, and the cars' insides (`scripts/assets/car_insides.py`: the seats to the engines).
- **fal.ai spend**, every ledger (`assets-src/packs/*/ledger.jsonl`,
  `assets-src/packs/mix-ledger.jsonl`, `assets-src/sounds/ledger.jsonl`, `assets-src/cars/ledger.jsonl`):
  **$52.88** in 747 calls: Tripo P2 $22.00 (23 models), GPT Image 2.5 $14.02 (80 images), Stable
  Audio 3 $10.90 (290 takes), audio understanding $5.90 (350 checks), Hunyuan 3D's part splitter
  $0.06 (4 splits, at a unit a split: its units aren't reported to this key; of the first cars,
  made from the props, and no longer used). The birds and the cars cost $4.37 of it: 19 takes, 19
  checks, 4 splits, the 9 images of the cars' insides ($1.80) and the 8 reference pictures of the
  sedan, the taxi and the van ($1.60, $0.20 each), the images estimated as the worlds' textures
  are. By pack: Dust Town $9.04, Harbor Yard $8.97, Market Town $8.68, Sun Temple $7.86, Neon
  Alley $7.23, the kit $3.85 (the machine gun $1.28 of it), the base pack's machine gun sounds
  $2.59, the cars' insides $1.80, the cars' reference pictures $1.60, Brick Street $0.19, the mix
  check $0.11. Phase F (the worlds' answers to the gun, and Sun Temple's crater earth) cost $1.50
  of it: 40 calls, 33 takes, one image and six checks. The base pack's first 31 sounds, its textures and its props,
  made before the ledgers, aren't counted.

Each pack's `CREDITS.md` (`public/packs/<id>/`, `public/models/`, `public/models/cars/`,
`public/textures/`, `public/hdri/`) lists every asset, what it is and how it was made; the base sounds' prompts are in
`scripts/assets/sounds.mjs`.
