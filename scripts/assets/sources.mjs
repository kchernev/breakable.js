// The raw generations behind public/ (assets-src: every take, concept image and raw model, about
// 940 MB) are kept out of git, all but their notes (.json, .jsonl, .md: prompts, seeds, picks and
// the ledgers of paid calls). They travel as one archive per pack, attached to a GitHub release.
// assets-src/sources.json lists the archives with their files and checksums, so a fetch can tell
// what's missing and that it arrived whole. Nothing the demo or the build reads is in them: they're
// only needed to redo or re-cut an asset.
//
// Only a pack's generations go (its KINDS folders). The screenshots the worlds' checks took beside
// them (review-*, fix-*, shots, phase-*: about 950 MB) stay on the machine that took them; `pack`
// lists the folders it leaves out.
//
//   node scripts/assets/sources.mjs pack [--tag sources-v2]   archives into release/, and sources.json
//   node scripts/assets/sources.mjs fetch [a,b]               download and unpack them (all, or packs a,b)
//
// The release is sources.json's tag on the GitHub repo `origin` points to (SOURCES_URL overrides the
// base URL the archives come from). A private repo's are fetched through `gh`. After `pack`:
//
//   gh release create <tag> release/sources-*.tar --title "Asset sources" --notes "assets-src's raw files"

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const SRC = 'assets-src';
const OUT = 'release';
const MANIFEST = `${SRC}/sources.json`;
/** What git keeps of assets-src (.gitignore says the same). */
const NOTES = /\.(json|jsonl|md)$/;

/** The folders of a pack that hold its generations. */
const KINDS = ['props', 'sounds', 'sounds-rejected', 'textures'];

const folders = async (dir) => (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();

/** The archives: the base pack's folders together (the cars' splits and sources too), then each world's pack (and the kit, the cars' insides). */
async function archives() {
  const of = (dir) => KINDS.map((k) => `${dir}/${k}`);
  return [{ name: 'base', dirs: [...of(SRC), `${SRC}/cars`] }, ...(await folders(`${SRC}/packs`)).map((p) => ({ name: p, dirs: of(`${SRC}/packs/${p}`) }))];
}

/** Every file under `dirs` that git doesn't keep, sorted. */
async function raws(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const e of await readdir(dir, { recursive: true, withFileTypes: true })) {
      const path = join(e.parentPath ?? e.path, e.name);
      if ((e.isFile() || e.isSymbolicLink()) && !NOTES.test(e.name) && e.name !== '.DS_Store') out.push(path);
    }
  }
  return out.sort();
}

async function sha256(path) {
  const h = createHash('sha256');
  await pipeline(createReadStream(path), h);
  return h.digest('hex');
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 2).join(' ')} failed (${r.error?.message ?? r.status})`);
}

/** GNU tar (Linux) and bsdtar (macOS, Windows) spell some options differently. */
const GNU = /GNU tar/.test(spawnSync('tar', ['--version'], { encoding: 'utf8' }).stdout ?? '');

const mb = (n) => `${(n / 1e6).toFixed(0)} MB`;

async function pack() {
  const i = process.argv.indexOf('--tag');
  const old = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : null;
  const tag = i > 0 ? process.argv[i + 1] : (old?.tag ?? 'sources-v1');
  await mkdir(OUT, { recursive: true });
  for (const p of await folders(`${SRC}/packs`)) {
    const left = (await folders(`${SRC}/packs/${p}`)).filter((f) => !KINDS.includes(f));
    if (left.length) console.log(`${p}: left out ${left.join(', ')}`);
  }
  const list = [];
  for (const a of await archives()) {
    const files = await raws(a.dirs);
    if (!files.length) continue;
    const file = `sources-${a.name}.tar`;
    const names = `${OUT}/${a.name}.files`;
    await writeFile(names, files.join('\n') + '\n');
    // No owner in the headers: they'd carry the packer's user name
    run('tar', ['-cf', `${OUT}/${file}`, ...(GNU ? ['--owner=0', '--group=0', '--numeric-owner'] : ['--uid', '0', '--gid', '0', '--numeric-owner']), '-T', names]);
    await rm(names);
    let size = 0;
    for (const f of files) size += (await stat(f)).size;
    const bytes = (await stat(`${OUT}/${file}`)).size;
    list.push({ name: a.name, file, bytes, sha256: await sha256(`${OUT}/${file}`), size, files });
    console.log(`${file}: ${files.length} files, ${mb(bytes)}`);
  }
  await writeFile(MANIFEST, JSON.stringify({ tag, archives: list }, null, 1) + '\n');
  console.log(`\n${MANIFEST} written (tag ${tag}). Upload with:\n  gh release create ${tag} ${OUT}/sources-*.tar --title "Asset sources" --notes "assets-src's raw files"`);
}

/** Where the release's files are downloaded from: SOURCES_URL, or the GitHub repo of `origin`. */
function source(tag) {
  if (process.env.SOURCES_URL) return { url: process.env.SOURCES_URL.replace(/\/?$/, '/') };
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  const m = r.stdout?.trim().match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
  if (!m) throw new Error("No GitHub repo to fetch from: set SOURCES_URL, or add the repo as git's `origin`");
  return { url: `https://github.com/${m[1]}/${m[2]}/releases/download/${tag}/`, repo: `${m[1]}/${m[2]}` };
}

async function download(from, a) {
  const to = `${OUT}/${a.file}`;
  if (existsSync(to) && (await sha256(to)) === a.sha256) return to;
  const r = await fetch(from.url + a.file);
  if (r.ok) {
    await pipeline(Readable.fromWeb(r.body), createWriteStream(to));
  } else if (from.repo && spawnSync('gh', ['--version']).status === 0) {
    // A private repo's release files need its owner's sign-in, which gh has
    run('gh', ['release', 'download', JSON.parse(await readFile(MANIFEST, 'utf8')).tag, '--repo', from.repo, '--pattern', a.file, '--dir', OUT, '--clobber']);
  } else {
    throw new Error(`${from.url + a.file}: ${r.status} ${r.statusText}`);
  }
  if ((await sha256(to)) !== a.sha256) throw new Error(`${a.file} arrived changed or cut short (its checksum doesn't match sources.json)`);
  return to;
}

async function fetchAll() {
  const { tag, archives: list } = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const only = process.argv[3]?.split(',');
  const from = source(tag);
  await mkdir(OUT, { recursive: true });
  for (const a of list) {
    if (only && !only.includes(a.name)) continue;
    const missing = a.files.filter((f) => !existsSync(f)).length;
    if (!missing) {
      console.log(`${a.name}: all ${a.files.length} files there`);
      continue;
    }
    console.log(`${a.name}: ${missing} of ${a.files.length} files missing, fetching ${a.file} (${mb(a.bytes)})`);
    // Only what's missing is unpacked: a raw changed here since the release is left as it is
    run('tar', ['-xf', await download(from, a), GNU ? '--skip-old-files' : '-k']);
  }
}

const command = process.argv[2];
if (command === 'pack') await pack();
else if (command === 'fetch') await fetchAll();
else console.log('node scripts/assets/sources.mjs pack [--tag t] | fetch [pack,...]');
