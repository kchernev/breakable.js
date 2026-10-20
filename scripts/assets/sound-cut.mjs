// Cutting takes: the functions process-sounds.mjs runs on a take's samples (one Float32Array per
// channel, at RATE), apart from its files so they can be tested.

export const RATE = 44100;

const slice = (ch, a, b) => ch.map((c) => c.slice(Math.max(0, a), Math.min(c.length, b)));
export const mono = (ch) => [ch[0].map((v, i) => (v + ch[1][i]) * 0.5)];

/** Loudness over time: the RMS of each `hop` of samples, across channels. */
function envelope(ch, hop) {
  const n = Math.floor(ch[0].length / hop);
  const env = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (const c of ch) for (let i = k * hop; i < (k + 1) * hop; i++) s += c[i] * c[i];
    env[k] = Math.sqrt(s / (hop * ch.length));
  }
  return env;
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
const peakOf = (ch) => Math.max(...ch.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));

/** The silence before and after cut: what stays starts 5 ms before it first gets within 45 dB of its loudest. */
export function trim(ch) {
  const hop = Math.round(RATE * 0.005);
  const env = envelope(ch, hop);
  const top = Math.max(...env);
  let a = env.findIndex((v) => v > top * 10 ** (-45 / 20));
  let b = env.length - 1;
  while (b > a && env[b] < top * 10 ** (-60 / 20)) b--;
  a = Math.max(0, a - 1);
  return slice(ch, a * hop, (b + 2) * hop);
}

/**
 * Start at the rise into its loudest part: where its loudness (over 50 ms) last came up through `db`
 * dB under its loudest, from 5 ms before.
 */
export function onset(ch, db) {
  const hop = Math.round(RATE * 0.005);
  const env = envelope(ch, hop);
  const smooth = env.map((_, k) => {
    let s = 0;
    for (let j = k; j < Math.min(env.length, k + 10); j++) s += env[j] ** 2;
    return Math.sqrt(s / 10);
  });
  let top = 0;
  for (let k = 1; k < smooth.length; k++) if (smooth[k] > smooth[top]) top = k;
  const under = smooth[top] * 10 ** (-db / 20);
  let a = top;
  while (a > 0 && smooth[a] >= under) a--;
  // The 50 ms from there rise through it: start at the first 5 ms that does
  while (a < top && env[a] < under) a++;
  return slice(ch, Math.max(0, a - 1) * hop, ch[0].length);
}

/** Fade in over `fin` seconds and out over `fout` (a cosine). */
export function fade(ch, fin, fout) {
  const n = ch[0].length;
  const a = Math.min(n, Math.round(fin * RATE));
  const b = Math.min(n, Math.round(fout * RATE));
  for (const c of ch) {
    for (let i = 0; i < a; i++) c[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
    for (let i = 0; i < b; i++) c[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / b);
  }
  return ch;
}

/**
 * A take's moves laid out anew (a reload timed to its animation): each part [from, to, at] (seconds;
 * `to` past the end is the end) cut out, faded in and out over 5 ms, and laid down at `at`.
 */
export function place(ch, parts) {
  const cut = parts.map(([a, b, at]) => ({ k: Math.round(at * RATE), ch: fade(slice(ch, Math.round(a * RATE), Math.round(b * RATE)), 0.005, 0.005) }));
  const out = ch.map(() => new Float32Array(Math.max(...cut.map((p) => p.k + p.ch[0].length))));
  for (const p of cut) p.ch.forEach((c, j) => c.forEach((v, i) => (out[j][p.k + i] += v)));
  return out;
}

/** A loop: `cut` seconds off both ends, then the last `x` seconds crossfaded (equal power) into the first. */
export function loop(ch, cut, x) {
  const c0 = Math.round(cut * RATE);
  const body = slice(ch, c0, ch[0].length - c0);
  const n = body[0].length;
  const X = Math.min(Math.round(x * RATE), Math.floor(n / 3));
  // out[t] = body[t + X] for the first n - 2X, then body's end fading out over its start fading in
  return body.map((c) => {
    const o = new Float32Array(n - X);
    for (let t = 0; t < n - X; t++) {
      const late = c[t + X];
      const k = t - (n - 2 * X);
      if (k < 0) o[t] = late;
      else {
        const f = k / X;
        o[t] = late * Math.cos((f * Math.PI) / 2) + c[k] * Math.sin((f * Math.PI) / 2);
      }
    }
    return o;
  });
}

/** Separate hits in one take (footsteps): each from just before its onset, for a third of a second (and where it was, s). */
export function slices(ch, most = 10) {
  const hop = Math.round(RATE * 0.005);
  const env = envelope(ch, hop);
  // An onset: rising well above the take's floor (its median), at least a quarter second after the last
  const floor = [...env].sort((a, b) => a - b)[env.length >> 1];
  const onsets = [];
  for (let k = 1; k < env.length; k++) {
    if (env[k] > floor * 4 && env[k - 1] <= floor * 4 && (!onsets.length || k - onsets[onsets.length - 1] > 50)) onsets.push(k);
  }
  const out = onsets.map((k, j) => {
    const a = (k - 3) * hop;
    const end = j + 1 < onsets.length ? (onsets[j + 1] - 4) * hop : ch[0].length;
    return fade(slice(ch, a, Math.min(end, a + Math.round(0.34 * RATE))), 0.002, 0.12);
  });
  // The strongest, in the order they came
  return out
    .map((s, i) => ({ s, i, p: peakOf(s) }))
    .sort((x, y) => y.p - x.p)
    .slice(0, most)
    .sort((x, y) => x.i - y.i)
    .map((x) => ({ ch: x.s, at: (onsets[x.i] * hop) / RATE }));
}

/** Level so its loudest 400 ms has an RMS of `target` dBFS, its peak no higher than -1 dBFS. */
export function level(ch, target) {
  const hop = Math.round(RATE * 0.05);
  const env = envelope(ch, hop);
  let loud = 0;
  for (let k = 0; k + 8 <= env.length || k === 0; k++) {
    let s = 0;
    const m = Math.min(8, env.length - k);
    for (let j = 0; j < m; j++) s += env[k + j] ** 2;
    loud = Math.max(loud, Math.sqrt(s / Math.max(m, 1)));
  }
  const gain = Math.min(10 ** ((target - db(loud)) / 20), 10 ** (-1 / 20) / peakOf(ch));
  for (const c of ch) for (let i = 0; i < c.length; i++) c[i] *= gain;
  return ch;
}
