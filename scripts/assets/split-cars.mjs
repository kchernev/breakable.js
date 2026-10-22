// Splits each car of cars.mjs, or each prop named (public/models/<name>.glb: one to add to cars.mjs once
// its parts are seen), into parts with Hunyuan 3D v3.1's
// part splitter on fal.ai, into assets-src/cars/<name>/split/part_<i>.glb (with result.json). A car
// already split is kept. The splitter takes FBX of at most 30k faces: Blender makes it from the GLB.
//
//   FAL_KEY=... node scripts/assets/split-cars.mjs [name ...]
//
// Then: blender -b --factory-startup --python scripts/assets/process-cars.py -- [name ...]

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cars } from './cars.mjs';
import { download, requireKey, run, upload } from './fal.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const MODEL = 'fal-ai/hunyuan-3d/v3.1/part';
const BLENDER = process.env.BLENDER ?? `${process.env.HOME}/.local/bin/blender`;
const only = process.argv.slice(2);
requireKey();

// GLB to FBX, in Blender
const TO_FBX = `
import bpy, sys
src, out = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.ops.export_scene.fbx(filepath=out, path_mode='COPY', embed_textures=True, apply_scale_options='FBX_SCALE_ALL')
`;

for (const name of only.length ? only : cars.map((c) => c.name)) {
  const car = { name };
  const dir = `${ROOT}assets-src/cars/${name}/split/`;
  if (existsSync(`${dir}result.json`)) {
    console.log(`${car.name}: split already`);
    continue;
  }
  mkdirSync(dir, { recursive: true });
  const fbx = `${dir}input.fbx`;
  const script = `${dir}to_fbx.py`;
  writeFileSync(script, TO_FBX);
  const b = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', script, '--', `${ROOT}public/models/${car.name}.glb`, fbx], { encoding: 'utf8' });
  if (b.status !== 0) throw new Error(`${car.name}: Blender: ${b.stderr}`);
  const url = await upload(readFileSync(fbx), 'application/octet-stream', `${car.name}.fbx`);
  const r = await run(MODEL, { input_file_url: url }, { timeout: 900_000 });
  for (const [i, f] of r.result_files.entries()) await download(f.url, `${dir}${f.file_name ?? `part_${i}.glb`}`);
  writeFileSync(`${dir}result.json`, JSON.stringify({ model: MODEL, input: `public/models/${car.name}.glb`, ...r }, null, 1));
  console.log(`${car.name}: ${r.result_files.length} parts`);
}
