// Which glowing pieces are lit, and how much: a buffer of four floats per body slot, read by the
// neon, lightbox and lamp materials. x: how lit (0 for the curtains and blinds, which are unlit
// lamp pieces; a lamp's or lit panel's level; the flickering sign writes its envelope), y, z, w:
// where a lightbox face samples the glyph atlas (scale and offset). The cells of a broken piece take
// its values, so a cracked lightbox keeps its glyphs. Going dark once loose, and on broken faces, is
// the materials' own (glow: 'standing'); this keeps track of which lit pieces fell, for the
// reactions and the wet street, and puts out what the gun shoots dark (out).
//
// The library has no accessor for a piece's body slot, so values() reads it from the fragment
// mesh's 'pieceInfo' attribute (x: the slot).

import { attribute, storage, uint, uniform, varying } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Destruction, Piece, V3 } from '../../../lib/index.ts';

/** Body slots the buffer covers (the demo's world has 60,000). */
const SLOTS = 65536;

export class Glow {
  readonly attr: THREE.StorageBufferAttribute;
  /** The buffer, as the materials read it. */
  readonly node;
  /** The street's power (blasts brown it out, the transformer blacks it out). */
  readonly power = uniform(1);
  private readonly data: Float32Array;
  /** Each slot's own level (x), which a stutter dims (dim) and gives back. */
  private readonly base = new Float32Array(SLOTS);
  /** Lit pieces that stand, to watch for coming loose. */
  private readonly standing = new Set<Piece>();
  private dirty: number[] = [];
  /** Which sign each piece belongs to (its cells inherit it, and a broken piece keeps it). */
  private readonly groups = new WeakMap<Piece, number>();
  /** What a lit piece broke into. */
  private readonly cells = new WeakMap<Piece, Piece[]>();
  /** Lit pieces that broke or fell since the reactions last looked: where, and their sign. */
  lost: Array<{ at: V3; group: number; tint: V3; cracked: boolean; material: string }> = [];

  /** The glowing materials (their pieces' values follow them through breaks). */
  private readonly materials: Set<string>;

  constructor(materials: string[]) {
    this.materials = new Set(materials);
    this.data = new Float32Array(SLOTS * 4);
    this.attr = new THREE.StorageBufferAttribute(this.data, 4);
    this.node = storage(this.attr, 'vec4', SLOTS).toReadOnly();
  }

  /** This vertex's piece's values, read in the vertex stage. */
  values(): THREE.Node<'vec4'> {
    const slot = uint(attribute<'vec2'>('pieceInfo', 'vec2').x.add(0.5));
    return varying(this.node.element(slot)) as unknown as THREE.Node<'vec4'>;
  }

  /** Light a standing piece; `map`: its atlas scale and offset (lightboxes). */
  light(p: Piece | null, map?: [number, number, number]): void {
    if (!p) return;
    const i = p.body.index * 4;
    this.data[i] = 1;
    this.base[p.body.index] = 1;
    if (map) this.data.set(map, i + 1);
    this.dirty.push(p.body.index);
    this.standing.add(p);
  }

  /** Set how lit a piece is (a level, a flicker), while it stands. */
  set(p: Piece, lit: number): void {
    this.base[p.body.index] = lit;
    this.write(p, lit);
  }

  /** Light a standing lit piece at `k` × its level for now (a stutter); dim(p, 1) gives it back. */
  dim(p: Piece, k: number): void {
    // (A piece gone may have left its slot to another)
    if (this.standing.has(p)) this.write(p, this.base[p.body.index] * k);
  }

  private write(p: Piece, lit: number): void {
    const i = p.body.index * 4;
    if (this.data[i] === lit) return;
    this.data[i] = lit;
    this.dirty.push(p.body.index);
  }

  /** Say which sign a piece belongs to. */
  tag(p: Piece, group: number): void {
    this.groups.set(p, group);
  }

  /** The sign a piece belongs to (its own, its cells', a raceway's or a backing's too). */
  groupOf(p: Piece): number | undefined {
    return this.groups.get(p);
  }

  /** The lit pieces still standing, by sign. */
  bySign(): Map<number, Piece[]> {
    const out = new Map<number, Piece[]>();
    for (const p of this.standing) {
      const g = this.groups.get(p);
      if (g === undefined) continue;
      let list = out.get(g);
      if (!list) out.set(g, (list = []));
      list.push(p);
    }
    return out;
  }

  /** Whether a piece glows (it was lit and still stands). */
  lit(p: Piece): boolean {
    return this.standing.has(p);
  }

  /** What of a piece still glows: itself, or what of it stands lit if it broke. */
  litOf(p: Piece): Piece[] {
    return this.standing.has(p) ? [p] : (this.cells.get(p) ?? []).flatMap((c) => this.litOf(c));
  }

  /** Put a piece out for good (shot dark), or what of it still glows if it broke. */
  out(p: Piece): void {
    for (const q of this.litOf(p)) {
      this.set(q, 0);
      this.standing.delete(q);
    }
  }

  /** Watch a structure's breaks: the cells of a glowing piece take its values. Returns the unsubscribe. */
  watch(d: Destruction): () => void {
    return d.on('fracture', ({ piece, pieces }) => {
      const group = this.groups.get(piece);
      if (group !== undefined) for (const c of pieces) this.groups.set(c, group);
      if (!this.materials.has(piece.materialName)) return;
      const from = piece.body.index * 4;
      const values = this.data.slice(from, from + 4);
      const level = this.base[piece.body.index];
      const lit = this.standing.has(piece);
      if (lit) this.lost.push({ at: piece.pose.position, group: group ?? -1, tint: piece.tint, cracked: true, material: piece.materialName });
      this.standing.delete(piece);
      this.cells.set(piece, pieces);
      for (const c of pieces) {
        this.data.set(values, c.body.index * 4);
        this.base[c.body.index] = level;
        this.dirty.push(c.body.index);
        if (lit && c.state === 'fixed') this.standing.add(c);
      }
    });
  }

  /** Each frame: note the lit pieces that came loose or went; changes go to the GPU (only the slots that changed). */
  update(): void {
    for (const p of this.standing) {
      if (p.state === 'fixed') continue;
      this.standing.delete(p);
      this.lost.push({ at: p.pose.position, group: this.groups.get(p) ?? -1, tint: p.tint, cracked: false, material: p.materialName });
    }
    if (!this.dirty.length) return;
    this.dirty.sort((a, b) => a - b);
    let [s, e] = [this.dirty[0], this.dirty[0]];
    const flush = () => this.attr.addUpdateRange(s * 4, (e - s + 1) * 4);
    for (const k of this.dirty) {
      if (k <= e + 8) e = Math.max(e, k);
      else {
        flush();
        s = e = k;
      }
    }
    flush();
    this.attr.needsUpdate = true;
    this.dirty = [];
  }

  /** Every lit piece (for the reactions: which signs still glow). */
  get count(): number {
    return this.standing.size;
  }
}
