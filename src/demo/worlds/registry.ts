// The worlds: every src/demo/worlds/<id>/ with a meta.ts (its card) and an index.ts (loaded only
// when it's picked).

/// <reference types="vite/client" />
import type { WorldDefinition, WorldMeta } from './types.ts';

const metas = import.meta.glob<{ meta: WorldMeta }>('./*/meta.ts', { eager: true });
const loaders = import.meta.glob<{ default: WorldDefinition }>('./*/index.ts');

/** Every world's card, in order. */
export const worlds: WorldMeta[] = Object.values(metas)
  .map((m) => m.meta)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

/** Load a world by id (the first one if there's no such world). */
export async function loadWorld(id: string | null): Promise<WorldDefinition> {
  const meta = worlds.find((w) => w.id === id) ?? worlds[0];
  const load = loaders[`./${meta.id}/index.ts`];
  if (!load) throw new Error(`world ${meta.id}: no index.ts`);
  return (await load()).default;
}
