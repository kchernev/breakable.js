// FragmentMesh: every piece of one material in a single draw. BodyMesh (three-avbd) draws many
// copies of one shape, but fracture makes every piece a shape of its own, so here each piece's
// triangles go into one big vertex buffer, each vertex carrying the slot of the body it belongs to;
// the vertex shader reads that body's pose from the solver's buffer, as BodyMesh does. Pieces come
// and go by allocating and freeing runs of vertices (only the changed runs are uploaded).
//
// A second buffer, one record per body slot shared by a world's meshes, holds what a material can
// read of the piece drawn there (pieceState, pieceFrame): whether it stands, is loose or is rubble,
// and its texture frame with its box as built.

import { attribute, color, cross, float, Fn, luminance, materialAO, materialColor, materialEmissive, mix, normalize, positionGeometry, step, storage, texture, transformNormalToView, uint, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import { B_POS, B_ROT, BODY_FLOATS } from 'three-avbd/advanced';
import type { Face } from './convex.ts';
import type { PieceState } from './destruction.ts';
import * as m3 from './math.ts';
import type { Box3, Q, V3 } from './math.ts';

type Vec3 = THREE.Node<'vec3'>;
type Vec4 = THREE.Node<'vec4'>;
type Float = THREE.Node<'float'>;

/** v turned by the unit quaternion q = (u, w): v + 2w(u × v) + 2u × (u × v). */
function rotate(q: Vec4, v: Vec3): Vec3 {
  const t = cross(q.xyz, v).mul(2);
  return v.add(t.mul(q.w)).add(cross(q.xyz, t));
}

/** A face of a piece, in its body's frame, ready to draw. */
export interface DrawFace {
  pts: V3[];
  n: V3;
  /** A normal at each corner (smooth shading; default: `n` at every corner). */
  normals?: V3[];
  /** Texture coordinates at each corner. */
  uv: Array<[number, number]>;
  /** Direction the texture's u runs along the face (body frame), and the handedness of v. */
  tangent: V3;
  sign: number;
  inner: boolean;
}

/** A run of vertices a piece holds. */
export interface Allocation {
  start: number;
  count: number;
}

/**
 * A piece's texture frame (in its body's frame, or in the world's), with what else of its look the
 * cells of a broken piece keep.
 */
export interface TextureFrame {
  position: V3;
  rotation: Q;
  /** Its box as built, in this frame (pieceFrame). */
  box?: Box3;
  /** Faces meeting at less than this angle (radians) are shaded as one smooth surface. */
  smooth?: number;
}

const FLOATS = { position: 3, normal: 3, ftangent: 4, uv: 2, pieceInfo: 2, tint: 3 } as const;

export interface FragmentLook {
  /** Colour of broken faces (a tint, with insideTexture). */
  inside: THREE.ColorRepresentation;
  /** How much of the map's grain shows on broken faces (0: flat). Default 0.35. */
  insideMap?: number;
  /** Broken faces' own maps, at `uvScale` repeats per metre. */
  insideTexture?: { map: THREE.Texture; normalMap?: THREE.Texture; uvScale?: number };
  /** The surface's repeats per metre (the texture coordinates' scale): one for u and v, or [u, v]. */
  uvScale?: number | [number, number];
  /**
   * How much of a piece's tint each point of the surface takes (1: all, 0: none, so it keeps the
   * surface's own colour): a float node, or a texture whose red channel says (at the surface's
   * texture coordinates). Default: all of it.
   */
  tintMask?: THREE.Node | THREE.Texture;
  /** 'standing': the surface glows (its emissive) only while its piece stands, and never on broken faces. */
  glow?: 'standing';
}

/** Repeats per metre along u and v. */
export function uvScales(s: number | [number, number] | undefined): [number, number] {
  return typeof s === 'number' ? [s, s] : (s ?? [1, 1]);
}

const STATE: Record<PieceState, number> = { fixed: 0, loose: 1, rubble: 2, gone: 3 };
/** Floats per body slot in the record buffer: the texture frame's rotation; its origin and the state; the box's centre; its half extents. */
const RECORD = 16;

/** One record per body slot, shared by a world's meshes: what a material can read of each piece. */
class PieceRecords {
  private static readonly worlds = new WeakMap<World, PieceRecords>();
  static of(world: World): PieceRecords {
    let r = PieceRecords.worlds.get(world);
    if (!r) PieceRecords.worlds.set(world, (r = new PieceRecords(world.maxBodies)));
    return r;
  }
  static find(world: World): PieceRecords | undefined {
    return PieceRecords.worlds.get(world);
  }

  readonly data: Float32Array;
  readonly node;
  /** A shader has been built that reads them (a material using pieceState, pieceFrame or glow). */
  read = false;
  private readonly attr: THREE.StorageBufferAttribute;
  private dirty: number[] = [];

  constructor(slots: number) {
    this.data = new Float32Array(slots * RECORD);
    this.attr = new THREE.StorageBufferAttribute(this.data, 4);
    this.node = storage(this.attr, 'vec4', slots * (RECORD / 4)).toReadOnly();
  }

  write(slot: number, frame: TextureFrame | null, state: PieceState): void {
    const o = slot * RECORD;
    if (o >= this.data.length) return;
    const d = this.data;
    d.set(frame?.rotation ?? [0, 0, 0, 1], o);
    d.set(frame?.position ?? [0, 0, 0], o + 4);
    d[o + 7] = STATE[state];
    const box = frame?.box;
    for (let k = 0; k < 3; k++) {
      d[o + 8 + k] = box ? (box.min[k] + box.max[k]) / 2 : 0;
      d[o + 12 + k] = box ? (box.max[k] - box.min[k]) / 2 : 0;
    }
    this.dirty.push(slot);
  }

  state(slot: number, state: PieceState): void {
    const i = slot * RECORD + 7;
    if (i >= this.data.length || this.data[i] === STATE[state]) return;
    this.data[i] = STATE[state];
    this.dirty.push(slot);
  }

  /** Upload the records that changed (once a frame; the meshes sharing them each ask). */
  flush(): void {
    if (!this.dirty.length) return;
    // Until a shader reads them nothing uploads them, and three keeps update ranges until it
    // uploads: they'd pile up. The first shader to read them uploads the whole buffer
    if (!this.read) {
      this.dirty = [];
      return;
    }
    this.dirty.sort((a, b) => a - b);
    let [s, e] = [this.dirty[0], this.dirty[0]];
    const range = () => this.attr.addUpdateRange(s * RECORD, (e - s + 1) * RECORD);
    for (const k of this.dirty) {
      if (k <= e + 16) e = Math.max(e, k);
      else {
        range();
        s = e = k;
      }
    }
    range();
    this.attr.needsUpdate = true;
    this.dirty = [];
  }
}

/** What a material can read of the piece drawn (made by each FragmentMesh for its material). */
interface PieceNodes {
  state: Float;
  inner: Float;
  position: Vec3;
  normal: Vec3;
  halfExtents: Vec3;
  tint: Vec3;
}

export class FragmentMesh extends THREE.Mesh<THREE.BufferGeometry, THREE.NodeMaterial> {
  readonly capacity: number;
  /** @internal What the accessors (pieceState, pieceFrame, pieceTint) read. */
  readonly pieceNodes: PieceNodes;
  private readonly attrs: Record<keyof typeof FLOATS, THREE.BufferAttribute>;
  private readonly records: PieceRecords;
  /** Free runs, by start. */
  private free: Allocation[] = [];
  private top = 0;
  private used = 0;
  /** Runs written, and runs cleared, since the last flush (vertex start, end). */
  private written: Array<[number, number]> = [];
  private cleared: Array<[number, number]> = [];

  /** @internal A piece's state changed (Destruction says): its record follows, for pieceState. */
  static setState(body: { world: World; index: number }, state: PieceState): void {
    PieceRecords.find(body.world)?.state(body.index, state);
  }

  constructor(world: World, material: THREE.NodeMaterial, look: FragmentLook, capacity = 400_000) {
    if (!world.bodyAttribute) throw new Error('FragmentMesh: the world has no body attribute (create it with a renderer)');
    const geometry = new THREE.BufferGeometry();
    const attrs = {} as Record<keyof typeof FLOATS, THREE.BufferAttribute>;
    for (const [name, size] of Object.entries(FLOATS) as Array<[keyof typeof FLOATS, number]>) {
      // Static usage: three's WebGPU backend uploads a DynamicDrawUsage attribute whole every frame;
      // these upload only the runs that changed (addUpdateRange), when they change
      attrs[name] = new THREE.BufferAttribute(new Float32Array(capacity * size), size);
      geometry.setAttribute(name, attrs[name]);
    }
    geometry.setDrawRange(0, 0);
    super(geometry, material);
    this.capacity = capacity;
    this.attrs = attrs;
    this.frustumCulled = false;
    const records = (this.records = PieceRecords.of(world));

    // The vertex's body, and the body's pose in the solver's buffer
    const vec4s = BODY_FLOATS / 4;
    const bodies = storage(world.bodyAttribute, 'vec4', world.maxBodies * vec4s).toReadOnly();
    const meta = attribute<'vec2'>('pieceInfo', 'vec2');
    const slot = uint(meta.x.add(0.5));
    const base = slot.mul(vec4s);
    const pos = bodies.element(base.add(B_POS / 4)).xyz;
    const rot = bodies.element(base.add(B_ROT / 4)) as unknown as Vec4;
    material.positionNode = rotate(rot, positionGeometry).add(pos);

    // The piece's record: its texture frame (`unturn` takes body-frame vectors into it), its box and
    // state. A shader built with any of it marks the records read (until then none are uploaded)
    const record = slot.mul(RECORD / 4);
    const field = (k: number) =>
      Fn(() => {
        records.read = true;
        return records.node.element(record.add(k));
      })() as unknown as Vec4;
    const frame = field(0);
    const origin = field(1);
    const unturn = vec4(frame.xyz.negate(), frame.w);
    const inner = varying(meta.y);
    this.pieceNodes = {
      state: varying(origin.w),
      inner,
      position: varying(rotate(unturn, positionGeometry.sub(origin.xyz)).sub(field(2).xyz)),
      normal: varying(rotate(unturn, attribute<'vec3'>('normal', 'vec3'))),
      halfExtents: varying(field(3).xyz),
      tint: attribute<'vec3'>('tint', 'vec3'),
    };

    // Normals turned with the body (in the vertex stage), then the map's bumps in the face's frame
    const n = varying(rotate(rot, attribute<'vec3'>('normal', 'vec3')));
    const tangent = attribute<'vec4'>('ftangent', 'vec4');
    const t = varying(rotate(rot, tangent.xyz));
    const b = varying(rotate(rot, cross(attribute<'vec3'>('normal', 'vec3'), tangent.xyz).mul(tangent.w)));
    // Broken faces' own maps, at their own scale
    const ins = look.insideTexture;
    const [su, sv] = uvScales(look.uvScale);
    const insideUV = ins ? uv().mul(vec2((ins.uvScale ?? 1) / su, (ins.uvScale ?? 1) / sv)) : null;
    const insideMap = look.insideMap ?? 0.35;
    let normal: Vec3 = normalize(n);
    const map = (material as THREE.MeshStandardNodeMaterial).normalMap;
    if (map || ins?.normalMap) {
      let bump: Vec3 = vec3(0, 0, 1);
      if (map) {
        const s = (material as THREE.MeshStandardNodeMaterial).normalScale ?? new THREE.Vector2(1, 1);
        const raw = texture(map, uv()).xyz.mul(2).sub(1);
        // Broken faces get the surface's bumps at the inside's share
        const k = mix(float(1), float(ins?.normalMap ? 0 : insideMap), inner);
        bump = vec3(raw.x.mul(s.x).mul(k), raw.y.mul(s.y).mul(k), raw.z);
      }
      if (ins?.normalMap) bump = mix(bump, texture(ins.normalMap, insideUV!).xyz.mul(2).sub(1), inner);
      normal = normalize(t.mul(bump.x).add(b.mul(bump.y)).add(normalize(n).mul(bump.z)));
    }
    material.normalNode = transformNormalToView(normal);

    // Colour: the surface's (its map and colour) tinted per piece outside, where its tint mask lets
    // the tint in; on breaks, the inside's map tinted by the inside colour, or the inside colour
    // with some of the surface's grain
    const tint = this.pieceNodes.tint;
    const mask = look.tintMask ? ((look.tintMask as THREE.Texture).isTexture ? texture(look.tintMask as THREE.Texture, uv()).r : (look.tintMask as Float)) : null;
    const outside = (material.colorNode ?? materialColor) as unknown as Vec4;
    let insideColor: Vec3;
    if (ins) insideColor = texture(ins.map, insideUV!).rgb.mul(color(new THREE.Color(look.inside)));
    else {
      const grain = (material as THREE.MeshStandardNodeMaterial).map ? luminance(texture((material as THREE.MeshStandardNodeMaterial).map!, uv()).rgb).mul(2.6) : float(1);
      insideColor = color(new THREE.Color(look.inside)).mul(mix(float(1), grain, insideMap));
    }
    material.colorNode = mix(outside.rgb.mul(mask ? mix(vec3(1, 1, 1), tint, mask) : tint), insideColor, inner) as unknown as THREE.Node<'color'>;
    // The surface's occlusion map darkens its own faces, not the broken ones
    if ((material as THREE.MeshStandardNodeMaterial).aoMap && !material.aoNode) material.aoNode = mix(materialAO, float(1), inner);
    if (look.glow === 'standing') {
      const lit = material as THREE.MeshStandardNodeMaterial;
      const emissive = (lit.emissiveNode ?? materialEmissive) as unknown as Vec3;
      lit.emissiveNode = emissive.mul(step(this.pieceNodes.state, 0.5)).mul(float(1).sub(inner)) as unknown as THREE.Node<'color'>;
    }
  }

  /** Vertices in use (drawn), and the most there have been at once. */
  get stats(): { used: number; top: number; capacity: number } {
    return { used: this.used, top: this.top, capacity: this.capacity };
  }

  /**
   * Add a piece: its faces in its body's frame, drawn where body `slot` is, with its texture frame
   * (body frame) and state for its record. Null when full.
   */
  insert(slot: number, faces: DrawFace[], tint: V3 = [1, 1, 1], frame: TextureFrame | null = null, state: PieceState = 'fixed'): Allocation | null {
    let count = 0;
    for (const f of faces) count += 3 * (f.pts.length - 2);
    const a = this.allocate(count);
    if (!a) return null;
    const { position, normal, ftangent, uv, pieceInfo, tint: tints } = this.attrs;
    const P = position.array as Float32Array;
    const N = normal.array as Float32Array;
    const T = ftangent.array as Float32Array;
    const U = uv.array as Float32Array;
    const M = pieceInfo.array as Float32Array;
    const C = tints.array as Float32Array;
    let v = a.start;
    for (const f of faces) {
      for (let i = 1; i + 1 < f.pts.length; i++) {
        for (const k of [0, i, i + 1]) {
          P.set(f.pts[k], 3 * v);
          N.set(f.normals?.[k] ?? f.n, 3 * v);
          T.set([f.tangent[0], f.tangent[1], f.tangent[2], f.sign], 4 * v);
          U.set(f.uv[k], 2 * v);
          M[2 * v] = slot;
          M[2 * v + 1] = f.inner ? 1 : 0;
          C.set(tint, 3 * v);
          v++;
        }
      }
    }
    this.records.write(slot, frame, state);
    this.touch(a);
    return a;
  }

  /** Stop drawing a piece (its vertices collapse to a point, and the run is reused). */
  release(a: Allocation): void {
    (this.attrs.position.array as Float32Array).fill(0, 3 * a.start, 3 * (a.start + a.count));
    this.cleared.push([a.start, a.start + a.count]);
    this.used -= a.count;
    // Back on the free list, merged with its neighbours
    const list = this.free;
    let i = 0;
    while (i < list.length && list[i].start < a.start) i++;
    list.splice(i, 0, { start: a.start, count: a.count });
    if (i + 1 < list.length && list[i].start + list[i].count === list[i + 1].start) {
      list[i].count += list[i + 1].count;
      list.splice(i + 1, 1);
    }
    if (i > 0 && list[i - 1].start + list[i - 1].count === list[i].start) {
      list[i - 1].count += list[i].count;
      list.splice(i, 1);
      i--;
    }
    // A free run at the end gives the space back
    const last = list[list.length - 1];
    if (last && last.start + last.count === this.top) {
      this.top = last.start;
      list.pop();
      this.geometry.setDrawRange(0, this.top);
    }
  }

  private allocate(count: number): Allocation | null {
    for (let i = 0; i < this.free.length; i++) {
      const f = this.free[i];
      if (f.count < count) continue;
      const a = { start: f.start, count };
      f.start += count;
      f.count -= count;
      if (!f.count) this.free.splice(i, 1);
      this.used += count;
      return a;
    }
    if (this.top + count > this.capacity) return null;
    const a = { start: this.top, count };
    this.top += count;
    this.used += count;
    this.geometry.setDrawRange(0, this.top);
    return a;
  }

  private touch(a: Allocation): void {
    this.written.push([a.start, a.start + a.count]);
  }

  /**
   * Upload what changed since the last flush: the runs written (every attribute) and the runs
   * cleared (positions only), each merged with its neighbours, and the pieces' records. Call once a
   * frame, before drawing (Destruction.update does): a blast makes hundreds of pieces, and this
   * sends a few ranges, not a few thousand.
   */
  flush(): void {
    const merge = (runs: Array<[number, number]>) => {
      runs.sort((x, y) => x[0] - y[0]);
      const out: Array<[number, number]> = [];
      for (const r of runs) {
        const last = out[out.length - 1];
        if (last && r[0] <= last[1] + 256) last[1] = Math.max(last[1], r[1]);
        else out.push([r[0], r[1]]);
      }
      return out;
    };
    if (this.written.length) {
      const runs = merge(this.written);
      for (const [name, size] of Object.entries(FLOATS) as Array<[keyof typeof FLOATS, number]>) {
        const attr = this.attrs[name];
        for (const [s, e] of runs) attr.addUpdateRange(size * s, size * (e - s));
        attr.needsUpdate = true;
      }
      // Written runs carry their positions too
      this.cleared = this.cleared.concat(runs);
      this.written = [];
    }
    if (this.cleared.length) {
      const attr = this.attrs.position;
      for (const [s, e] of merge(this.cleared)) attr.addUpdateRange(3 * s, 3 * (e - s));
      attr.needsUpdate = true;
      this.cleared = [];
    }
    this.records.flush();
  }
}

// --- What a material can read of the piece drawn -------------------------------------------------

/** A node of the piece being drawn, from the FragmentMesh drawing it (`fallback` in any other mesh). */
function ofPiece<T>(pick: (n: PieceNodes) => T, fallback: () => T): T {
  return Fn((builder) => (builder.object instanceof FragmentMesh ? pick(builder.object.pieceNodes) : fallback()))() as T;
}

/**
 * The state of the piece being drawn, for a BreakableMaterial's surface nodes, each 1 or 0:
 * `standing` (fixed, part of a structure), `loose` (moving), `rubble` (come to rest), and `broken`
 * on its broken faces (drawn with the material's inside). E.g. a sign lit while it stands:
 * `surface.emissiveNode = color(0xff3060).mul(4).mul(pieceState().standing)` (which is what
 * BreakableMaterial.glow 'standing' does with the surface's own emissive, off on broken faces).
 * Outside a FragmentMesh: standing.
 */
export function pieceState(): { standing: Float; loose: Float; rubble: Float; broken: Float } {
  return {
    standing: ofPiece((n) => step(n.state, 0.5), () => float(1)),
    loose: ofPiece((n) => step(0.5, n.state).mul(step(n.state, 1.5)), () => float(0)),
    rubble: ofPiece((n) => step(1.5, n.state), () => float(0)),
    broken: ofPiece((n) => n.inner, () => float(0)),
  };
}

/**
 * Where the point drawn lies on its piece, for surface details that follow the piece's shape, all
 * in the piece's texture frame (its own frame unless PieceOptions.textureFrame gives another):
 * `position` (m) from the centre of its box as built, so a box's faces lie at ±`halfExtents`;
 * `normal`, the face's (smooth where PieceOptions.smooth); `halfExtents`, half its box's size. The
 * cells of a broken piece keep their piece's frame and box, so a drafted margin stays on the
 * block's edges: `halfExtents.sub(abs(position))` is how far in from each pair of faces. Round the
 * frame's y lies a drum's axis (shapes' cylinder): its flutes go by atan(position.z, position.x).
 * Outside a FragmentMesh: zero, and an up normal.
 */
export function pieceFrame(): { position: Vec3; normal: Vec3; halfExtents: Vec3 } {
  return {
    position: ofPiece((n) => n.position, () => vec3(0, 0, 0)),
    normal: ofPiece((n) => n.normal, () => vec3(0, 1, 0)),
    halfExtents: ofPiece((n) => n.halfExtents, () => vec3(0, 0, 0)),
  };
}

/** The tint of the piece being drawn (PieceOptions.tint; white outside a FragmentMesh). */
export function pieceTint(): Vec3 {
  return ofPiece((n) => n.tint, () => vec3(1, 1, 1));
}

// --- Faces to draw ------------------------------------------------------------------------------

/**
 * A piece's faces (its body's frame) with their texture coordinates, box-projected in its texture
 * frame (body frame) at `uvScale` repeats per metre, and smooth normals where the frame says.
 */
export function drawFaces(faces: Face[], frame: TextureFrame, uvScale: number | [number, number]): DrawFace[] {
  const { position: o, rotation: r } = frame;
  const [su, sv] = uvScales(uvScale);
  const inv = m3.conjugate(r);
  const normals = frame.smooth ? smoothNormals(faces, frame.smooth) : null;
  return faces.map((f, i) => {
    const tn = m3.rotate(inv, f.n);
    const ax = Math.abs(tn[0]) > Math.abs(tn[1]) && Math.abs(tn[0]) > Math.abs(tn[2]) ? 0 : Math.abs(tn[1]) > Math.abs(tn[2]) ? 1 : 2;
    // u and v axes (texture frame) for the dominant axis, u flipped so the map isn't mirrored
    const [ua, va]: [V3, V3] =
      ax === 0 ? [[0, 0, -Math.sign(tn[0]) || -1], [0, 1, 0]]
      : ax === 1 ? [[1, 0, 0], [0, 0, -Math.sign(tn[1]) || -1]]
      : [[Math.sign(tn[2]) || 1, 0, 0], [0, 1, 0]];
    const uv = f.pts.map((p) => {
      const q = m3.rotate(inv, m3.sub(p, o));
      return [m3.dot(q, ua) * su, m3.dot(q, va) * sv] as [number, number];
    });
    // The directions u and v run along the face, in the body's frame
    const along = (a: V3) => {
      const w = m3.rotate(r, a);
      return m3.normalize(m3.sub(w, m3.scale(f.n, m3.dot(w, f.n))));
    };
    const t = along(ua);
    const b = along(va);
    return { pts: f.pts, n: f.n, normals: normals?.[i], uv, tangent: t, sign: m3.dot(m3.cross(f.n, t), b) < 0 ? -1 : 1, inner: f.inner };
  });
}

/**
 * A normal at each corner of the faces that aren't broken: at each, the faces around that corner
 * meeting this one at under `angle` (radians), weighted by their angle there. A drum's sides meet
 * at 22.5°, its ends at 90°: at 0.5 it shades round with sharp rims.
 */
function smoothNormals(faces: Face[], angle: number): Array<V3[] | undefined> {
  const cos = Math.cos(angle) - 1e-9;
  const key = (p: V3) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;
  const around = new Map<string, Array<{ n: V3; w: number }>>();
  for (const f of faces) {
    if (f.inner) continue;
    const k = f.pts.length;
    f.pts.forEach((p, i) => {
      const a = m3.normalize(m3.sub(f.pts[(i + k - 1) % k], p));
      const b = m3.normalize(m3.sub(f.pts[(i + 1) % k], p));
      const w = Math.acos(Math.max(-1, Math.min(1, m3.dot(a, b))));
      const list = around.get(key(p));
      if (list) list.push({ n: f.n, w });
      else around.set(key(p), [{ n: f.n, w }]);
    });
  }
  return faces.map((f) => {
    if (f.inner) return undefined;
    return f.pts.map((p) => {
      let s = m3.scale(f.n, 1e-6);
      for (const g of around.get(key(p)) ?? []) if (m3.dot(g.n, f.n) >= cos) s = m3.add(s, m3.scale(g.n, g.w));
      return m3.normalize(s);
    });
  });
}

/** The box of faces (its body's frame) in a texture frame (body frame). */
export function frameBox(faces: Face[], frame: TextureFrame): Box3 {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const f of faces)
    for (const p of f.pts) {
      const q = m3.toLocal(frame.position, frame.rotation, p);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], q[k]);
        max[k] = Math.max(max[k], q[k]);
      }
    }
  return { min, max };
}

/**
 * A texture frame moved at random along its own axes by up to `amount` of a tile of the map (at
 * `uvScale` repeats per metre: u along x, v along y, z's tile the larger), so same-sized pieces
 * don't show the same patch (BreakableMaterial.uvJitter).
 */
export function jitterFrame<T extends TextureFrame>(frame: T, uvScale: number | [number, number], amount: number, rand: () => number): T {
  const [su, sv] = uvScales(uvScale);
  const step: V3 = [(rand() * amount) / su, (rand() * amount) / sv, (rand() * amount) / Math.min(su, sv)];
  return { ...frame, position: m3.toWorld(frame.position, frame.rotation, step) };
}
