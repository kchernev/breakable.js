// The props that come with the library (public/models, made by scripts/assets: GPT Image 2.5
// concepts, image-to-3D, cleaned up in Blender): each a GLB in metres (+Y up, vehicles facing -Z,
// standing on y = 0) with a convex collider and a mass, listed in public/models/index.json.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { PropModel } from './destruction.ts';
import type { V3 } from './math.ts';

/** One prop in the pack's index. */
export interface PropPackEntry {
  file: string;
  /** Its bounding box (m). */
  size: V3;
  mass: number;
  /** Points (the GLB's frame) whose convex hull it collides as. */
  collider: V3[];
  /** Or the convex parts it collides as, points each (PropModel.colliders): for props a single hull fits badly. */
  colliders?: V3[][];
  /** Most corners each of its hulls keeps (PropModel.hullVertices): more for round props that roll. */
  hullVertices?: number;
  triangles: number;
  description: string;
  /** Its paint's colour (process-props.py `paint`): its copies' tint unless addProp gives one. */
  tint?: number;
  /** 'alpha': a copy's tint goes where the colour map's alpha says (its paint). */
  tintMask?: 'alpha';
}

/** Load the pack from `base` (where public/models is served; default 'models/'): name → model. */
export async function loadPropPack(options: { base?: string; only?: string[] } = {}): Promise<Record<string, PropModel & { entry: PropPackEntry }>> {
  const base = options.base ?? 'models/';
  const r = await fetch(`${base}index.json`);
  if (!r.ok) throw new Error(`loadPropPack: ${base}index.json: ${r.status}`);
  const index = (await r.json()) as Record<string, PropPackEntry>;
  const loader = new GLTFLoader();
  const out: Record<string, PropModel & { entry: PropPackEntry }> = {};
  await Promise.all(
    Object.entries(index)
      .filter(([name]) => !options.only || options.only.includes(name))
      .map(async ([name, entry]) => {
        const gltf = await loader.loadAsync(base + entry.file);
        out[name] = { name, object: gltf.scene, collider: entry.collider, colliders: entry.colliders, hullVertices: entry.hullVertices, mass: entry.mass, tint: entry.tint, tintMask: entry.tintMask, entry };
      }),
  );
  return out;
}
