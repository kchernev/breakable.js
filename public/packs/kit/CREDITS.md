# The player's kit: credits

## Models (`models/`)

`launcher.glb` (a shoulder-fired launcher: olive-drab tube, flared back, ribbed muzzle collar,
pistol and front grips, an optical sight on the left), `rocket.glb` (an olive warhead with a pale
yellow band, a gunmetal motor, three fins) and `gun.glb` (a light machine gun: olive-drab receiver,
ventilated barrel shroud, ported muzzle brake, straight box magazine, ribbed pistol grip, solid
stock, a rail with a rear aperture sight, an ejection port on the right). All made up: no real
weapon, no maker, no markings.

Made for this project, with no photographs or other sources:

1. Concept images from text prompts with OpenAI's GPT Image 2.5 (on fal.ai,
   `openai/gpt-image-2.5/flare/text-to-image`), two takes each; the prompts are in
   `scripts/assets/packs/kit/props.mjs` and next to each take in `assets-src/packs/kit/props/raw/`
   (the launcher's takes, with the earlier wording of which way it points, only there).
2. 3D models with textures (colour, normal, roughness / metalness) from the picked concept with
   Tripo P2 image-to-3D (on fal.ai, `tripo3d/p2/image-to-3d`).
3. Cleaned up in Blender by `scripts/assets/packs/kit/view-models.py`: welded, decimated (15,839,
   3,959 and 24,332 triangles), the launcher mirrored (its concept showed its right side, with the
   sight on it), laid along -Z with the origin on the axis (the launcher's tube, the gun's barrel),
   scaled (1.1 m, 0.75 m and 1.0 m long), the gun's roughness remapped (0.16-0.37 to 0.33-0.62) and
   its magazine cut off as a mesh of its own, ambient occlusion baked into the occlusion channel,
   textures shrunk (2048, 1024 and 2048 px, WebP).

`index.json` gives each file, its size and triangles, the launcher's muzzle and rear end on its
axis, and the gun's muzzle and ejection port (`loadKit()` in `src/demo/launcher.ts` reads it). The
paid calls are in `assets-src/packs/kit/ledger.jsonl`.
