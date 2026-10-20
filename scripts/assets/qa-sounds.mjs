// Asks an audio-understanding model about every raw take (assets-src/sounds/*/*.json has the fal
// URL each came from) and writes its answers to assets-src/sounds/qa.json, to catch takes with
// music, voices or glitches in them, or that don't sound like what was asked for.
//
//   FAL_KEY=... node scripts/assets/qa-sounds.mjs [--only a,b]

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { pool, requireKey, run } from './fal.mjs';
import { manifest, rawDir } from './pack.mjs';

const { sounds } = await import(manifest('sounds'));

const ROOT = rawDir('sounds');
const i = process.argv.indexOf('--only');
const only = i < 0 ? null : process.argv[i + 1].split(',');
requireKey();

const out = existsSync(`${ROOT}qa.json`) ? JSON.parse(await readFile(`${ROOT}qa.json`, 'utf8')) : {};
const jobs = [];
for (const s of sounds) {
  if (only && !only.includes(s.name)) continue;
  for (let k = 0; k < s.count; k++) {
    const meta = JSON.parse(await readFile(`${ROOT}${s.name}/${k}.json`, 'utf8'));
    const key = `${s.name}:${k}`;
    if (out[key]?.url === meta.url) continue;
    jobs.push({ key, s, meta });
  }
}
console.log(`${jobs.length} takes to check`);
await pool(jobs, 6, async ({ key, s, meta }) => {
  const prompt = `This is a take for a video game sound effect. It should be: "${s.prompt}" Answer in exactly three short lines.
1. HEAR: what you hear, in order, with rough timings.
2. PROBLEMS: any music, melody, speech or voices, beeps, digital glitches, clipping, or sounds that don't belong (say "none" if there are none).
3. SCORE: how well it fits what it should be, 1 to 10, as a number only.`;
  try {
    const r = await run('fal-ai/audio-understanding', { audio_url: meta.url, prompt });
    out[key] = { url: meta.url, answer: r.output };
    console.log(key);
  } catch (e) {
    console.warn(key, e.message);
  }
});
await writeFile(`${ROOT}qa.json`, JSON.stringify(out, null, 2));
