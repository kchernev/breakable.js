// Generates the raw takes of the sound pack (scripts/assets/sounds.mjs) with Stable Audio 3 Medium
// on fal.ai, into assets-src/sounds/<name>/<i>.flac (with a .json of how it was made). Takes
// already there are kept, so it only fills in what's missing.
//
//   FAL_KEY=... node scripts/assets/generate-sounds.mjs [--only a,b] [--redo name:i,...]
//
// --redo replaces those takes, with the next seed along.

import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { download, pool, requireKey, run } from './fal.mjs';
import { manifest, rawDir } from './pack.mjs';

const { sounds } = await import(manifest('sounds'));

const MODEL = 'fal-ai/stable-audio-3/medium/text-to-audio';
const ROOT = rawDir('sounds');

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? null : process.argv[i + 1].split(',');
};
const only = arg('--only');
const redo = new Set(arg('--redo') ?? []);

requireKey();

const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 100_000;

const jobs = [];
for (const s of sounds) {
  if (only && !only.includes(s.name)) continue;
  for (let i = 0; i < s.count; i++) {
    const base = `${ROOT}${s.name}/${i}`;
    let seed = hash(s.name) * 10 + i;
    if (redo.has(`${s.name}:${i}`) && existsSync(`${base}.json`)) {
      seed = JSON.parse(await readFile(`${base}.json`, 'utf8')).seed + 1000;
      await rm(`${base}.flac`, { force: true });
    }
    if (existsSync(`${base}.flac`)) continue;
    jobs.push({ s, i, base, seed });
  }
}
console.log(`${jobs.length} takes to make`);

let done = 0;
await pool(jobs, 6, async ({ s, i, base, seed }) => {
  const input = { prompt: s.prompt, negative_prompt: s.negative, duration: s.duration, seed, output_format: 'flac' };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await run(MODEL, input);
      await download(r.audio.url, `${base}.flac`);
      await writeFile(`${base}.json`, JSON.stringify({ model: MODEL, ...input, url: r.audio.url }, null, 2));
      console.log(`[${++done}/${jobs.length}] ${s.name} ${i}`);
      return;
    } catch (e) {
      console.warn(`${s.name} ${i}: ${e.message}`);
    }
  }
});
