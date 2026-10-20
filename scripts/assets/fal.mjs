// A minimal fal.ai client for the asset scripts: queue a request, wait for it, fetch the files.
// The key comes from FAL_KEY in the environment; it is never written anywhere.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// (The .env may quote it)
const KEY = process.env.FAL_KEY?.replace(/^['"]|['"]$/g, '');

export function requireKey() {
  if (!KEY) {
    console.error('Set FAL_KEY (a fal.ai API key) in the environment.');
    process.exit(1);
  }
}

const headers = () => ({ Authorization: `Key ${KEY}`, 'Content-Type': 'application/json' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run `endpoint` with `input` through fal's queue; resolves to the result's JSON. */
export async function run(endpoint, input, { timeout = 600_000, poll = 1500 } = {}) {
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: headers(), body: JSON.stringify(input) });
  if (!submit.ok) throw new Error(`${endpoint}: submit ${submit.status} ${await submit.text()}`);
  const { status_url, response_url } = await submit.json();
  const start = Date.now();
  for (;;) {
    await sleep(poll);
    const s = await fetch(status_url, { headers: headers() });
    if (!s.ok) throw new Error(`${endpoint}: status ${s.status} ${await s.text()}`);
    const { status } = await s.json();
    if (status === 'COMPLETED') break;
    if (Date.now() - start > timeout) throw new Error(`${endpoint}: timed out`);
  }
  const r = await fetch(response_url, { headers: headers() });
  const body = await r.json();
  if (!r.ok) throw new Error(`${endpoint}: ${r.status} ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

/** Download `url` to `path`. */
export async function download(url, path) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await r.arrayBuffer()));
  return path;
}

/** Upload a local file to fal's storage (for edits and audio-to-audio); resolves to its URL. */
export async function upload(bytes, contentType, fileName) {
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
  });
  if (!init.ok) throw new Error(`upload initiate ${init.status} ${await init.text()}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
  if (!put.ok) throw new Error(`upload ${put.status} ${await put.text()}`);
  return file_url;
}

/** Run jobs `limit` at a time. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
