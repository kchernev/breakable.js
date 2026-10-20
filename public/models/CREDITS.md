# Street props: credits

The GLBs in this folder (the cars, the van and the street furniture listed in `index.json`) were
made for this project (Breakable.js's New York street demo) with generative AI and cleaned up in
Blender:

- **Concept images:** OpenAI GPT Image 2.5 (`openai/gpt-image-2.5/flare/text-to-image`), via
  [fal.ai](https://fal.ai). One whole object per image, three-quarter view, plain background,
  no text or logos. One small badge the model drew on the van's grille anyway was painted out of
  its concept before it went to 3D.
- **Image to 3D:** Meshy 7.1 (`meshy/v7.1/image-to-3d`, standard model, PBR maps), via fal.ai.
- **Processing:** Blender 4.5 in background mode (`scripts/assets/process-props.py`): welded,
  oriented (+Y up, front facing -Z), scaled to real-world size in metres, origin at the bottom
  centre, decimated to the triangle budget, textures shrunk and stored as WebP, plus a convex
  collider of at most 24 points per prop. The 3D model invented a maker-style badge on the sedan's
  trunk and pseudo-lettering on the taxi's; both were painted over in the textures.

The prompts, settings, seeds and source URLs of every generation are recorded next to the raw files
in `assets-src/props/raw/<name>/` (`concept<i>.json`, `model.json`); the pipeline is
`scripts/assets/props.mjs` (the prop list and prompts), `scripts/assets/generate-props.mjs` (fal.ai)
and `scripts/assets/process-props.py` (Blender).

The designs are generic: no manufacturer badges, brand logos or lettering are meant to appear on any
of them.
