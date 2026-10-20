// The sound pack that comes with the library (public/sounds, made by scripts/assets with Stable
// Audio 3): how each sound is played (how loud, how far it carries, how many at once), which
// sounds each preset material makes, and a loader.

import type { SoundEngine, SoundOptions } from './audio.ts';
import type { MaterialSounds } from './destruction-audio.ts';

type Settings = Omit<SoundOptions, 'src'>;

/** How the pack's sounds are played. Override any of it in loadSoundPack's `settings`. */
export const packSettings: Record<string, Settings> = {
  // The launcher and its rocket
  'launcher.fire': { space: 'head', volume: 0.9, voices: 2, priority: 4, reverb: 0.35 },
  'launcher.reload': { space: 'head', volume: 0.45, voices: 1, priority: 2, reverb: 0.1 },
  'rocket.loop': { loop: true, near: 3, rolloff: 1.2, volume: 0.7, voices: 4, priority: 2, reverb: 0.2 },
  'rocket.flyby': { near: 4, volume: 0.8, voices: 2, priority: 2 },
  // Blasts: heard from far off; past 90 m, the distant boom
  'explosion.near': { near: 12, rolloff: 0.6, volume: 1, voices: 4, priority: 5, reverb: 0.5, pitch: [0.9, 1.08], distant: { sound: 'explosion.far', from: 90 } },
  'explosion.far': { near: 30, rolloff: 0.5, volume: 1, voices: 3, priority: 4, reverb: 0.6 },
  'explosion.debris': { near: 8, rolloff: 0.8, volume: 0.7, voices: 3, priority: 2, reverb: 0.4 },
  // Masonry
  'brick.break': { near: 4, volume: 0.7, voices: 5, cooldown: 0.06, spacing: 2 },
  'brick.impact.small': { bus: 'debris', near: 2, rolloff: 1.2, volume: 0.4, voices: 5, pitch: [0.85, 1.15] },
  'brick.impact.large': { bus: 'debris', near: 5, volume: 0.7, voices: 4, priority: 2 },
  'brick.debris': { bus: 'debris', near: 3, volume: 0.5, voices: 4 },
  'concrete.break': { near: 5, volume: 0.8, voices: 3 },
  'concrete.impact': { bus: 'debris', near: 5, volume: 0.7, voices: 4, priority: 2 },
  // Glass
  'glass.shatter': { near: 4, volume: 0.75, voices: 5, priority: 2, pitch: [0.9, 1.12] },
  'glass.debris': { bus: 'debris', near: 3, volume: 0.4, voices: 4, pitch: [0.9, 1.15] },
  // Wood
  'wood.break': { near: 3, volume: 0.6, voices: 3 },
  'wood.impact': { bus: 'debris', near: 2, volume: 0.4, voices: 4, pitch: [0.88, 1.12] },
  // Metal
  'metal.impact.small': { bus: 'debris', near: 3, volume: 0.32, voices: 3, pitch: [0.85, 1.15] },
  'metal.impact.large': { bus: 'debris', near: 6, volume: 0.65, voices: 3, priority: 2 },
  'metal.bend': { bus: 'debris', near: 5, volume: 0.6, voices: 2, cooldown: 0.8, spacing: 8 },
  // Structures giving way
  'collapse.rumble': { near: 10, rolloff: 0.7, volume: 1, voices: 3, priority: 3, cooldown: 1.2, spacing: 10, reverb: 0.5 },
  'structure.creak': { bus: 'debris', near: 6, volume: 0.55, voices: 2, cooldown: 1.5, spacing: 10 },
  'dust.settle': { bus: 'debris', near: 6, volume: 0.4, voices: 2, cooldown: 3, spacing: 15 },
  // The player
  'steps.asphalt': { space: 'head', volume: 0.3, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  'steps.rubble': { space: 'head', volume: 0.36, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  'player.land': { space: 'head', volume: 0.5, voices: 1, reverb: 0.15 },
  // Ambience and the city around
  'ambience.city': { space: 'head', loop: true, bus: 'ambience', volume: 0.35, voices: 1, reverb: 0 },
  'ambience.wind': { space: 'head', loop: true, bus: 'ambience', volume: 0.22, voices: 1, reverb: 0 },
  'siren.far': { space: 'head', loop: true, bus: 'ambience', volume: 0.3, voices: 1, reverb: 0 },
  'alarm.car': { loop: true, near: 6, volume: 0.5, voices: 2, reverb: 0.4 },
  'fire.loop': { loop: true, near: 3, volume: 0.6, voices: 3 },
};

/** Which of the pack's sounds the preset materials make. */
export const packMaterials: Record<string, MaterialSounds> = {
  brick: { break: 'brick.break', impact: 'brick.impact.small', heavyImpact: 'brick.impact.large', debris: 'brick.debris', strain: 'structure.creak', collapse: 'collapse.rumble', settle: 'dust.settle' },
  concrete: { break: 'concrete.break', impact: 'brick.impact.small', heavyImpact: 'concrete.impact', debris: 'brick.debris', strain: 'structure.creak', collapse: 'collapse.rumble', settle: 'dust.settle' },
  glass: { break: 'glass.shatter', impact: 'glass.debris', debris: 'glass.debris' },
  wood: { break: 'wood.break', impact: 'wood.impact', heavyImpact: 'wood.impact', debris: 'wood.impact' },
  metal: { break: 'metal.bend', impact: 'metal.impact.small', heavyImpact: 'metal.impact.large', strain: 'metal.bend', collapse: 'metal.impact.large' },
};

/** The pack's index (public/sounds/index.json): each sound's takes. */
interface PackIndex {
  [name: string]: { src: string[]; duration: number[]; kind: 'shot' | 'loop' | 'slice'; space: 'world' | 'head'; play?: Settings };
}

/**
 * Load the pack from `base` (where public/sounds is served; default 'sounds/'; a world's pack:
 * 'packs/<world>/sounds/'). Each sound is played as `settings` says, then as its pack's index
 * says (`play`), then as `packSettings` says for a sound of that name: a world pack's own settings
 * win over the library's. `only`: just these sounds.
 */
export async function loadSoundPack(engine: SoundEngine, options: { base?: string; settings?: Record<string, Settings>; only?: string[] } = {}): Promise<void> {
  const base = options.base ?? 'sounds/';
  const r = await fetch(`${base}index.json`);
  if (!r.ok) throw new Error(`loadSoundPack: ${base}index.json: ${r.status}`);
  const index = (await r.json()) as PackIndex;
  const defs: Record<string, SoundOptions> = {};
  for (const [name, entry] of Object.entries(index)) {
    if (options.only && !options.only.includes(name)) continue;
    defs[name] = { ...packSettings[name], space: entry.space, loop: entry.kind === 'loop', ...entry.play, ...options.settings?.[name], src: entry.src.map((f) => base + f) };
  }
  await engine.load(defs);
}
