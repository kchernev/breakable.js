// Timber framing: frame walls (sole plate, posts, rails, top plate, braces, lime-plaster panels set
// back from the oak, windows, doors), floor layers of joists and boards that jettied fronts
// cantilever on, and roofs of wall plates, rafters, tile slabs and ridge pieces over gables cut to
// the pitch.

import { add, multiply, type Pose, type Q, rotate, type V3 } from '../../../lib/index.ts';
import { area, clip, type Frame, type Kit, type P, type Pt, rotX, rotY, split, vary } from './kit.ts';

/** Timber depth (outer face at w = 0), plates, rails, and the panels' setback. */
export const T = 0.22;
const PLATE = 0.2;
const RAIL = 0.14;
const SET = 0.03;
const PANEL = 0.14;

type BayKind = 'panel' | 'window' | 'glass' | 'door' | 'brace' | 'open';
export interface Bay {
  kind: BayKind;
  /** A brace's lean (false: rising to the right). */
  flip?: boolean;
  /** Open shutters either side (open windows). */
  shutters?: boolean;
}

interface FrameWallSpec {
  length: number;
  /** Sole plate's bottom to top plate's top. */
  height: number;
  /** Posts: [u0, u1] each. */
  posts: Array<[number, number]>;
  /** What fills each gap between posts (in order). */
  bays: (i: number, width: number) => Bay;
  /** Rails' bottoms (v): sill rail, head rail… */
  rails: number[];
  oak: number;
  plaster: number;
  /** Plates (default both). */
  sole?: boolean;
  top?: boolean;
}


/** Plate cuts: at post centres, no piece over 2 m. */
function plateCuts(length: number, ps: Array<[number, number]>): number[] {
  const centres = ps.map(([a, b]) => (a + b) / 2).filter((c) => c > 0.3 && c < length - 0.3);
  const cuts = [0];
  while (length - cuts[cuts.length - 1] > 2.0) {
    const from = cuts[cuts.length - 1];
    const fit = centres.filter((c) => c > from + 0.3 && c <= from + 2.0);
    cuts.push(fit.length ? fit[fit.length - 1] : from + 2.0);
  }
  cuts.push(length);
  return cuts;
}

/** A timber-framed wall in `f`: outer face at w = 0, T deep. */
export function frameWall(kit: Kit, f: Frame, s: FrameWallSpec): void {
  const H = s.height;
  const oak = () => vary(s.oak, 0.06, kit.rand);
  const plaster = () => vary(s.plaster, 0.03, kit.rand);
  const bottom = s.sole === false ? 0 : PLATE;
  const ceiling = s.top === false ? H : H - PLATE;
  const cuts = plateCuts(s.length, s.posts);
  for (let i = 0; i + 1 < cuts.length; i++) {
    if (s.sole !== false) kit.box(f, 'oak', cuts[i], 0, 0, cuts[i + 1] - cuts[i], PLATE, T, { tint: oak() });
    if (s.top !== false) kit.box(f, 'oak', cuts[i], H - PLATE, 0, cuts[i + 1] - cuts[i], PLATE, T, { tint: oak() });
  }
  // Posts, cut where the rails meet them
  const levels = [bottom, ...s.rails.filter((r) => r > bottom + 0.1 && r < ceiling - 0.1), ceiling];
  for (const [u0, u1] of s.posts) {
    const tint = oak();
    for (let i = 0; i + 1 < levels.length; i++) kit.box(f, 'oak', u0, levels[i], 0, u1 - u0, levels[i + 1] - levels[i], T, { tint });
  }
  // The bays between posts
  const edges: Array<[number, number]> = [];
  let x = 0;
  for (const [u0, u1] of s.posts) {
    if (u0 > x + 1e-3) edges.push([x, u0]);
    x = u1;
  }
  if (s.length > x + 1e-3) edges.push([x, s.length]);
  const panel = (x0: number, x1: number, v0: number, v1: number) => kit.box(f, 'plaster', x0, v0, SET, x1 - x0, v1 - v0, PANEL, { tint: plaster() });
  const rail = (x0: number, x1: number, v: number) => kit.box(f, 'oak', x0, v, 0, x1 - x0, RAIL, T, { tint: oak() });
  edges.forEach(([x0, x1], i) => {
    const bay = s.bays(i, x1 - x0);
    if (bay.kind === 'open') return;
    const rails = s.rails.filter((r) => r > bottom + 0.1 && r < ceiling - 0.1);
    // Which rails this bay keeps: a door or a brace runs through the sill rail
    const kept = bay.kind === 'door' ? rails.slice(-1) : bay.kind === 'brace' && rails.length > 1 ? rails.slice(1) : rails;
    for (const r of kept) rail(x0, x1, r);
    const zones: Array<[number, number]> = [];
    let v = bottom;
    for (const r of kept) {
      zones.push([v, r]);
      v = r + RAIL;
    }
    zones.push([v, ceiling]);
    zones.forEach(([v0, v1], z) => {
      if (v1 - v0 < 0.02) return;
      const main = z === (bay.kind === 'window' || bay.kind === 'glass' ? 1 : 0) && zones.length > 1;
      if (bay.kind === 'door' && z === 0) {
        kit.box(f, 'boards', x0, v0, 0.05, x1 - x0, v1 - v0, 0.08, { tint: vary(0x9a8a78, 0.05, kit.rand) });
      } else if ((bay.kind === 'window' || bay.kind === 'glass') && main) {
        if (bay.kind === 'glass') kit.box(f, 'glass', x0, v0, 0.095, x1 - x0, v1 - v0, 0.03);
        if (bay.shutters) {
          const sw = (x1 - x0) / 2;
          const tint = vary(0x8a9a7a, 0.08, kit.rand);
          kit.box(f, 'boards', x0 - sw, v0 + 0.02, -0.04, sw - 0.02, v1 - v0 - 0.04, 0.04, { tint });
          kit.box(f, 'boards', x1 + 0.02, v0 + 0.02, -0.04, sw - 0.02, v1 - v0 - 0.04, 0.04, { tint });
        }
      } else if (bay.kind === 'brace' && z === 0) brace(kit, f, x0, x1, v0, v1, !!bay.flip, oak(), plaster());
      else panel(x0, x1, v0, v1);
    });
  });
}

/** A brace across a bay, the panels either side cut to it (three prisms sharing the slope). */
function brace(kit: Kit, f: Frame, x0: number, x1: number, v0: number, v1: number, flip: boolean, oak: number, plaster: number): void {
  const b = Math.min(0.2, (x1 - x0) * 0.3);
  const m = (u: number) => (flip ? x0 + x1 - u : u);
  const pts = (ps: Pt[]): Pt[] => ps.map(([u, v]) => [m(u), v]);
  const run: Pt = [m(x1) - m(x0), v1 - v0];
  const grain = Math.atan2(-run[0], run[1]);
  kit.prism(f, 'oak', pts([[x0, v0], [x0 + b, v0], [x1, v1], [x1 - b, v1]]), 0, T, { tint: oak, grain });
  kit.prism(f, 'plaster', pts([[x0 + b, v0], [x1, v0], [x1, v1]]), SET, PANEL, { tint: plaster });
  kit.prism(f, 'plaster', pts([[x0, v0], [x1 - b, v1], [x0, v1]]), SET, PANEL, { tint: plaster });
}

/**
 * A floor between storeys in frame `f` (a house's: u along its front, w inward), at height v, from
 * w0 (the jettied front) to w1: joists along w (one under each side wall), boards between them.
 * Returns its front row (the joists' ends a jetty stands on, and the boards between).
 */
export function floor(kit: Kit, f: Frame, width: number, w0: number, w1: number, v: number, oak: number, spacing = 1.25): P[] {
  const n = Math.max(2, Math.round((width - T) / spacing));
  const joists: Array<[number, number]> = [[0, T]];
  for (let i = 1; i < n; i++) {
    const c = T / 2 + ((width - T) * i) / n;
    joists.push([c - 0.1, c + 0.1]);
  }
  joists.push([width - T, width]);
  const ws = split(w0, w1, 2.0);
  const front: P[] = [];
  for (let j = 0; j + 1 < ws.length; j++) {
    const row: P[] = [];
    for (const [a, b] of joists) row.push(kit.box(f, 'oak', a, v, ws[j], b - a, T, ws[j + 1] - ws[j], { tint: vary(oak, 0.06, kit.rand) }));
    for (let i = 0; i + 1 < joists.length; i++) row.push(kit.box(f, 'boards', joists[i][1], v + T - 0.08, ws[j], joists[i + 1][0] - joists[i][1], 0.08, ws[j + 1] - ws[j], { tint: vary(0xc8b8a0, 0.06, kit.rand) }));
    if (j === 0) front.push(...row);
  }
  return front;
}

interface RoofSpec {
  /** Along the ridge. */
  length: number;
  /** Eaves to eaves (a lean-to: its foot to its head). */
  span: number;
  /** Radians. */
  pitch: number;
  lean?: boolean;
  /** A lean-to's head wall top (v) under its upper wall plate. */
  head?: number;
  /** Gable walls at r = 0 and r = length. */
  gables: [boolean, boolean];
  oak: number;
  plaster: number;
  tile: number;
  /** Detailed gables (more posts and a second rail). */
  rich?: [boolean, boolean];
  /** How far the tiles reach past each end (default 0.25). */
  verge?: [number, number];
  /** How thick what stands at each end is (default: a timber gable's T, or nothing): the plates run between. */
  ends?: [number, number];
}

const H0 = 0.05;
const RAFTER: [number, number] = [0.12, 0.16];
const SLAB = 0.06;
/** Between the bays' plates, slabs and ridge pieces: more than the 2 mm within which faces bond. */
const GAP = 0.005;

/**
 * A roof in frame `f`: r (u) along the ridge from 0 to length, c (w) across from the eaves at 0,
 * v up from the top plates' top. Returns its tile slabs and ridge pieces.
 */
export function roof(kit: Kit, f: Frame, s: RoofSpec): { tiles: P[]; ridge: P[] } {
  const p = s.pitch;
  const [cp, sp, tp] = [Math.cos(p), Math.sin(p), Math.tan(p)];
  const a = s.lean ? s.span : s.span / 2;
  // Where gables stand, rafters stop; the plates run between
  const r0 = s.ends?.[0] ?? (s.gables[0] ? T : 0);
  const r1 = s.length - (s.ends?.[1] ?? (s.gables[1] ? T : 0));
  const tiles: P[] = [];
  const ridge: P[] = [];
  // The roof's underside rises from v = H0 at c = 0
  const pt = (sd: number, n: number): Pt => [sd * cp - n * sp, H0 + sd * sp + n * cp];
  const cTop = s.lean ? a : a - 0.01;
  const sRafter = cTop / cp;
  const sEaves = -0.35 / cp;
  const sTop = s.lean ? (a + 0.12 + (RAFTER[1] + SLAB) * sp) / cp : (cTop + RAFTER[1] * sp) / cp;
  // Courses of slabs 0.65 m up the slope: a break leaves rows to slide, and a slab landing is small enough to shatter
  const rows = split(sEaves, sTop, 0.65);
  // Rafters about 1.3 m apart, the end ones on the gables. Each rafter is a bay of its own: its own
  // length of wall plate, its own column of slabs (to halfway to the next rafter) and its own ridge
  // piece, none bonded to the next bay's. Weight then has one way down, and a bay that loses its
  // foot can't load its neighbours: with shared plates, slabs over two rafters and the rafters
  // pegged at the apex, the weight went round a hole and one rocket brought the nave's roof down.
  const rafterAt = [0.05, ...split(r0, r1, 1.3).slice(1, -1).map((r) => r - RAFTER[0] / 2), s.length - 0.05 - RAFTER[0]];
  const mids = rafterAt.slice(1).map((r, i) => (rafterAt[i] + r + RAFTER[0]) / 2);
  const [v0, v1] = s.verge ?? [0.25, 0.25];
  const tileTint = () => vary(s.tile, 0.04, kit.rand);
  for (const side of s.lean ? [0] : [0, 1]) {
    // Each slope in its own frame: the far one turned about the ridge's middle (its r runs the other way)
    const S = side === 0 ? f : f.sub(s.length, 0, s.span, Math.PI);
    const cols = side === 0 ? [-v0, ...mids, s.length + v1] : [-v1, ...mids, s.length + v0];
    // Wall plate along the eaves, its top the underside: a length under each rafter (the end ones
    // stand on the gables), a gap between
    const P = S.sub(0, 0, 0, -Math.PI / 2);
    const plate = (outline: Pt[], ra: number, rb: number) => kit.prism(P, 'oak', outline, -rb, rb - ra - GAP, { tint: vary(s.oak, 0.05, kit.rand), lay: 'own' });
    for (const [ra, rb] of pairs([r0, ...mids.slice(1, -1), r1])) plate([[0, 0], [T, 0], [T, H0 + T * tp], [0, H0]], ra, rb);
    if (s.lean && s.head !== undefined) {
      // The head wall runs the full length, the gables stopping at it
      const c0 = a - T;
      for (const [ra, rb] of pairs([0, ...mids, s.length])) plate([[c0, s.head], [a, s.head], [a, H0 + a * tp], [c0, H0 + c0 * tp]], ra, rb);
    }
    // Rafters, in lengths up the slope
    const rafterQ = multiply(S.q, rotX(Math.PI / 2 - p));
    for (const r of rafterAt) {
      for (const [sa, sb] of pairs(split(0, sRafter, 2.0))) {
        const [c, v] = pt((sa + sb) / 2, RAFTER[1] / 2);
        const position = S.at(r + RAFTER[0] / 2, v, c);
        kit.d.addBox({ material: 'oak', size: [RAFTER[0], sb - sa, RAFTER[1]], position, rotation: rafterQ, tint: vary(s.oak, 0.06, kit.rand), textureFrame: along(position, rafterQ, kit.rand()) });
      }
    }
    // Tile slabs on them, rows along the ridge, the map's rows across the slope
    const slabQ = multiply(multiply(S.q, rotX(-p)), rotY(Math.PI));
    const frame: Pose = { position: S.at(0, H0, 0), rotation: slabQ };
    // A gap below each slab and to one side keeps it from bonding to its neighbours: it hangs on
    // its rafter alone. The top row meets the ridge exactly.
    for (const [sa, sb] of pairs(rows)) {
      for (const [ra, rb] of pairs(cols)) {
        const [c, v] = pt((sa + GAP + sb) / 2, RAFTER[1] + SLAB / 2);
        tiles.push(kit.d.addBox({ material: 'tile', size: [rb - ra - GAP, SLAB, sb - sa - GAP], position: S.at((ra + GAP + rb) / 2, v, c), rotation: slabQ, tint: tileTint(), textureFrame: frame }));
      }
    }
  }
  if (!s.lean) {
    // Ridge pieces over the top rows, one a bay, sharing the near slope's top slabs' end faces and
    // clear of the far one's: bonded to both, a slope that lost its rafters hung on the other's
    // and brought it down too
    const Rf = f.sub(0, 0, 0, -Math.PI / 2);
    const lb = pt(sTop, RAFTER[1]);
    const lt = pt(sTop, RAFTER[1] + SLAB);
    const far = ([c, v]: Pt): Pt => [s.span - c - GAP * cp, v + GAP * sp];
    const outline: Pt[] = [lb, lt, [a, lt[1] + 0.13], far(lt), far(lb)];
    for (const [ra, rb] of pairs([-v0, ...mids, s.length + v1])) ridge.push(kit.prism(Rf, 'tile', outline, -rb, rb - ra - GAP, { tint: darker(vary(s.tile, 0.03, kit.rand)) }));
  }
  // Gables under the ends
  const under = (flip: boolean): Array<[number, number, number]> => {
    // In the gable's u: u = c (far end) or span - c (near end)
    if (s.lean) return flip ? [[tp, 1, H0 + a * tp]] : [[-tp, 1, H0]];
    return [
      [-tp, 1, H0],
      [tp, 1, H0 + s.span * tp],
    ];
  };
  if (s.gables[0]) gable(kit, f.sub(0, 0, s.span, Math.PI / 2), s, under(true), s.lean ? [T, s.span] : [0, s.span], s.rich?.[0] ?? false);
  if (s.gables[1]) gable(kit, f.sub(s.length, 0, 0, -Math.PI / 2), s, under(false), s.lean ? [0, s.span - T] : [0, s.span], s.rich?.[1] ?? false);
  return { tiles, ridge };
}

const darker = (c: number) => {
  const k = 0.78;
  return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
};

/** A timber's texture frame: its own, slid along its grain. */
function along(position: V3, rotation: Q, t: number): Pose {
  return { position: add(position, rotate(rotation, [0, t, 0])), rotation };
}

function pairs(xs: number[]): Array<[number, number]> {
  return xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);
}

/** A gable in `g` (outer face at w = 0, u across the roof), cut to the roof's underside. */
function gable(kit: Kit, g: Frame, s: RoofSpec, under: Array<[number, number, number]>, [ua, ub]: [number, number], rich: boolean): void {
  const span = s.span;
  const tp = Math.tan(s.pitch);
  const peak = s.lean ? H0 + span * tp : H0 + (span / 2) * tp;
  // Posts: corners, the king post under the apex, and between
  const xs: Array<[number, number]> = [[ua, ua + T]];
  const half = s.lean ? ub - ua : span / 2;
  const spacing = rich ? 0.95 : 1.6;
  const n = Math.max(1, Math.round((half - T) / spacing));
  if (s.lean) {
    for (let i = 1; i < n; i++) {
      const c = ua + T + ((ub - ua - 2 * T) * i) / n;
      xs.push([c - 0.08, c + 0.08]);
    }
  } else {
    for (let i = 1; i < n; i++) {
      const c = T + ((half - T - 0.09) * i) / n;
      xs.push([c - 0.08, c + 0.08]);
    }
    xs.push([half - 0.09, half + 0.09]);
    for (let i = n - 1; i >= 1; i--) {
      const c = span - (T + ((half - T - 0.09) * i) / n);
      xs.push([c - 0.08, c + 0.08]);
    }
  }
  xs.push([ub - T, ub]);
  const rails = rich ? [1.25, 2.6] : [1.6];
  const levels = [0, ...rails.filter((r) => r < peak - 0.4), peak + 1];
  const cut = (x0: number, x1: number, v0: number, v1: number): Pt[] => {
    let poly: Pt[] = [
      [x0, v0],
      [x1, v0],
      [x1, v1],
      [x0, v1],
    ];
    for (const h of under) poly = clip(poly, h);
    return area(poly) > 1e-3 ? poly : [];
  };
  const oak = () => vary(s.oak, 0.06, kit.rand);
  for (const [x0, x1] of xs) {
    const tint = oak();
    for (let i = 0; i + 1 < levels.length; i++) {
      // Long posts in two
      const [v0, v1] = [levels[i], levels[i + 1]];
      for (const [a, b] of pairs(v1 - v0 > 2.2 && i + 2 === levels.length ? [v0, v0 + 1.8, v1] : [v0, v1])) {
        const poly = cut(x0, x1, a, b);
        if (poly.length) kit.prism(g, 'oak', poly, 0, T, { tint, lay: 'grain', grain: 0 });
      }
    }
  }
  for (let j = 0; j + 1 < xs.length; j++) {
    const [x0, x1] = [xs[j][1], xs[j + 1][0]];
    for (let i = 0; i + 1 < levels.length; i++) {
      const v0 = i === 0 ? 0 : levels[i] + RAIL;
      const v1 = levels[i + 1];
      if (i > 0) {
        const r = cut(x0, x1, levels[i], levels[i] + RAIL);
        if (r.length) kit.prism(g, 'oak', r, 0, T, { tint: oak(), lay: 'grain', grain: Math.PI / 2 });
      }
      const poly = cut(x0, x1, v0, v1);
      if (poly.length) kit.prism(g, 'plaster', poly, SET, PANEL, { tint: vary(s.plaster, 0.03, kit.rand) });
    }
  }
}
