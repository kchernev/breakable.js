# The cars in parts: credits

The cars here come apart (`src/lib/vehicle.ts`). Each glTF (`<name>.gltf` and its `.bin`, the
textures shared in `textures/`) holds a car's parts as nodes; `index.json` has their colliders,
hinges, masses and glass. All made for this project by `scripts/assets/process-cars.py` (Blender
4.5, in background mode), from:

- **The sedan, the taxi and the van**: original models made for this project, modelled in Blender
  by script (`scripts/assets/car_model.py`, from the designs in `scripts/assets/car_designs.py`),
  into `assets-src/cars/<name>/source/<name>.blend`. No image-to-3D, scanned, stock or third-party
  models went into them, so they carry no licence but this project's own (MIT). Each body is
  lofted from its design's lines and stations, its arches cut out and its lamps, grilles, intakes,
  plates, grooves and painted areas cut into it, its parts gapped at their seams; its wheels, brakes,
  mirrors, handles, number plates, wipers and exhausts made alongside, and the taxi's roof sign a
  part of its own. Their paint is white under each copy's tint (`tintMask: 'paint'`), clear coated;
  the taxi's checker stripe is a 64-pixel checker drawn by the script (`textures/checker.webp`).
  Their shapes were drawn up against 8 reference pictures generated for this project with OpenAI's
  GPT Image 2.5 (on fal.ai, `openai/gpt-image-2.5/flare/text-to-image`, from text prompts alone;
  $0.20 each, $1.60 in all, in `assets-src/cars/ledger.jsonl`). They were used only for reference
  and aren't shipped (`assets-src/cars/refs/`).
- **The Ubix GT15**: a made-up sports car, the Blender model of this project's authors' own game
  (*Ubix GT15 Nordschleife*), as it was given in `assets-src/cars/gt15/source/`. Its modifiers
  applied, scaled to its real size, its objects made its parts, its faces cut down, its materials
  set to export as they look and its tyres' colour ramp baked into a texture
  (`scripts/assets/car_blend.py`).
- **Their insides**: made in code (`scripts/assets/car_insides.py`): seats, dashboards, steering
  wheels, consoles, carpets, headliners, belts, door cards, a cab's partition and meter, a van's
  cargo bay, engines and trunks, lined with the cars pack's textures (`public/packs/cars/`, see its
  CREDITS.md).

The sedan, the taxi and the van were first cut from the base pack's props (`public/models/`: GPT
Image 2.5 concepts, Meshy 7.1) by Tencent's Hunyuan 3D v3.1 part splitter on fal.ai; their glTFs
take nothing from those props or their splits now (the splits, in
`assets-src/cars/<name>/split/`, are no longer used).

Nothing real is advertised on the cars, and no maker's name, badge or logo is meant to appear: the
taxi's shape follows a Crown Victoria's and the van's a Transit's, but neither carries their names
or marks. The only lettering is the cab's TAXI and the made-up number plates, set in Blender's own
font.
