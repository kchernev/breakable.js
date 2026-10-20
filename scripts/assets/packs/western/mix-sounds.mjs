// Takes mixed from other takes of this pack, for a sound the model couldn't make whole. Each `mix`
// in sounds.mjs (take index → layers) becomes assets-src/packs/western/sounds/<name>/<i>.flac with a
// .json of how it was made; process-sounds then treats it like a generated take. With FAL_KEY set,
// the mix is also uploaded to fal's storage (free) so qa-sounds can check it.
//
//   [FAL_KEY=...] node scripts/assets/packs/western/mix-sounds.mjs
//
// A layer: { from: 'name:i', at (s), gain, rate (playback rate: pitch and speed together), filter
// (an ffmpeg audio filter chain, e.g. 'highpass=f=300') }. One layer with a filter is an EQ'd take.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { upload } from '../../fal.mjs';
import { sounds } from './sounds.mjs';

const ROOT = new URL('../../../../assets-src/packs/western/sounds/', import.meta.url).pathname;
const RATE = 44100;

function ffmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err))));
    p.stdin.end(input);
  });
}

for (const s of sounds) {
  for (const [i, layers] of Object.entries(s.mix ?? {})) {
    const base = `${ROOT}${s.name}/${i}`;
    // Made already from the same layers: keep it (and the URL its QA answer is filed under)
    if (existsSync(`${base}.flac`) && existsSync(`${base}.json`)) {
      const old = JSON.parse(await readFile(`${base}.json`, 'utf8'));
      if (JSON.stringify(old.layers) === JSON.stringify(layers)) continue;
    }
    await mkdir(`${ROOT}${s.name}`, { recursive: true });
    const inputs = layers.flatMap((l) => ['-i', `${ROOT}${l.from.replace(':', '/')}.flac`]);
    const chains = layers.map((l, k) => {
      const ms = Math.round(l.at * 1000);
      return `[${k}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,${l.filter ? `${l.filter},` : ''}asetrate=${Math.round(RATE * (l.rate ?? 1))},aresample=${RATE},volume=${l.gain ?? 1},adelay=${ms}|${ms}[l${k}]`;
    });
    const graph = `${chains.join(';')};${layers.map((_, k) => `[l${k}]`).join('')}amix=inputs=${layers.length}:normalize=0:duration=longest[out]`;
    const raw = await ffmpeg([...inputs, '-filter_complex', graph, '-map', '[out]', '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-']);
    // Down to -1 dBFS peak if the layers add up past it; never up (the QA model hears loud as heavy)
    const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    let peak = 0;
    for (const v of x) peak = Math.max(peak, Math.abs(v));
    const g = Math.min(1, 10 ** (-1 / 20) / peak);
    for (let k = 0; k < x.length; k++) x[k] *= g;
    await ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', '-', '-c:a', 'flac', '-sample_fmt', 's16', `${base}.flac`], Buffer.from(x.buffer, x.byteOffset, x.byteLength));
    const meta = { made: 'mixed locally from other takes of this pack (mix-sounds.mjs)', layers, duration: +(x.length / 2 / RATE).toFixed(3) };
    if (process.env.FAL_KEY) meta.url = await upload(await readFile(`${base}.flac`), 'audio/flac', `${s.name}-${i}.flac`);
    await writeFile(`${base}.json`, JSON.stringify(meta, null, 2));
    console.log(`${s.name} ${i}: ${layers.length} layers, ${meta.duration} s`);
  }
}
