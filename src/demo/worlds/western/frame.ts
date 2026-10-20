// Building in a structure's own frame: x along its front, y up, z back from the front (the street
// is at -z). A frame is placed and turned about y, so the same code builds the north row, the
// south row (turned half round) and the chapel (turned a quarter). Walls are courses between posts
// with holes for openings, clipped under a roof line; roofs are slopes of rafters with sheets on.

import * as THREE from 'three/webgpu';
import type { Destruction, Piece, Pose, Q, V3 } from '../../../lib/index.ts';
import { add, multiply, quatFromAxisAngle, random, rotate } from '../../../lib/index.ts';

export const qy = (a: number): Q => quatFromAxisAngle([0, 1, 0], a);

/** A rotation from its basis (the rotated x, y and z axes: unit, at right angles, right-handed). */
function quatFromBasis(x: V3, y: V3, z: V3): Q {
  const [m00, m10, m20] = x;
  const [m01, m11, m21] = y;
  const [m02, m12, m22] = z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

// A beam's grain follows the map's v, which is the piece's own y on its long faces: beams are
// boxes long on y, turned to lie along x or z
const ALONG_X: Q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
const ALONG_Z: Q = quatFromAxisAngle([1, 0, 0], Math.PI / 2);

/** Materials whose maps run on across pieces (laps, courses): one texture frame per structure. */
const SKINS = new Set(['siding', 'adobe', 'brick']);

interface Extra {
  tint?: THREE.ColorRepresentation;
  /** A texture frame of its own (signs on their atlas row, a side wall's skin). */
  tex?: Pose;
  /** Shade faces meeting at less than this (radians) round: eight-sided posts, bottles, the bell. */
  smooth?: number;
  loose?: boolean;
  bond?: boolean;
}

export class Frame {
  readonly q: Q;
  /** The skin materials' texture frame: siding laps line up from the sill top at y 0.30. */
  readonly skin: Pose;
  /** The same turned a quarter, its x along the frame's z: a side wall's (its boards' grain along it). */
  readonly side: Pose;
  readonly rand: () => number;
  /** Every piece made through this frame. */
  readonly made: Piece[] = [];

  readonly d: Destruction;
  readonly origin: V3;

  constructor(d: Destruction, origin: V3, angle = 0, seed = 1) {
    this.d = d;
    this.origin = origin;
    this.q = qy(angle);
    this.rand = random(seed);
    this.skin = { position: this.at(0, 0.3, 0), rotation: this.q };
    this.side = { position: this.skin.position, rotation: multiply(this.q, quatFromAxisAngle([0, 1, 0], -Math.PI / 2)) };
  }

  at(x: number, y: number, z: number): V3 {
    return add(this.origin, rotate(this.q, [x, y, z]));
  }

  /** A direction of the frame in the world. */
  dir(v: V3): V3 {
    return rotate(this.q, v);
  }

  /** Unpainted timber varies a little piece to piece (±6%). */
  private tintFor(material: string): THREE.ColorRepresentation | undefined {
    if (material !== 'timber') return undefined;
    const v = 0.94 + this.rand() * 0.12;
    return new THREE.Color(v, v * (0.99 + this.rand() * 0.02), v * (0.98 + this.rand() * 0.02));
  }

  private keep(p: Piece | null): Piece | null {
    if (p) this.made.push(p);
    return p;
  }

  /** A box square to the frame: its min corner and size. */
  box(material: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, o: Extra = {}): Piece | null {
    const position = this.at(x + sx / 2, y + sy / 2, z + sz / 2);
    return this.keep(
      this.d.addBox({
        material,
        size: [sx, sy, sz],
        position,
        rotation: this.q,
        tint: o.tint ?? this.tintFor(material),
        textureFrame: o.tex ?? (SKINS.has(material) ? this.skin : undefined),
        smooth: o.smooth,
        loose: o.loose,
        bond: o.bond,
      }),
    );
  }

  /** A beam lying along x or z (whichever is longer), given as a box (min corner and size), its grain along it. */
  beam(material: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, o: Extra = {}): Piece | null {
    const alongX = sx >= sz;
    const position = this.at(x + sx / 2, y + sy / 2, z + sz / 2);
    const rotation = multiply(this.q, alongX ? ALONG_X : ALONG_Z);
    return this.keep(
      this.d.addBox({
        material,
        size: alongX ? [sy, sx, sz] : [sx, sz, sy],
        position,
        rotation,
        tint: o.tint ?? this.tintFor(material),
        smooth: o.smooth,
        loose: o.loose,
        bond: o.bond,
      }),
    );
  }

  /** A beam split into lengths of at most `max` that share their end faces. */
  beams(material: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, max = 1.9, o: Extra = {}): Piece[] {
    const alongX = sx >= sz;
    const len = alongX ? sx : sz;
    const n = Math.max(1, Math.ceil(len / max - 1e-6));
    const out: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * len) / n;
      const p = alongX ? this.beam(material, x + a, y, z, len / n, sy, sz, o) : this.beam(material, x, y, z + a, sx, sy, len / n, o);
      if (p) out.push(p);
    }
    return out;
  }

  /** A post (grain up) split into lengths of at most `max`. */
  post(material: string, x: number, y0: number, z: number, sx: number, h: number, sz: number, max = 1.8, o: Extra = {}): Piece[] {
    const n = Math.max(1, Math.ceil(h / max - 1e-6));
    const out: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.box(material, x, y0 + (i * h) / n, z, sx, h / n, sz, o);
      if (p) out.push(p);
    }
    return out;
  }

  /** A box at `center` (frame), turned by `rot` in the frame. */
  tilt(material: string, center: V3, size: V3, rot: Q, o: Extra = {}): Piece | null {
    const position = this.at(...center);
    const rotation = multiply(this.q, rot);
    return this.keep(
      this.d.addBox({ material, size, position, rotation, tint: o.tint ?? this.tintFor(material), smooth: o.smooth, loose: o.loose, bond: o.bond }),
    );
  }

  /** The hull of points given in the frame; `grain`: its texture frame's turn in the frame (the grain runs along its y). */
  hull(material: string, points: V3[], o: Extra & { grain?: Q; grainAt?: V3 } = {}): Piece | null {
    const textureFrame: Pose | undefined =
      o.tex ?? (SKINS.has(material) ? this.skin : o.grain ? { position: this.at(...(o.grainAt ?? [0, 0, 0])), rotation: multiply(this.q, o.grain) } : undefined);
    return this.keep(
      this.d.addConvex({ material, points, position: this.origin, rotation: this.q, tint: o.tint ?? this.tintFor(material), textureFrame, smooth: o.smooth, loose: o.loose, bond: o.bond }),
    );
  }

  bond(a: Piece | null | undefined, b: Piece | null | undefined, area = 0.02): void {
    if (a && b && a.state === 'fixed' && b.state === 'fixed') this.d.bond(a, b, area);
  }
}

/** Of `pieces`, the one whose bounds hold the point (within a centimetre). */
export function holding(pieces: Piece[], p: V3): Piece | undefined {
  return pieces.find((q) => {
    const b = q.bounds;
    return [0, 1, 2].every((k) => p[k] >= b.min[k] - 0.01 && p[k] <= b.max[k] + 0.01);
  });
}

/** Of `pieces`, the one whose bounds hold the point's x and z (what a rafter's foot rests on). */
export function under(pieces: Piece[], p: V3): Piece | undefined {
  return pieces.find((q) => {
    const b = q.bounds;
    return p[0] >= b.min[0] - 0.01 && p[0] <= b.max[0] + 0.01 && p[2] >= b.min[2] - 0.01 && p[2] <= b.max[2] + 0.01;
  });
}

// --- Walls -----------------------------------------------------------------------------------

/** A hole in a wall's courses: along the wall from a to b, from y0 up to y1. */
export interface Hole {
  a: number;
  b: number;
  y0: number;
  y1: number;
}

interface WallSpec {
  material: string;
  /** The wall runs along the frame's x (a front or back) or z (a side). */
  axis: 'x' | 'z';
  /** Where its inner (lower) face is on the other axis, and how thick it is. */
  at: number;
  t: number;
  /** Its extent along the wall. */
  from: number;
  to: number;
  /** The first course's foot, and the course height. */
  y0: number;
  course: number;
  /** Its top: a height, or a roof line ([u, y] points, a convex outline from below: gables, sheds). */
  top: number | Array<[number, number]>;
  /** Posts (timber) at these places along it, `pw` square. */
  posts?: number[];
  pw?: number;
  postTint?: THREE.ColorRepresentation;
  holes?: Hole[];
  /** Longest piece; with `stagger`, joints offset by half a block in every other course (running bond). */
  block?: number;
  stagger?: boolean;
  tint?: THREE.ColorRepresentation | ((c: number, i: number) => THREE.ColorRepresentation | undefined);
}

/** Clip a convex polygon to the half-plane a·u + b·y <= c. */
function clipPoly(poly: Array<[number, number]>, a: number, b: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = a * p[0] + b * p[1] - c;
    const fq = a * q[0] + b * q[1] - c;
    if (fp <= 1e-9) out.push(p);
    if ((fp < -1e-9 && fq > 1e-9) || (fp > 1e-9 && fq < -1e-9)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** The height of a roof line at u (the lowest of its segments' lines: it's convex from below). */
function lineAt(top: number | Array<[number, number]>, u: number): number {
  if (typeof top === 'number') return top;
  let y = Infinity;
  for (let i = 0; i + 1 < top.length; i++) {
    const [u0, y0] = top[i];
    const [u1, y1] = top[i + 1];
    y = Math.min(y, y0 + ((y1 - y0) * (u - u0)) / (u1 - u0));
  }
  return y;
}

/** A wall of courses, between its posts and round its holes, under its top. Returns its pieces by course. */
export function wall(f: Frame, s: WallSpec): { courses: Piece[][]; posts: Piece[][] } {
  const pw = s.pw ?? 0.16;
  const posts = s.posts ?? [];
  const tex = s.axis === 'z' && SKINS.has(s.material) ? f.side : undefined;
  const maxTop = typeof s.top === 'number' ? s.top : Math.max(...s.top.map((p) => p[1]));
  const block = s.block ?? 1.9;
  // The wall's open spans between posts
  const bays: Array<[number, number]> = [];
  let u = s.from;
  for (const p of [...posts].sort((a, b) => a - b)) {
    const a = Math.max(s.from, p - pw / 2);
    if (a - u > 0.005) bays.push([u, a]);
    u = Math.min(s.to, p + pw / 2);
  }
  if (s.to - u > 0.005) bays.push([u, s.to]);

  const place = (u0: number, u1: number, y0: number, y1: number, material: string, tint?: THREE.ColorRepresentation): Piece | null => {
    let poly: Array<[number, number]> = [
      [u0, y0],
      [u1, y0],
      [u1, y1],
      [u0, y1],
    ];
    let clipped = false;
    if (typeof s.top !== 'number') {
      for (let i = 0; i + 1 < s.top.length; i++) {
        const [a0, b0] = s.top[i];
        const [a1, b1] = s.top[i + 1];
        // y <= b0 + k (u - a0)  →  -k u + y <= b0 - k a0
        const k = (b1 - b0) / (a1 - a0);
        const before = poly.length;
        const next = clipPoly(poly, -k, 1, b0 - k * a0);
        if (next.length !== before || next.some((p, j) => p[0] !== poly[j]?.[0] || p[1] !== poly[j]?.[1])) clipped = true;
        poly = next;
        if (poly.length < 3) return null;
      }
    }
    const area = poly.reduce((acc, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return acc + p[0] * q[1] - q[0] * p[1];
    }, 0);
    if (Math.abs(area) / 2 < 0.004) return null;
    if (!clipped) {
      return s.axis === 'x' ? f.box(material, u0, y0, s.at, u1 - u0, y1 - y0, s.t, { tint }) : f.box(material, s.at, y0, u0, s.t, y1 - y0, u1 - u0, { tint, tex });
    }
    const pts: V3[] = poly.flatMap(([pu, py]) =>
      s.axis === 'x'
        ? [
            [pu, py, s.at],
            [pu, py, s.at + s.t],
          ]
        : [
            [s.at, py, pu],
            [s.at + s.t, py, pu],
          ],
    ) as V3[];
    return f.hull(material, pts, { tint, tex });
  };

  const courses: Piece[][] = [];
  for (let c = 0; ; c++) {
    const y0 = s.y0 + c * s.course;
    if (y0 >= maxTop - 0.02) break;
    const y1 = Math.min(y0 + s.course, maxTop);
    const row: Piece[] = [];
    // Holes this course runs into
    const holes = (s.holes ?? []).filter((h) => h.y0 < y1 - 0.01 && h.y1 > y0 + 0.01);
    let i = 0;
    for (const [a, b] of bays) {
      // The bay less its holes
      let spans: Array<[number, number]> = [[a, b]];
      for (const h of holes) spans = spans.flatMap(([p, q]) => (h.b <= p || h.a >= q ? [[p, q]] : ([[p, h.a], [h.b, q]] as Array<[number, number]>).filter(([m, n]) => n - m > 0.005)));
      for (const [p, q] of spans) {
        // Joints: a running bond, or even lengths under the longest
        let cuts: number[];
        if (s.stagger) {
          const off = c % 2 ? block / 2 : 0;
          cuts = [p];
          for (let j = Math.ceil((p - s.from - off) / block + 1e-6); s.from + off + j * block < q - 0.12; j++) {
            const x = s.from + off + j * block;
            if (x - cuts[cuts.length - 1] > 0.12) cuts.push(x);
          }
          cuts.push(q);
        } else {
          const n = Math.max(1, Math.ceil((q - p) / block - 1e-6));
          cuts = Array.from({ length: n + 1 }, (_, k) => p + ((q - p) * k) / n);
        }
        for (let k = 0; k + 1 < cuts.length; k++) {
          const tint = typeof s.tint === 'function' ? s.tint(c, i++) : s.tint;
          const piece = place(cuts[k], cuts[k + 1], y0, y1, s.material, tint);
          if (piece) row.push(piece);
        }
      }
    }
    courses.push(row);
  }

  const postPieces: Piece[][] = [];
  for (const p of posts) {
    const a = Math.max(s.from, p - pw / 2);
    const b = Math.min(s.to, p + pw / 2);
    const top = Math.min(lineAt(s.top, a), lineAt(s.top, b));
    const h = top - s.y0;
    if (h < 0.05) continue;
    postPieces.push(s.axis === 'x' ? f.post('timber', a, s.y0, s.at, b - a, h, s.t, 1.8, { tint: s.postTint }) : f.post('timber', s.at, s.y0, a, s.t, h, b - a, 1.8, { tint: s.postTint }));
  }
  return { courses, posts: postPieces };
}

// --- Openings --------------------------------------------------------------------------------

export type OpeningKind = 'window' | 'display' | 'door' | 'batwing' | 'barred' | 'open';

interface OpeningSpec {
  axis: 'x' | 'z';
  /** The wall's inner face coordinate and thickness. */
  at: number;
  t: number;
  hole: Hole;
  kind: OpeningKind;
  trim: THREE.ColorRepresentation;
  door?: THREE.ColorRepresentation;
  /** Which side faces out (-1: toward lower coordinates, the street for a front at z 0). */
  out?: 1 | -1;
}

/**
 * Fill a hole in a frame wall: timber jambs, a head beam carrying the courses above, and what's in
 * it (a sash window, a shop window, a door, batwing doors, a barred cell window). Returns the head.
 */
export function opening(f: Frame, o: OpeningSpec): Piece | null {
  const { a, b, y0, y1 } = o.hole;
  const jw = 0.1;
  const hh = 0.16;
  // A box in the wall's (u, y, depth) coordinates: depth from the inner face
  const put = (material: string, u0: number, v0: number, d0: number, du: number, dv: number, dd: number, tint?: THREE.ColorRepresentation) =>
    o.axis === 'x' ? f.box(material, u0, v0, o.at + d0, du, dv, dd, { tint }) : f.box(material, o.at + d0, v0, u0, dd, dv, du, { tint });
  const timberU = (u0: number, v0: number, d0: number, du: number, dv: number, dd: number, tint?: THREE.ColorRepresentation) =>
    o.axis === 'x' ? f.beam('timber', u0, v0, o.at + d0, du, dv, dd, { tint }) : f.beam('timber', o.at + d0, v0, u0, dd, dv, du, { tint });
  // A point of the wall's (u, v, depth) in the frame
  const wallAt = (u: number, v: number, d: number): V3 => (o.axis === 'x' ? [u, v, o.at + d] : [o.at + d, v, u]);

  const jambs = [put('timber', a, y0, 0, jw, y1 - hh - y0, o.t), put('timber', b - jw, y0, 0, jw, y1 - hh - y0, o.t)];
  const head = timberU(a, y1 - hh, 0, b - a, hh, o.t);
  const [x0, x1] = [a + jw, b - jw];
  const top = y1 - hh;
  const fw = 0.06;
  const fd = 0.08;
  const mid = o.t / 2 - fd / 2;
  const out = o.out ?? -1;
  // Panes 3 cm, in the middle of the frame's depth
  const pane = (u0: number, v0: number, du: number, dv: number) => put('glass', u0, v0, mid + 0.025, du, dv, 0.03);
  switch (o.kind) {
    case 'window':
    case 'display':
    case 'barred': {
      put('paint', x0, y0, mid, fw, top - y0, fd, o.trim);
      put('paint', x1 - fw, y0, mid, fw, top - y0, fd, o.trim);
      put('paint', x0 + fw, y0, mid, x1 - x0 - 2 * fw, fw, fd, o.trim);
      put('paint', x0 + fw, top - fw, mid, x1 - x0 - 2 * fw, fw, fd, o.trim);
      const ym = o.kind === 'display' ? top - (top - y0) * 0.3 : (y0 + top) / 2;
      put('paint', x0 + fw, ym - fw / 2, mid, x1 - x0 - 2 * fw, fw, fd, o.trim);
      const cols = o.kind === 'display' ? 2 : 1;
      const cw = (x1 - x0 - 2 * fw - (cols - 1) * fw) / cols;
      for (let k = 0; k < cols; k++) {
        const u = x0 + fw + k * (cw + fw);
        if (k > 0) {
          put('paint', u - fw, y0 + fw, mid, fw, ym - fw / 2 - y0 - fw, fd, o.trim);
          put('paint', u - fw, ym + fw / 2, mid, fw, top - fw - ym - fw / 2, fd, o.trim);
        }
        pane(u, y0 + fw, cw, ym - fw / 2 - y0 - fw);
        pane(u, ym + fw / 2, cw, top - fw - ym - fw / 2);
      }
      if (o.kind === 'barred') {
        // Iron bars standing on the sill, face-bonded to the head, just outside the frame
        const n = Math.max(3, Math.round((x1 - x0) / 0.14));
        const bs = 0.035;
        const d0 = out < 0 ? mid - bs : mid + fd;
        for (let k = 1; k < n; k++) {
          const u = x0 + ((x1 - x0) * k) / n - bs / 2;
          put('iron', u, y0, d0, bs, (top - y0) / 2, bs);
          put('iron', u, y0 + (top - y0) / 2, d0, bs, (top - y0) / 2, bs);
        }
      }
      break;
    }
    case 'door': {
      // Two leaves, or one in a narrow opening: three upright boards each, and on the outer face
      // two battens and a brace between them (a Z, rising from the hinge side), and a brass knob
      const leaves = x1 - x0 > 1.2 ? 2 : 1;
      const lw = (x1 - x0) / leaves;
      const paint = new THREE.Color(o.door ?? o.trim);
      const d0 = mid + 0.015;
      const dt = 0.05;
      const bt = 0.02;
      // The battens' layer, on the outer face
      const face = out < 0 ? d0 - bt : d0 + dt;
      const bh = 0.14;
      const yb = y0 + 0.22;
      const yt = top - 0.22 - bh;
      for (let k = 0; k < leaves; k++) {
        const u0 = x0 + k * lw;
        for (let j = 0; j < 3; j++) put('timber', u0 + (j * lw) / 3, y0, d0, lw / 3, top - y0, dt, paint.clone().multiplyScalar([1, 0.93, 0.97][j]));
        // Battens and brace a shade lighter, worn at their edges: they read in the porch's shade
        const batten = paint.clone().multiplyScalar(1.3);
        timberU(u0 + 0.04, yb, face, lw - 0.08, bh, bt, batten);
        timberU(u0 + 0.04, yt, face, lw - 0.08, bh, bt, batten);
        // Hinged at the opening's sides: a pair meets in the middle
        const hinge = leaves === 2 && k === 1 ? 1 : -1;
        const [ua, ub] = [u0 + 0.04, u0 + lw - 0.04];
        const bw = 0.15;
        const foot = hinge < 0 ? [ua, ua + bw] : [ub - bw, ub];
        const head = hinge < 0 ? [ub - bw, ub] : [ua, ua + bw];
        const pts: V3[] = [];
        for (const d of [face, face + bt]) pts.push(wallAt(foot[0], yb + bh, d), wallAt(foot[1], yb + bh, d), wallAt(head[0], yt, d), wallAt(head[1], yt, d));
        // Its grain along it: the texture frame's y turned about the wall's normal onto the brace
        const lean = Math.atan2(head[0] - foot[0], yt - yb - bh);
        const grain = o.axis === 'x' ? quatFromAxisAngle([0, 0, 1], -lean) : quatFromAxisAngle([1, 0, 0], lean);
        f.hull('timber', pts, { tint: batten, grain, grainAt: wallAt((ua + ub) / 2, (yb + yt) / 2, face) });
        // The knob on the latch side, clear of the brace
        const ku = hinge < 0 ? ub - 0.1 : ua + 0.06;
        put('iron', ku, y0 + 0.95, out < 0 ? d0 - 0.03 : d0 + dt, 0.04, 0.05, 0.03, 0xb08848);
      }
      break;
    }
    case 'batwing': {
      // Waist-high leaves swinging on hinges at the jambs (2.5 cm off them, so their edges turn
      // clear), a gap between them
      const lw = (x1 - x0 - 0.08) / 2;
      [x0 + 0.025, x1 - 0.025].forEach((u, k) => {
        const leaf = put('paint', k ? u - lw : u, y0 + 0.6, mid + 0.015, lw, 1.1, 0.04, o.door ?? o.trim);
        const jamb = jambs[k];
        if (leaf && jamb) f.d.hinge(leaf, f.at(...wallAt(u, y0 + 1.15, mid + 0.035)), f.dir([0, 1, 0]), { to: jamb });
      });
      break;
    }
    case 'open':
      break;
  }
  return head;
}

// --- Roofs -----------------------------------------------------------------------------------

interface SlopeSpec {
  /** The roof falls along the frame's x or z. */
  axis: 'x' | 'z';
  /** The eave line: where the rafters' underside meets the plate (coordinate on `axis`, and y). */
  eave: number;
  y: number;
  /** Which way it rises along `axis` (+1: toward higher coordinates). */
  dir: 1 | -1;
  pitch: number;
  /** Horizontal run from the eave to its top, and the overhang outward. */
  run: number;
  overhang: number;
  /** Rafter lines (centres along the other axis), and how far the sheets reach along it. */
  lines: number[];
  across: [number, number];
  /** Rafter depth and width; sheet thickness; sheets down the slope at most this long. */
  depth?: number;
  width?: number;
  sheet?: number;
  sheetLength?: number;
  /** Sheets reach this far past the run (to meet the other slope at the ridge). */
  ridge?: boolean;
  /** Cover material ('tin' sheets, or 'timber' boards). */
  cover?: string;
  tint?: () => THREE.ColorRepresentation | undefined;
}

/** One roof slope: rafters on the lines, sheets on the rafters. Returns the lowest and highest rafter of each line. */
export function slope(f: Frame, s: SlopeSpec): { feet: Piece[]; tops: Piece[]; sheets: Piece[] } {
  const hr = s.depth ?? 0.16;
  const wr = s.width ?? 0.08;
  const th = s.sheet ?? 0.03;
  const c = Math.cos(s.pitch);
  const sn = Math.sin(s.pitch);
  // Up the slope (U) and out of it (N), in the frame
  const h: V3 = s.axis === 'x' ? [s.dir, 0, 0] : [0, 0, s.dir];
  const U: V3 = [h[0] * c, sn, h[2] * c];
  const N: V3 = [-h[0] * sn, c, -h[2] * sn];
  const A: V3 = s.axis === 'x' ? [0, 0, 1] : [1, 0, 0];
  const rot = quatFromBasis(N, U, [N[1] * U[2] - N[2] * U[1], N[2] * U[0] - N[0] * U[2], N[0] * U[1] - N[1] * U[0]]);
  const base: V3 = s.axis === 'x' ? [s.eave, s.y, 0] : [0, s.y, s.eave];
  const point = (along: number, off: number, w: number): V3 => [
    base[0] + U[0] * along + N[0] * off + A[0] * w,
    base[1] + U[1] * along + N[1] * off,
    base[2] + U[2] * along + N[2] * off + A[2] * w,
  ];
  const sTop = s.run / c;
  const sLow = -s.overhang / c;
  const n = Math.max(1, Math.ceil((sTop - sLow) / 1.9));
  const feet: Piece[] = [];
  const tops: Piece[] = [];
  for (const w of s.lines) {
    let prev: Piece | null = null;
    for (let i = 0; i < n; i++) {
      const a = sLow + ((sTop - sLow) * i) / n;
      const b = sLow + ((sTop - sLow) * (i + 1)) / n;
      const p = f.tilt('timber', point((a + b) / 2, hr / 2, w), [hr, b - a, wr], rot);
      if (p && i === 0) feet.push(p);
      if (p && i === n - 1) tops.push(p);
      // Lengths along one line share end faces exactly; a guard in case rounding parts them
      if (p && prev) f.bond(p, prev, hr * wr);
      prev = p;
    }
  }
  // Sheets: their joints on rafter centrelines across, in rows down the slope
  const sEnd = s.ridge ? (s.run + hr * sn) / c : sTop;
  const rows = Math.max(1, Math.ceil((sEnd - sLow) / (s.sheetLength ?? 1.9)));
  const lines = [...s.lines].sort((a, b) => a - b);
  const edges = [s.across[0], ...lines.slice(1, -1), s.across[1]];
  const sheets: Piece[] = [];
  for (let j = 0; j + 1 < edges.length; j++) {
    const [w0, w1] = [edges[j], edges[j + 1]];
    for (let i = 0; i < rows; i++) {
      const a = sLow + ((sEnd - sLow) * i) / rows;
      const b = sLow + ((sEnd - sLow) * (i + 1)) / rows;
      const p = f.tilt(s.cover ?? 'tin', point((a + b) / 2, hr + th / 2, (w0 + w1) / 2), [th, b - a, w1 - w0], rot, { tint: s.tint?.() });
      if (p) sheets.push(p);
    }
  }
  return { feet, tops, sheets };
}
