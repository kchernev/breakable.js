// The sound packs, browsable: the base pack's and each world's, every sound and take, played on the library's engine from a chosen
// distance and direction (world sounds), or in the head (the player's own). A world's pack plays as in that world: at the levels its
// audio block sets.

import { packSettings, SoundEngine, type SoundOptions, type V3, type Voice } from '../lib/index.ts';
import { loadWorld, worlds } from './worlds/registry.ts';

// No loudness window here: every click should be heard
const engine = new SoundEngine({ window: 200 });
const list = document.getElementById('list')!;
const distance = document.getElementById('distance') as HTMLInputElement;
const angle = document.getElementById('angle') as HTMLInputElement;
const loops = new Map<string, Voice>();

const where = (): V3 => {
  const d = Number(distance.value);
  const a = (Number(angle.value) * Math.PI) / 180;
  // The listener at the origin looking down -z: 0° straight ahead, positive to the right
  return [Math.sin(a) * d, 0, -Math.cos(a) * d];
};
const showWhere = () => {
  document.getElementById('distanceOut')!.textContent = `${distance.value} m`;
  document.getElementById('angleOut')!.textContent = `${angle.value}°`;
};
distance.oninput = angle.oninput = showWhere;
showWhere();
document.getElementById('stop')!.onclick = () => {
  engine.stopAll(0.2);
  loops.clear();
  for (const b of document.querySelectorAll('button.on')) b.classList.remove('on');
};

interface Entry {
  src: string[];
  kind: string;
  space: string;
  duration: number[];
  play?: Omit<SoundOptions, 'src'>;
}

// The packs: the base one and every world's that has sounds
const packs: Array<{ id: string; title: string; base: string }> = [{ id: 'base', title: 'Base pack', base: 'sounds/' }];
for (const w of worlds) packs.push({ id: w.id, title: w.title, base: `packs/${w.id}/sounds/` });
const select = document.getElementById('pack') as HTMLSelectElement;
const indexes = new Map<string, Record<string, Entry>>();
await Promise.all(
  packs.map(async (p) => {
    try {
      const r = await fetch(`${p.base}index.json`);
      if (r.ok && r.headers.get('content-type')?.includes('json')) indexes.set(p.id, await r.json());
    } catch {
      // No sounds of its own
    }
  }),
);
for (const p of packs.filter((p) => indexes.has(p.id))) select.append(new Option(`${p.title} (${Object.keys(indexes.get(p.id)!).length})`, p.id));
const loaded = new Set<string>();
/** Where a world sets a sound's level apart from its pack (by key): shown by the sound. */
const levels = new Map<string, string>();

async function show(id: string): Promise<void> {
  const base = packs.find((p) => p.id === id)!.base;
  const index = indexes.get(id)!;
  // Each pack's sounds under its own names, so packs don't replace each other here
  if (!loaded.has(id)) {
    list.textContent = 'Loading…';
    const defs: Record<string, SoundOptions> = {};
    // Played as in the game: the pack's own settings over the library's for that name, then the
    // world's (and a loop it lists in its ambience at the level it lists it)
    const audio = id === 'base' ? null : await loadWorld(id).then((w) => w.audio, () => null);
    for (const [name, e] of Object.entries(index)) {
      const pack = { ...packSettings[name], space: e.space as 'world' | 'head', loop: e.kind === 'loop', ...e.play };
      const volume = (audio?.settings?.[name]?.volume ?? pack.volume ?? 1) * (audio?.ambience?.find((a) => a.sound === name)?.volume ?? 1);
      if (Math.abs(volume - (pack.volume ?? 1)) > 1e-6) levels.set(`${id}/${name}`, `${+volume.toFixed(3)} here (pack ${pack.volume ?? 1})`);
      defs[`${id}/${name}`] = { ...pack, ...audio?.settings?.[name], volume, src: e.src.map((f) => base + f) };
    }
    await engine.load(defs);
    loaded.add(id);
  }
  history.replaceState(null, '', `?pack=${id}`);
  list.textContent = '';
  let group = '';
  for (const [name, entry] of Object.entries(index)) row(`${id}/${name}`, name, entry, (head) => {
    if (head === group) return;
    group = head;
    const h = document.createElement('h2');
    h.textContent = head;
    list.append(h);
  });
}

function row(key: string, name: string, entry: Entry, heading: (head: string) => void): void {
  heading(name.split('.')[0]);
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('span');
  label.className = 'name';
  label.textContent = name;
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = [entry.kind, entry.space, levels.get(key)].filter(Boolean).join(' · ');
  row.append(label, tag);
  const play = (take?: number) => async (ev: MouseEvent) => {
    // Before the await: the event's currentTarget is null once its dispatch is over
    const button = ev.currentTarget as HTMLButtonElement;
    await engine.unlock();
    const at = entry.space === 'world' ? where() : undefined;
    if (entry.kind === 'loop') {
      const id = `${key}:${take}`;
      const playing = loops.get(id);
      if (playing) {
        playing.stop(0.3);
        loops.delete(id);
        button.classList.remove('on');
        return;
      }
      const v = engine.play(key, { at, take });
      if (v) {
        loops.set(id, v);
        button.classList.add('on');
      }
    } else engine.play(key, { at, take });
  };
  const any = document.createElement('button');
  any.textContent = entry.kind === 'loop' ? 'Loop' : 'Play';
  any.onclick = play();
  row.append(any);
  entry.src.forEach((_, k) => {
    const b = document.createElement('button');
    b.textContent = `${k + 1}`;
    b.title = `Take ${k + 1}: ${entry.duration[k].toFixed(2)} s`;
    b.onclick = play(k);
    row.append(b);
  });
  list.append(row);
}

const wanted = new URLSearchParams(location.search).get('pack');
select.value = wanted && indexes.has(wanted) ? wanted : 'base';
select.onchange = () => void show(select.value);
await show(select.value);

// Ears at the origin, looking down -z
const update = () => {
  engine.update(1 / 60);
  requestAnimationFrame(update);
};
update();
