// The props that come with the library (public/models, made by scripts/assets: GPT Image 2.5
// concepts, image-to-3D, cleaned up in Blender): each a GLB in metres (+Y up, vehicles facing -Z,
// standing on y = 0) with a convex collider and a mass, listed in public/models/index.json.

import type * as THREE from 'three/webgpu';
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
  tintMask?: 'alpha' | 'paint';
  /**
   * The pieces it breaks into (scripts/assets/shatter-props.py): a GLB of their shapes beside it
   * (its materials taken from the prop's own, by name), each piece's node, collider and mass.
   */
  shards?: { file: string; parts: Array<{ node: string; collider: V3[]; mass: number }> };
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
        const model: PropModel & { entry: PropPackEntry } = { name, object: gltf.scene, collider: entry.collider, colliders: entry.colliders, hullVertices: entry.hullVertices, mass: entry.mass, tint: entry.tint, tintMask: entry.tintMask, entry };
        if (entry.shards) model.shards = await shardsOf(loader, base, model, entry.shards);
        out[name] = model;
      }),
  );
  return out;
}

/** A prop's pieces as props of their own: its file's nodes, wearing the prop's materials by name. */
async function shardsOf(loader: GLTFLoader, base: string, model: PropModel, shards: NonNullable<PropPackEntry['shards']>): Promise<PropModel[]> {
  const gltf = await loader.loadAsync(base + shards.file);
  const own = new Map<string, THREE.Material>();
  model.object.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) own.set(x.name, x);
  });
  gltf.scene.updateWorldMatrix(true, true);
  return shards.parts.flatMap((part, i) => {
    // (The loader keeps names but for the characters it reserves)
    const node = gltf.scene.getObjectByName(part.node) ?? gltf.scene.getObjectByName(part.node.replace(/[.\[\]:/]/g, ''));
    if (!node) return [];
    node.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (m: THREE.Material) => own.get(m.name) ?? m;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    return [{ name: `${model.name}.shard${i}`, object: node, collider: part.collider, mass: part.mass, tint: model.tint, tintMask: model.tintMask, hullVertices: 16 }];
  });
}
