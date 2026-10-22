// Scenery as dormant things (Destruction.addDormant): each unit (a far yard's box, a crane, a length
// of a ship's hull, a house, a tree) stands as what draws it and its fixed boxes, if any, until a
// round or a blast reaches it; then what draws it is hidden (an instance, or its part of a merged
// mesh: Merged), its boxes are taken out of the world, and it's built as pieces (boxPieces: a box
// cut into blocks, or walled round as a shed is; or a world's own builder).

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three/webgpu';
import type { Body, World } from 'three-avbd';
import type { Box3, Destruction, Piece, Q, V3 } from '../lib/index.ts';

export interface BoxPiecesOptions {
  /** Its middle, size (x, y, z before turning) and turn (about y, radians; or `rotation`). */
  at: V3;
  size: V3;
  turn?: number;
  rotation?: Q;
  material: string;
  tint?: THREE.ColorRepresentation;
  /** The longest a piece may be along any side (m; default 2.5). */
  most?: number;
  /** Hollow: walls this thick round it (and a roof unless `roof` is false), in panels; no floor. */
  hollow?: number;
  roof?: boolean;
}

/** A box as pieces: blocks of at most `most` a side, or its walls and roof in panels (`hollow`). */
export function boxPieces(d: Destruction, o: BoxPiecesOptions): Piece[] {
  const most = o.most ?? 2.5;
  const rotation: Q = o.rotation ?? [0, Math.sin((o.turn ?? 0) / 2), 0, Math.cos((o.turn ?? 0) / 2)];
  const out: Piece[] = [];
  // A box in the unit's frame (min, max: from its middle) as pieces
  const block = (min: V3, max: V3) => {
    const n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((max[k] - min[k]) / most - 1e-6)));
    const s = [0, 1, 2].map((k) => (max[k] - min[k]) / n[k]);
    for (let i = 0; i < n[0]; i++)
      for (let j = 0; j < n[1]; j++)
        for (let k = 0; k < n[2]; k++) {
          const local: V3 = [min[0] + s[0] * (i + 0.5), min[1] + s[1] * (j + 0.5), min[2] + s[2] * (k + 0.5)];
          const p = d.addBox({ material: o.material, size: [s[0], s[1], s[2]], position: toWorld(o.at, rotation, local), rotation, tint: o.tint });
          if (p) out.push(p);
        }
  };
  const [hx, hy, hz] = o.size.map((v) => v / 2) as V3;
  if (!o.hollow) {
    block([-hx, -hy, -hz], [hx, hy, hz]);
    return out;
  }
  const t = o.hollow;
  const top = o.roof === false ? hy : hy - t;
  // The long sides (along x) whole, the ends between them; the roof inside the walls
  block([-hx, -hy, hz - t], [hx, top, hz]);
  block([-hx, -hy, -hz], [hx, top, -hz + t]);
  block([hx - t, -hy, -hz + t], [hx, top, hz - t]);
  block([-hx, -hy, -hz + t], [-hx + t, top, hz - t]);
  if (o.roof !== false) block([-hx, hy - t, -hz], [hx, hy, hz]);
  return out;
}

function toWorld(at: V3, q: Q, p: V3): V3 {
  const v = new THREE.Vector3(...p).applyQuaternion(new THREE.Quaternion(...q));
  return [at[0] + v.x, at[1] + v.y, at[2] + v.z];
}

/** A unit: the instances it stands as, its fixed boxes, what it's built as. */
export interface DormantUnit {
  name?: string;
  bounds: Box3;
  instances?: Array<[THREE.InstancedMesh, number]>;
  bodies?: Body[];
  hide?: () => void;
  build: (d: Destruction) => void;
  blastOnly?: boolean;
}

/** Units of scenery, made dormant once the Destruction is made. */
export class DormantUnits {
  readonly units: DormantUnit[] = [];

  add(unit: DormantUnit): DormantUnit {
    this.units.push(unit);
    return unit;
  }

  dormant(d: Destruction): void {
    for (const u of this.units)
      d.addDormant({
        name: u.name,
        bounds: u.bounds,
        bodies: u.bodies,
        blastOnly: u.blastOnly,
        hide: () => {
          for (const [mesh, i] of u.instances ?? []) hideInstance(mesh, i);
          u.hide?.();
        },
        build: u.build,
      });
  }
}

const NONE = new THREE.Matrix4().makeScale(0, 0, 0);

export function hideInstance(mesh: THREE.InstancedMesh, index: number): void {
  mesh.setMatrixAt(index, NONE);
  mesh.instanceMatrix.needsUpdate = true;
}

/** A fixed box in the world for a box of the scenery (centre, size, turn about y). */
export function solidBox(world: World, at: V3, size: V3, turn = 0, rotation?: Q): Body {
  return world.addBox({ size, position: at, rotation: rotation ?? [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)], fixed: true, friction: 0.8 })!;
}

/** The box (world) a turned box stands in. */
export function boundsOf(at: V3, size: V3, turn = 0, rotation?: Q): Box3 {
  const q = new THREE.Quaternion(...(rotation ?? [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)]));
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const v = new THREE.Vector3((sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2).applyQuaternion(q);
        const p = [at[0] + v.x, at[1] + v.y, at[2] + v.z];
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], p[k]);
          max[k] = Math.max(max[k], p[k]);
        }
      }
  return { min, max };
}

/** The box round several. */
export function union(boxes: Box3[]): Box3 {
  return {
    min: [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k]))) as V3,
    max: [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]))) as V3,
  };
}

/**
 * Scenery drawn as one mesh of many parts (a town's walls, its houses), each part hidden on its own
 * once it wakes: its triangles collapsed to a point. Parts are added under a key (a unit's), the
 * mesh made once they're all in (build).
 */
export class Merged {
  private readonly parts: Array<{ key: number; geometry: THREE.BufferGeometry }> = [];
  private readonly ranges = new Map<number, Array<[number, number]>>();
  private position: THREE.BufferAttribute | null = null;

  add(key: number, geometry: THREE.BufferGeometry): void {
    this.parts.push({ key, geometry: geometry.index ? geometry.toNonIndexed() : geometry });
  }

  /** The mesh of all the parts (null if there are none), its vertices' ranges kept by key. */
  build(material: THREE.Material, name: string, castShadow = true): THREE.Mesh | null {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts.map((p) => p.geometry));
    if (!g) return null;
    let at = 0;
    for (const { key, geometry } of this.parts) {
      const n = geometry.attributes.position.count;
      const list = this.ranges.get(key) ?? [];
      list.push([at, n]);
      this.ranges.set(key, list);
      at += n;
    }
    this.position = g.attributes.position as THREE.BufferAttribute;
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `scenery:${name}`;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Hide a part: its triangles collapsed onto its first vertex. */
  hide(key: number): void {
    const pos = this.position;
    if (!pos) return;
    for (const [start, n] of this.ranges.get(key) ?? []) {
      const [x, y, z] = [pos.getX(start), pos.getY(start), pos.getZ(start)];
      for (let i = start; i < start + n; i++) pos.setXYZ(i, x, y, z);
      pos.addUpdateRange(start * 3, n * 3);
    }
    pos.needsUpdate = true;
  }
}
