// Small vector and quaternion helpers on plain tuples (quaternions are [x, y, z, w], as in
// three-avbd).

export type V3 = [number, number, number];
export type Q = [number, number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: V3): number => Math.sqrt(dot(a, a));
export const distance = (a: V3, b: V3): number => length(sub(a, b));
export const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function normalize(a: V3): V3 {
  const l = length(a);
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

/** v turned by the unit quaternion q. */
export function rotate(q: Q, v: V3): V3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

export const conjugate = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]];

/** a·b: b's turn, then a's. */
export function multiply(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** The point p of the world in the frame at (position, rotation). */
export const toLocal = (position: V3, rotation: Q, p: V3): V3 => rotate(conjugate(rotation), sub(p, position));
/** The point p of the frame at (position, rotation) in the world. */
export const toWorld = (position: V3, rotation: Q, p: V3): V3 => add(rotate(rotation, p), position);

export function quatFromAxisAngle(axis: V3, angle: number): Q {
  const a = normalize(axis);
  const s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}

/** Two unit vectors square to n and to each other (u × v = n). */
export function basis(n: V3): [V3, V3] {
  const t: V3 = Math.abs(n[0]) < 0.6 ? [1, 0, 0] : Math.abs(n[1]) < 0.6 ? [0, 1, 0] : [0, 0, 1];
  const u = normalize(cross(t, n));
  return [u, cross(n, u)];
}

/** A small seeded random generator (mulberry32): fracture patterns that replay. */
export function random(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An axis-aligned box: min xyz, max xyz. */
export interface Box3 {
  min: V3;
  max: V3;
}

export const boxesOverlap = (a: Box3, b: Box3, margin = 0): boolean =>
  a.min[0] <= b.max[0] + margin && b.min[0] <= a.max[0] + margin && a.min[1] <= b.max[1] + margin && b.min[1] <= a.max[1] + margin && a.min[2] <= b.max[2] + margin && b.min[2] <= a.max[2] + margin;

/** Distance from p to the box (0 inside). */
export function boxDistance(b: Box3, p: V3): number {
  const dx = Math.max(b.min[0] - p[0], 0, p[0] - b.max[0]);
  const dy = Math.max(b.min[1] - p[1], 0, p[1] - b.max[1]);
  const dz = Math.max(b.min[2] - p[2], 0, p[2] - b.max[2]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
