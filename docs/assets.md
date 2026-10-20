# Assets and credits

What the demo is made of, how it was made and how to remake it, and who made what. Back to the [README](../README.md).

## The sounds

`public/sounds/` (4.7 MB of MP3): 43 sounds in 192 takes and slices, generated for this project
with Stable Audio 3 Medium on fal.ai, then cut and levelled by script. The launcher, the rocket's
motor and fly-by, near and distant explosions, debris raining; the machine gun's shots, its echo,
brass casings, bullets striking brick, concrete, metal, wood, glass and dirt, ricochets, and a
reload and an empty click the demo doesn't use (`docs/changelog/phase-e/gunsounds.md`); brick,
concrete, glass, wood and metal breaking and striking; a collapse's rumble, creaks, settling dust;
footsteps on asphalt and on rubble, landing; city ambience, wind, a car alarm, distant sirens,
fire. The paid calls are in `assets-src/sounds/ledger.jsonl` (from the gun's sounds on). Each
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

## The asset sources

`public/` holds everything the demo loads, and is in git as it is (about 120 MB, no file over
2.5 MB). What it was made from, `assets-src/` (every take, concept image and raw model: about
940 MB), is not: git keeps only its notes (`.json`, `.jsonl`, `.md`: each take's prompt, seed and
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
  Temple's earth, taken again for crumblier soil, and fill) were generated for this project with
  OpenAI's GPT Image 2.5 on fal.ai, from text prompts alone, and made to tile and into maps by
  script.
- **Sounds**: generated for this project with Stability AI's Stable Audio 3 Medium on fal.ai, from
  text prompts alone (no recordings or sound libraries; fal.ai describes the model as trained on
  licensed data, for commercial use), each take checked with fal's audio-understanding model or, for
  most of those made for the worlds' answers to the gun, by its spectrogram and envelope: the base
  pack's 43 (the machine gun's 12 among them: its shot, echo, casings, six bullet strikes, ricochet,
  reload and empty click), 15 to 18 in each world's pack but Brick Street's, and four in Brick
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
- **Models**: made for this project with generative AI and cleaned up in Blender (no scans, stock
  models or photographs; made-up lettering and badges painted out): concept images with GPT Image
  2.5, then image-to-3D, Meshy 7.1 for the base pack's street props (cabs, sedan, van, hydrant,
  trash can, mailbox) and Tripo P2 for every world's (Market Town's barrels, carts, hay wagon and
  baskets; Dust Town's wagon, safe, pump and rocking chairs; Neon Alley's scooter, hawker cart and
  bin; Harbor Yard's forklift, yard tractor, drum and reel; Sun Temple's statue, tripod, amphora
  and lion) and for the player's kit: the launcher, the rocket and the machine gun (a made-up light
  machine gun in the launcher's olive drab: no real weapon's design, no maker, no markings; its
  roughness remapped and its magazine cut out as a mesh of its own by script). Neon Alley's plastic
  crates are procedural.
- **Made in code**: Neon Alley's glyph atlas (a made-up script, no real letters or brands), Dust
  Town's painted signs (marks that read as lettering but aren't), the mesas, scrub, birds and the
  skylines.
- **fal.ai spend**, every ledger (`assets-src/packs/*/ledger.jsonl`,
  `assets-src/packs/mix-ledger.jsonl`, `assets-src/sounds/ledger.jsonl`): **$48.51** in 688 calls:
  Tripo P2 $22.00 (23 models), GPT Image 2.5 $10.62 (63 images), Stable Audio 3 $10.19 (271
  takes), audio understanding $5.70 (331 checks). By pack: Dust Town $9.04, Harbor Yard $8.97,
  Market Town $8.68, Sun Temple $7.86, Neon Alley $7.23, the kit $3.85 (the machine gun $1.28 of
  it), the base pack's machine gun sounds $2.59, Brick Street $0.19, the mix check $0.11. Phase F
  (the worlds' answers to the gun, and Sun Temple's crater earth) cost $1.50 of it: 40 calls, 33
  takes, one image and six checks. The base pack's first 31 sounds, its textures and its props,
  made before the ledgers, aren't counted.

Each pack's `CREDITS.md` (`public/packs/<id>/`, `public/models/`, `public/textures/`,
`public/hdri/`) lists every asset, what it is and how it was made; the base sounds' prompts are in
`scripts/assets/sounds.mjs`.
