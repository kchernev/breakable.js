// A fracture cell as three-avbd's HullShape, straight from its faces. The solver's convexHull
// rebuilds a hull from bare points (incremental hull, then merging triangles into faces): most of
// the cost of a blast, for cells whose faces, corners and edges are known exactly already. The mass
// properties and principal frame follow three-avbd's src/avbd3d/hull.ts (MIT, © Steven Bobyn), so
// a shape made here is one the solver would have made of the same corners.

import { convexHull, type HullShape } from 'three-avbd';
import { MAX_HULL_VERTICES } from 'three-avbd/advanced';
import type { Convex } from './convex.ts';
import { cross, dot, length, sub, type V3 } from './math.ts';

/** Corners closer than this are one (m). */
const MERGE = 1e-6;

/**
 * The shape of a convex for the solver (null when it spans no volume). Past `maxVertices` corners
 * it's the hull of that many of them, spread out (farthest-point sampling): a little smaller than
 * the piece drawn, and much cheaper to collide. The narrowphase tests a pair in one GPU thread, at
 * a cost of edges × edges, so a step waits on its most complex pair.
 */
export function hullShape(c: Convex, maxVertices = MAX_HULL_VERTICES): HullShape | null {
  // Corners, each once, and each face as indices into them
  const verts: V3[] = [];
  const index = (p: V3): number => {
    for (let i = 0; i < verts.length; i++) {
      const q = verts[i];
      if (Math.abs(q[0] - p[0]) < MERGE && Math.abs(q[1] - p[1]) < MERGE && Math.abs(q[2] - p[2]) < MERGE) return i;
    }
    verts.push(p);
    return verts.length - 1;
  };
  const polys: Array<{ n: V3; verts: number[] }> = [];
  for (const f of c.faces) {
    const ids: number[] = [];
    for (const p of f.pts) {
      const i = index(p);
      if (ids[ids.length - 1] !== i && ids[0] !== i) ids.push(i);
    }
    if (ids.length >= 3) polys.push({ n: f.n, verts: ids });
  }
  // Every edge must have its twin on the face across it; the GPU's narrowphase walks them
  const faceOf = new Map<string, number>();
  polys.forEach((f, k) => f.verts.forEach((v, j) => faceOf.set(`${v},${f.verts[(j + 1) % f.verts.length]}`, k)));
  let closed = true;
  for (const f of polys)
    for (let j = 0; j < f.verts.length && closed; j++) if (!faceOf.has(`${f.verts[(j + 1) % f.verts.length]},${f.verts[j]}`)) closed = false;
  if (verts.length > Math.min(maxVertices, MAX_HULL_VERTICES)) return convexHull(spread(verts, Math.min(maxVertices, MAX_HULL_VERTICES)).flat());
  if (!closed) return convexHull(verts.flat());

  // Volume, centre of mass and covariance, integrated over tetrahedra from a corner near the rest
  // (world coordinates far from the origin lose digits otherwise)
  const o = verts[0];
  const local0 = verts.map((v) => sub(v, o));
  let volume = 0;
  const com: V3 = [0, 0, 0];
  const C = [0, 0, 0, 0, 0, 0]; // xx yy zz xy xz yz
  for (const poly of polys) {
    const a = local0[poly.verts[0]];
    for (let k = 1; k + 1 < poly.verts.length; k++) {
      const b = local0[poly.verts[k]];
      const d = local0[poly.verts[k + 1]];
      const det = dot(a, cross(b, d));
      volume += det / 6;
      for (let j = 0; j < 3; j++) com[j] += (det / 24) * (a[j] + b[j] + d[j]);
      const s = (i: number, j: number) => (det / 120) * (a[i] * a[j] + b[i] * b[j] + d[i] * d[j] + (a[i] + b[i] + d[i]) * (a[j] + b[j] + d[j]));
      C[0] += s(0, 0);
      C[1] += s(1, 1);
      C[2] += s(2, 2);
      C[3] += s(0, 1);
      C[4] += s(0, 2);
      C[5] += s(1, 2);
    }
  }
  if (!(volume > 0)) return null;
  for (let j = 0; j < 3; j++) com[j] /= volume;
  C[0] -= volume * com[0] * com[0];
  C[1] -= volume * com[1] * com[1];
  C[2] -= volume * com[2] * com[2];
  C[3] -= volume * com[0] * com[1];
  C[4] -= volume * com[0] * com[2];
  C[5] -= volume * com[1] * com[2];
  const tr = C[0] + C[1] + C[2];
  const I = [
    [tr - C[0], -C[3], -C[4]],
    [-C[3], tr - C[1], -C[5]],
    [-C[4], -C[5], tr - C[2]],
  ];
  const { values, vectors: R } = eigenSymmetric(I);

  // The principal frame: local = Rᵀ(x - com)
  const toLocal = (d: V3): V3 => [R[0][0] * d[0] + R[1][0] * d[1] + R[2][0] * d[2], R[0][1] * d[0] + R[1][1] * d[1] + R[2][1] * d[2], R[0][2] * d[0] + R[1][2] * d[1] + R[2][2] * d[2]];
  const local = local0.map((v) => toLocal(sub(v, com)));
  const faces = polys.map((poly) => {
    const nl = toLocal(poly.n);
    let d = -Infinity;
    for (const v of poly.verts) d = Math.max(d, dot(nl, local[v]));
    return { normal: nl, d, verts: poly.verts };
  });
  const edges: Array<[number, number, number, number]> = [];
  faces.forEach((f, k) =>
    f.verts.forEach((a, j) => {
      const b = f.verts[(j + 1) % f.verts.length];
      const other = faceOf.get(`${b},${a}`);
      if (a < b && other !== undefined) edges.push([a, b, k, other]);
    }),
  );
  const size: V3 = [0, 0, 0];
  let radius = 0;
  for (const v of local) {
    for (let j = 0; j < 3; j++) size[j] = Math.max(size[j], 2 * Math.abs(v[j]));
    radius = Math.max(radius, length(v));
  }
  const center: V3 = [com[0] + o[0], com[1] + o[1], com[2] + o[2]];
  return { vertices: new Float32Array(local.flat()), faces, edges, volume, moments: [values[0], values[1], values[2]], size, radius, center, rotation: quatFromBasis(R) };
}

/** `count` of the points, spread out: each next the farthest from those taken so far. */
function spread(points: V3[], count: number): V3[] {
  let c: V3 = [0, 0, 0];
  for (const p of points) c = [c[0] + p[0], c[1] + p[1], c[2] + p[2]];
  c = [c[0] / points.length, c[1] / points.length, c[2] / points.length];
  const near = points.map((p) => length(sub(p, c)));
  const taken: V3[] = [];
  // The first: the farthest from the centre; then the farthest from all taken
  near.fill(Infinity);
  let next = 0;
  let far = -1;
  points.forEach((p, i) => {
    const d = length(sub(p, c));
    if (d > far) [far, next] = [d, i];
  });
  while (taken.length < count) {
    const t = points[next];
    taken.push(t);
    let best = -1;
    for (let i = 0; i < points.length; i++) {
      near[i] = Math.min(near[i], length(sub(points[i], t)));
      if (near[i] > best) [best, next] = [near[i], i];
    }
    if (best <= 0) break;
  }
  return taken;
}

/** Eigenvalues and eigenvectors (columns, right-handed) of a symmetric 3×3 matrix, by Jacobi rotations. */
function eigenSymmetric(m: number[][]): { values: V3; vectors: number[][] } {
  const a = m.map((r) => [...r]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
    if (off < 1e-30 * (a[0][0] ** 2 + a[1][1] ** 2 + a[2][2] ** 2 + 1e-300)) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const [akp, akq] = [a[k][p], a[k][q]];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const [apk, aqk] = [a[p][k], a[q][k]];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const [vkp, vkq] = [v[k][p], v[k][q]];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const x: V3 = [v[0][0], v[1][0], v[2][0]];
  const y: V3 = [v[0][1], v[1][1], v[2][1]];
  const z = cross(x, y);
  return {
    values: [a[0][0], a[1][1], a[2][2]],
    vectors: [
      [x[0], y[0], z[0]],
      [x[1], y[1], z[1]],
      [x[2], y[2], z[2]],
    ],
  };
}

/** Quaternion (x, y, z, w) of a rotation matrix given as rows. */
function quatFromBasis(m: number[][]): [number, number, number, number] {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let x: number, y: number, z: number, w: number;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s;
    x = (m[2][1] - m[1][2]) * s;
    y = (m[0][2] - m[2][0]) * s;
    z = (m[1][0] - m[0][1]) * s;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = 2 * Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]);
    w = (m[2][1] - m[1][2]) / s;
    x = 0.25 * s;
    y = (m[0][1] + m[1][0]) / s;
    z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    const s = 2 * Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]);
    w = (m[0][2] - m[2][0]) / s;
    x = (m[0][1] + m[1][0]) / s;
    y = 0.25 * s;
    z = (m[1][2] + m[2][1]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]);
    w = (m[1][0] - m[0][1]) / s;
    x = (m[0][2] + m[2][0]) / s;
    y = (m[1][2] + m[2][1]) / s;
    z = 0.25 * s;
  }
  const l = Math.hypot(x, y, z, w);
  return [x / l, y / l, z / l, w / l];
}
