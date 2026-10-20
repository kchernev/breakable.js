// Turns the raw takes (assets-src/sounds/<name>/<i>.flac) into the pack the game loads
// (public/sounds/<name>/<i>.mp3 and public/sounds/index.json):
// - shots: the silence before and after cut (with `onset` in the list, everything before the rise
//   into its loudest part, for takes that build up to the hit: `onset: true` cuts where it last
//   came up through 15 dB under its loudest, `onset: 10` through 10 dB; with `start`, that many
//   seconds off its front, faded in), a short fade at the end; with `parts` (a list for each take of
//   [from, to, at] in seconds), its moves laid out anew instead (a reload timed to its animation);
// - loops: the model's own fade in and out cut away, the end crossfaded into the start, so it repeats
//   without a seam;
// - slices: one take of several hits (footsteps) cut apart at each onset (with `onset`, each then cut
//   to its rise, as a shot is);
// then mono for sounds placed in the world, levelled (by their loudest moment, never past -1 dBFS)
// and encoded as MP3 (every browser decodes it). The cutting itself is in sound-cut.mjs.
//
//   node scripts/assets/process-sounds.mjs [--only a,b] [--skip name:i,name:i:j,...]
//
// --skip leaves takes out of the pack (ones the QA found music or voices in); name:i:j leaves out
// slice j (from 0, in the order they come; the log lists them) of a sliced take i. Without it,
// the raws' skip.json (an array of the same) if there is one.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { manifest, outDir, rawDir } from './pack.mjs';
import { fade, level, loop, mono, onset, place, RATE, slices, trim } from './sound-cut.mjs';

const { sounds } = await import(manifest('sounds'));

const SRC = rawDir('sounds');
const OUT = outDir('sounds');

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? null : process.argv[i + 1].split(',');
};
const only = arg('--only');
const skip = new Set(arg('--skip') ?? (existsSync(`${SRC}skip.json`) ? JSON.parse(await readFile(`${SRC}skip.json`, 'utf8')) : []));

/** Run ffmpeg with `args`, feeding it `input`; resolves to what it wrote to stdout. */
function ffmpeg(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(err))));
    if (input) p.stdin.end(input);
    else p.stdin.end();
  });
}

/** A file as one Float32Array per channel. */
async function decode(path) {
  const raw = await ffmpeg(['-i', path, '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-']);
  const all = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const n = all.length / 2;
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    ch[0][i] = all[2 * i];
    ch[1][i] = all[2 * i + 1];
  }
  return ch;
}

async function encode(ch, path) {
  const n = ch[0].length;
  const inter = new Float32Array(n * ch.length);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch.length; c++) inter[i * ch.length + c] = ch[c][i];
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  const q = ch.length === 1 ? '5' : '3';
  await ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', String(ch.length), '-i', '-', '-c:a', 'libmp3lame', '-q:a', q, path], Buffer.from(inter.buffer));
}

/** How far under its loudest the rise is that `onset` cuts to (true: 15 dB). */
const rise = (s) => (s.onset === true ? 15 : s.onset);

/** A shot's take, cut (see the top). */
function cut(s, i, ch) {
  if (s.parts) return place(ch, s.parts[i]);
  const t = trim(ch);
  if (s.start) return fade(place(t, [[s.start, Infinity, 0]]), 0.025, 0);
  return s.onset ? onset(t, rise(s)) : t;
}

const index = existsSync(`${OUT}index.json`) ? JSON.parse(await readFile(`${OUT}index.json`, 'utf8')) : {};
for (const s of sounds) {
  if (only && !only.includes(s.name)) continue;
  await rm(`${OUT}${s.name}`, { recursive: true, force: true });
  const files = [];
  const durations = [];
  const put = async (ch) => {
    const out = s.space === 'world' ? mono(ch) : ch;
    const file = `${s.name}/${files.length}.mp3`;
    await encode(out, `${OUT}${file}`);
    files.push(file);
    durations.push(+(out[0].length / RATE).toFixed(3));
  };
  for (let i = 0; i < s.count; i++) {
    if (skip.has(`${s.name}:${i}`)) continue;
    const ch = await decode(`${SRC}${s.name}/${i}.flac`);
    if (s.kind === 'shot') await put(level(fade(cut(s, i, ch), 0.003, s.fade), -14));
    else if (s.kind === 'loop') await put(level(loop(ch, Math.min(1, s.duration * 0.06), Math.min(2, s.duration * 0.15)), -20));
    else {
      const hits = slices(ch);
      console.log(`  ${s.name}:${i}: slices at ${hits.map((h, j) => `${j}: ${h.at.toFixed(2)}`).join(', ')} s`);
      for (const [j, hit] of hits.entries()) if (!skip.has(`${s.name}:${i}:${j}`)) await put(level(s.onset ? fade(onset(hit.ch, rise(s)), 0.002, 0) : hit.ch, -16));
    }
  }
  // How it's played (SoundOptions without src), if the list says
  index[s.name] = { src: files, duration: durations, kind: s.kind, space: s.space, ...(s.play ? { play: s.play } : {}) };
  console.log(`${s.name}: ${files.length} (${durations.map((d) => d.toFixed(2)).join(', ')} s)`);
}
const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(`${OUT}index.json`, JSON.stringify(sorted, null, 1) + '\n');
