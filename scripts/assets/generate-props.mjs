// Generates the raw street props (scripts/assets/props.mjs) on fal.ai, in two stages:
//
//   concept: a GPT Image 2.5 picture of the prop, posed for image-to-3D
//            -> assets-src/props/raw/<name>/concept<i>.png (+ .json: prompt, endpoint, settings, URL)
//   3d:      Meshy 7.1 (or Tripo P2: `generator: 'tripo'` on a prop, or `export const generator =
//            'tripo'` in the list) image-to-3D from concept<pick>.png (pick is set in props.mjs after looking;
//            a prop's `inpaint` regions are painted out first, into concept<pick>_clean.png)
//            -> assets-src/props/raw/<name>/model.glb, thumbnail.png (+ model.json: input, output, seed)
//
//   FAL_KEY=... node scripts/assets/generate-props.mjs concept [--only a,b] [--takes n] [--redo name:i,...]
//                (makes each prop's picked take, concept<pick>.png; --takes n makes takes 0..n-1 to choose from)
//   FAL_KEY=... node scripts/assets/generate-props.mjs 3d [--only a,b] [--redo name,...]
//
// Files already there are kept, so a rerun only fills in what's missing (and costs nothing when
// everything is there). Every paid call is appended to assets-src/props/calls.jsonl.
// Then: blender -b --factory-startup --python scripts/assets/process-props.py -- [name ...]

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { manifest, rawDir } from './pack.mjs';

const list = await import(manifest('props'));
const { props } = list;
// A pack's list may keep the base pack's Meshy settings
const meshyDefaults = list.meshyDefaults ?? (await import('./props.mjs')).meshyDefaults;
// Tripo P2 (a prop's `tripo` overrides these): PBR maps, detailed textures with the baked light taken out
const tripoDefaults = { pbr: true, texture: true, texture_quality: 'detailed', delight: true, export_uv: true, quad: false, face_limit: 30000, ...list.tripoDefaults };

// A key pasted from a .env file may still carry its quotes; fal.mjs reads FAL_KEY when it loads.
if (process.env.FAL_KEY) process.env.FAL_KEY = process.env.FAL_KEY.trim().replace(/^(['"])(.*)\1$/, '$2');
const { download, pool, requireKey, run, upload } = await import('./fal.mjs');

const IMAGE = 'openai/gpt-image-2.5/flare/text-to-image';
const MESHY = 'meshy/v7.1/image-to-3d';
const TRIPO = 'tripo3d/p2/image-to-3d';
const ROOT = rawDir('props');

const stage = process.argv[2];
if (stage !== 'concept' && stage !== '3d') {
  console.error('usage: generate-props.mjs concept|3d [--only a,b] [--takes n] [--redo ...]');
  process.exit(1);
}
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? null : process.argv[i + 1].split(',');
};
const only = arg('--only');
const redo = new Set(arg('--redo') ?? []);
const takes = arg('--takes') ? Number(arg('--takes')[0]) : null;

requireKey();

const ledger = (entry) => appendFile(`${ROOT}calls.jsonl`, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');

const jobs = [];
for (const p of props) {
  if (only && !only.includes(p.name)) continue;
  const dir = `${ROOT}raw/${p.name}/`;
  if (stage === 'concept') {
    // By default only the take props.mjs picked (that's all a fresh rebuild needs); --takes n: takes 0..n-1
    for (const i of takes ? Array.from({ length: takes }, (_, i) => i) : [p.pick]) {
      if (redo.has(`${p.name}:${i}`)) await rm(`${dir}concept${i}.png`, { force: true });
      if (!existsSync(`${dir}concept${i}.png`)) jobs.push({ p, dir, i });
    }
  } else {
    if (redo.has(p.name)) await rm(`${dir}model.glb`, { force: true });
    if (existsSync(`${dir}model.glb`)) continue;
    if (!existsSync(`${dir}concept${p.pick}.png`)) {
      console.warn(`${p.name}: no concept${p.pick}.png yet, run the concept stage first`);
      continue;
    }
    jobs.push({ p, dir });
  }
}
console.log(`${jobs.length} ${stage === 'concept' ? 'concept images' : '3D models'} to make`);

// No retries: a failure after the result was made would still be paid for, so a rerun decides.
let done = 0;
await pool(jobs, stage === 'concept' ? 4 : 3, async ({ p, dir, i }) => {
  await mkdir(dir, { recursive: true });
  try {
    if (stage === 'concept') {
      const input = { prompt: p.prompt, image_size: p.imageSize, quality: 'high', background: 'opaque', output_format: 'png', num_images: 1 };
      const r = await run(IMAGE, input);
      await ledger({ endpoint: IMAGE, prop: p.name, take: i });
      const url = r.images[0].url;
      await download(url, `${dir}concept${i}.png`);
      await writeFile(`${dir}concept${i}.json`, JSON.stringify({ endpoint: IMAGE, input, made: new Date().toISOString(), url }, null, 2));
      console.log(`[${++done}/${jobs.length}] ${p.name} concept${i}`);
    } else {
      let source = `concept${p.pick}.png`;
      if (p.inpaint) {
        // Paint out what the image model shouldn't have drawn (props-inpaint.py), and send that
        const clean = `concept${p.pick}_clean.png`;
        execFileSync('python3', ['-I', new URL('props-inpaint.py', import.meta.url).pathname, dir + source, dir + clean, JSON.stringify(p.inpaint)], { stdio: 'inherit' });
        source = clean;
      }
      const image_url = await upload(await readFile(dir + source), 'image/png', `${p.name}_${source}`);
      // Meshy 7.1 by default; `generator: 'tripo'` (on the prop, or the list's default) for Tripo P2
      const tripo = (p.generator ?? list.generator) === 'tripo';
      const endpoint = tripo ? TRIPO : MESHY;
      const input = tripo ? { ...tripoDefaults, ...p.tripo, image_url } : { ...meshyDefaults, ...p.meshy, image_url };
      const t0 = Date.now();
      const r = await run(endpoint, input, { timeout: 1_800_000, poll: 5000 });
      await ledger({ endpoint, prop: p.name });
      const mesh = tripo ? r.model_mesh : r.model_glb;
      if (tripo && !/\.glb($|\?)/i.test(mesh.file_name ?? mesh.url)) throw new Error(`Tripo gave ${mesh.file_name ?? mesh.url}, not a GLB`);
      await download(mesh.url, `${dir}model.glb`);
      const thumb = tripo ? r.rendered_image : r.thumbnail;
      if (thumb?.url) await download(thumb.url, `${dir}thumbnail.png`).catch(() => {});
      const record = { endpoint, source, input, seed: r.seed ?? null, made: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), output: r };
      await writeFile(`${dir}model.json`, JSON.stringify(record, null, 2));
      console.log(`[${++done}/${jobs.length}] ${p.name} model.glb (${record.seconds} s)`);
    }
  } catch (e) {
    console.warn(`${p.name} ${stage}: ${e.message}`);
  }
});
