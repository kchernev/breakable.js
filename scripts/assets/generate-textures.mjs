// Generates the raw images of the texture sets (scripts/assets/textures.mjs) with GPT Image 2.5 on
// fal.ai, into assets-src/textures/raw/<set>/<i>.png (with a .json of how it was made). Images
// already there are kept, so it only fills in what's missing; scripts/assets/process-textures.py
// then makes the maps from take 0 (or the take it's told to use).
//
//   FAL_KEY=... node scripts/assets/generate-textures.mjs [--only a,b] [--takes n] [--redo set:i,...]
//
// --takes makes sure each set has that many takes (default 1), to pick from; --redo replaces those.

import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { download, pool, requireKey, run } from './fal.mjs';
import { manifest, rawDir } from './pack.mjs';

const { textures } = await import(manifest('textures'));

const MODEL = 'openai/gpt-image-2.5/flare/text-to-image';
const ROOT = `${rawDir('textures')}raw/`;

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? null : process.argv[i + 1].split(',');
};
const only = arg('--only');
const redo = new Set(arg('--redo') ?? []);
const takes = Number(arg('--takes')?.[0] ?? 1);

requireKey();

const jobs = [];
for (const t of textures) {
  if (only && !only.includes(t.name)) continue;
  for (let i = 0; i < takes; i++) {
    const base = `${ROOT}${t.name}/${i}`;
    if (redo.has(`${t.name}:${i}`)) await rm(`${base}.png`, { force: true });
    if (!existsSync(`${base}.png`)) jobs.push({ t, i, base });
  }
}
console.log(`${jobs.length} images to make`);

// No retries: a failure after the image was made would still be paid for, so a rerun decides.
// The model takes no seed, so the .json (prompt, size, time, result URL) is the record of a take.
let done = 0;
await pool(jobs, 4, async ({ t, i, base }) => {
  const input = { prompt: t.prompt, image_size: t.size ?? { width: 1024, height: 1024 }, quality: 'high', background: 'opaque', output_format: 'png', num_images: 1 };
  try {
    const r = await run(MODEL, input);
    const url = r.images[0].url;
    await download(url, `${base}.png`);
    await writeFile(`${base}.json`, JSON.stringify({ model: MODEL, ...input, made: new Date().toISOString(), url }, null, 2));
    console.log(`[${++done}/${jobs.length}] ${t.name} ${i}`);
  } catch (e) {
    console.warn(`${t.name} ${i}: ${e.message}`);
  }
});
