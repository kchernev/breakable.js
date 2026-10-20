// Texture sets for materials: a set is three 1k WebP maps, `<set>_diff` (colour), `<set>_nor_gl`
// (OpenGL normal) and `<set>_arm` (occlusion, roughness, metalness), in the base pack's
// public/textures or a world pack's (`base`: 'packs/<world>/textures/').

import * as THREE from 'three/webgpu';
import type { BreakableMaterial } from '../lib/index.ts';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
/** repeat()'s copies of a map made before its image arrived: each is uploaded once it has. */
const waiting = new Map<THREE.Texture, THREE.Texture[]>();

export interface TextureOptions {
  /** Where the set is (default 'textures/'). */
  base?: string;
}

/** One map of a set, repeating, cached. */
export function texture(name: string, colour: boolean, base = 'textures/'): THREE.Texture {
  const url = `${base}${name}_1k.webp`;
  let t = cache.get(url);
  if (!t) {
    t = loader.load(url, (map) => {
      for (const c of waiting.get(map) ?? []) c.needsUpdate = true;
      waiting.delete(map);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    cache.set(url, t);
  }
  return t;
}

/**
 * A standard material of a set: its colour, its normals, and roughness (and, with `metalMap`,
 * metalness) from the packed map. `roughness` and `metalness` scale the map's (defaults 1, and 1
 * with a metal map, else 0: not metal). `ao`: the packed map's occlusion too, this strong (default
 * none; on pieces it shades their own faces, not their broken ones).
 */
export function textured(
  set: string,
  options: TextureOptions & { color?: THREE.ColorRepresentation; normalScale?: number; roughness?: number; metalness?: number; metalMap?: boolean; ao?: number } = {},
): THREE.MeshStandardNodeMaterial {
  const arm = texture(`${set}_arm`, false, options.base);
  const m = new THREE.MeshStandardNodeMaterial({
    map: texture(`${set}_diff`, true, options.base),
    normalMap: texture(`${set}_nor_gl`, false, options.base),
    roughnessMap: arm,
    roughness: options.roughness ?? 1,
    metalness: options.metalness ?? (options.metalMap ? 1 : 0),
    color: options.color ?? 0xffffff,
  });
  if (options.metalMap) m.metalnessMap = arm;
  if (options.ao) {
    m.aoMap = arm;
    m.aoMapIntensity = options.ao;
  }
  const n = options.normalScale ?? 1;
  m.normalScale.set(n, n);
  return m;
}

/** A set's colour and normal maps for broken faces (BreakableMaterial.insideTexture), at `uvScale` repeats a metre. */
export function inside(set: string, uvScale: number, options: TextureOptions = {}): BreakableMaterial['insideTexture'] {
  return { map: texture(`${set}_diff`, true, options.base), normalMap: texture(`${set}_nor_gl`, false, options.base), uvScale };
}

/**
 * A static textured mesh's maps (texture()'s) repeated `x` × `y` times. The maps are shared
 * (cached), so this clones them for the material. A copy shares its map's image: one made before
 * the image arrived waits for it (marked for upload with no image, the renderer would fail on it
 * every frame, and the page with it).
 */
export function repeat(m: THREE.MeshStandardNodeMaterial, x: number, y: number): THREE.MeshStandardNodeMaterial {
  for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const) {
    const t = m[key];
    if (!t) continue;
    const c = t.clone();
    c.repeat.set(x, y);
    if (!t.image) {
      c.version = 0;
      waiting.set(t, [...(waiting.get(t) ?? []), c]);
    }
    m[key] = c;
  }
  return m;
}
