// Brick Street's footsteps on iron (a fire escape's grating, a car's roof), made from the base
// pack's own takes, no generation: each asphalt step (a boot coming down) with the first ring of an
// iron bar's clang under it, pitched up and cut short, so the boot clanks on the metal. Writes
// public/packs/nyc/sounds/steps.metal/<i>.mp3 and its entry in public/packs/nyc/sounds/index.json.
//
//   node scripts/assets/packs/nyc/steps-metal.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../../../../', import.meta.url).pathname;
const BASE = `${ROOT}public/sounds/`;
const OUT = `${ROOT}public/packs/nyc/sounds/`;
const NAME = 'steps.metal';

const steps = JSON.parse(readFileSync(`${BASE}index.json`, 'utf8'))['steps.asphalt'].src;
const clangs = JSON.parse(readFileSync(`${BASE}index.json`, 'utf8'))['metal.impact.small'].src;
mkdirSync(`${OUT}${NAME}`, { recursive: true });

const src = [];
const duration = [];
for (const [i, step] of steps.entries()) {
  const file = `${NAME}/${i}.mp3`;
  // The clang's first 0.3 s, a third higher (a thin grate, not a bar), its low end gone, fading out
  // under the step; the step's boomy low end thinned (iron rings, it doesn't thud)
  const clang = '[1:a]atrim=0:0.3,asetrate=44100*1.3,aresample=44100,highpass=f=700,afade=t=out:st=0.03:d=0.2,volume=0.4,pan=stereo|c0=c0|c1=c0[c]';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', BASE + step, '-i', BASE + clangs[i % clangs.length], '-filter_complex', `${clang};[0:a]highpass=f=150[s];[s][c]amix=inputs=2:duration=first:normalize=0`, '-c:a', 'libmp3lame', '-q:a', '3', OUT + file]);
  src.push(file);
  duration.push(+(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT + file]).toString()).toFixed(3));
}

const index = existsSync(`${OUT}index.json`) ? JSON.parse(readFileSync(`${OUT}index.json`, 'utf8')) : {};
// As loud as the asphalt steps at their 0.3 (-32.3 LUFS back to back: docs/changelog/phase-c/sound.md)
index[NAME] = { src, duration, kind: 'slice', space: 'head', play: { volume: 0.24, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 } };
writeFileSync(`${OUT}index.json`, JSON.stringify(index, null, 1) + '\n');
console.log(`${NAME}: ${src.length} (${duration.map((d) => d.toFixed(2)).join(', ')} s)`);
