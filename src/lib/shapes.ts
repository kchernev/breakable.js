// Points for convex pieces (Destruction.addConvex) beyond boxes: columns, cones, roof gables, the
// wedges of an arch or a dome. Each is given in its own frame (place it with `position` and
// `rotation`); the hull of the points is the piece. Pieces that share a face are bonded like boxes.

import type { V3 } from './math.ts';

/** An upright cylinder of `radius`, `height` tall, its base centred on the origin (`sides` around). */
export function cylinder(radius: number, height: number, sides = 12): V3[] {
  return frustum(radius, radius, height, sides);
}

/** An upright truncated cone: `bottom` radius at y = 0, `top` radius at `height` (top 0: a cone). */
export function frustum(bottom: number, top: number, height: number, sides = 12): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    pts.push([bottom * c, 0, bottom * s]);
    if (top > 0) pts.push([top * c, height, top * s]);
  }
  if (top <= 0) pts.push([0, height, 0]);
  return pts;
}

/**
 * A prism: the convex polygon `outline` (x, y pairs, any order) extruded `depth` along z, centred on
 * z = 0. A roof's gable is prism([[-w, 0], [w, 0], [0, h]], length).
 */
export function prism(outline: Array<[number, number]>, depth: number): V3[] {
  const d = depth / 2;
  return outline.flatMap(([x, y]) => [
    [x, y, -d],
    [x, y, d],
  ]);
}

/**
 * One wedge of a ring in the x–y plane (an arch's voussoir, a round tower's block): between radii
 * `inner` and `outer`, from angle `a0` to `a1` (radians from +x toward +y), `depth` along z (centred
 * on z = 0). Wedges from consecutive angles share a face, so they bond.
 */
export function ringSegment(inner: number, outer: number, a0: number, a1: number, depth: number): V3[] {
  const d = depth / 2;
  const pts: V3[] = [];
  for (const a of [a0, a1]) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    for (const r of [inner, outer]) pts.push([r * c, r * s, -d], [r * c, r * s, d]);
  }
  return pts;
}

/**
 * One block of a round wall (a tower's course) seen from above: between radii `inner` and `outer`,
 * from angle `a0` to `a1` around the y axis, from y = 0 to `height`.
 */
export function arcBlock(inner: number, outer: number, a0: number, a1: number, height: number): V3[] {
  const pts: V3[] = [];
  for (const a of [a0, a1]) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    for (const r of [inner, outer]) pts.push([r * c, 0, r * s], [r * c, height, r * s]);
  }
  return pts;
}

/**
 * One piece of a dome (or a bowl): between radii `inner` and `outer` of a sphere centred on the
 * origin, longitudes `a0`–`a1` (around y), latitudes `b0`–`b1` (up from the equator). Pieces from
 * neighbouring ranges share faces only approximately (a sphere's patches aren't flat), so a dome's
 * pieces are best bonded by hand (Destruction.bond).
 */
export function domePiece(inner: number, outer: number, a0: number, a1: number, b0: number, b1: number): V3[] {
  const pts: V3[] = [];
  for (const a of [a0, a1])
    for (const b of [b0, b1])
      for (const r of [inner, outer]) pts.push([r * Math.cos(b) * Math.cos(a), r * Math.sin(b), r * Math.cos(b) * Math.sin(a)]);
  return pts;
}

/**
 * The voussoirs of a round arch over a span: `count` wedges of a ring (inner radius span / 2,
 * `thickness` deep in the ring, `depth` through the wall), from one springing to the other, each with
 * the angle range it covers. Place them at the arch's centre (the middle of the springing line).
 */
export function arch(span: number, thickness: number, depth: number, count = 9): Array<{ points: V3[]; a0: number; a1: number }> {
  const r = span / 2;
  return Array.from({ length: count }, (_, i) => {
    const a0 = (i / count) * Math.PI;
    const a1 = ((i + 1) / count) * Math.PI;
    return { points: ringSegment(r, r + thickness, a0, a1, depth), a0, a1 };
  });
}

/**
 * The voussoirs of a pointed (two-centred, Gothic) arch over a span: each half is a ring of
 * `radius` (default the span: an equilateral arch; nearer span / 2 it's blunter, over the span a
 * lancet) centred on the springing line at the other half's side, `thickness` deep, `depth` through
 * the wall. `count` wedges in all (made even: the halves meet in a vertical joint at the crown,
 * as a keystone across the point couldn't be convex), from the left springing (-x) to the right.
 * Each comes with the two corners of its outer face (x, y), left to right, to fit the fill over it.
 * Place them at the arch's centre (the middle of the springing line).
 */
export function pointedArch(span: number, thickness: number, depth: number, count = 10, radius = span): Array<{ points: V3[]; outer: [[number, number], [number, number]] }> {
  const half = Math.max(1, Math.round(count / 2));
  const r = Math.max(radius, span / 2);
  // The right half's centre is at x = c (left of the middle); the left half mirrors it
  const c = span / 2 - r;
  const crown = Math.acos(-c / r);
  const d = depth / 2;
  const right: Array<{ points: V3[]; outer: [[number, number], [number, number]] }> = [];
  for (let i = 0; i < half; i++) {
    const a0 = (i / half) * crown;
    const a1 = ((i + 1) / half) * crown;
    const at = (rr: number, a: number): [number, number] => [c + rr * Math.cos(a), rr * Math.sin(a)];
    // The last wedge ends in the vertical joint at the crown, inside and out
    const top = i === half - 1;
    const corners: Array<[number, number]> = [at(r, a0), at(r + thickness, a0), top ? [0, Math.sqrt(r * r - c * c)] : at(r, a1), top ? [0, Math.sqrt((r + thickness) ** 2 - c * c)] : at(r + thickness, a1)];
    right.push({ points: corners.flatMap(([x, y]) => [[x, y, -d] as V3, [x, y, d] as V3]), outer: [corners[3], corners[1]] });
  }
  const mirror = (v: { points: V3[]; outer: [[number, number], [number, number]] }) => ({
    points: v.points.map(([x, y, z]) => [-x, y, z] as V3),
    outer: [[-v.outer[1][0], v.outer[1][1]], [-v.outer[0][0], v.outer[0][1]]] as [[number, number], [number, number]],
  });
  return [...right.map(mirror), ...right.reverse()];
}
