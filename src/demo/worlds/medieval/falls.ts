// Tall sections fall over. The library turns a section over an edge only once what's left under it
// no longer reaches across its base, so an undermined tower still standing on the rest of its base
// would sink onto its stump and settle upright (a timber storey likewise). Here a tall section is
// tipped toward the side its base was hit on (or the clear way nearest it), a tower's stump
// crumbles on that side, and once past where it would rock back a tower falls on as loose blocks.
//
// Jettied fronts come down. A house's upper front stands on joists that run back to the rear wall,
// and the library's weighing leaves it hanging over the void once its ground floor is blown out
// (its weight never moves far enough off the joists to tip them). When the ground-floor front's
// posts are mostly gone (or a long run of them), what still stands of the walls above is let go as
// one section, its top turning out into the street, and the front row of each jetty's floor as
// another. (Let go together, the wall turned on the joists and jammed in the house; the wall alone,
// it came to rest leaning on the jetty, which stood as a shelf.)

import { cross, type Destruction, type Piece, rotate, scale, sub, type V3 } from '../../../lib/index.ts';
import type { Frame } from './kit.ts';

const pending: Piece[][] = [];
/** Sections being pushed over, until when (a tower's joints are cut then). */
const pushes: Array<{ pieces: Piece[]; until: number; tower: boolean }> = [];

/** How long a section is pushed over (s). */
const PUSH = 0.8;

/** A jettied house: its ground-floor front's columns, its upper front walls and jetties (with the cells of those that broke), and its axes. */
interface Front {
  columns: Array<{ run: [number, number]; pieces: Piece[] }>;
  width: number;
  upper: Piece[];
  jetties: Piece[];
  /** Along the front, and out from it. */
  along: V3;
  out: V3;
}
const fronts: Front[] = [];
/** The list each upper piece is in (its front's walls or jetties). */
const ofFront = new Map<Piece, Piece[]>();
let checkAt = 0;

/** Listen for sections coming loose (call before building: it forgets the fronts it knew). */
export function watchFalls(d: Destruction): void {
  pending.length = 0;
  pushes.length = 0;
  fronts.length = 0;
  ofFront.clear();
  checkAt = 0;
  d.on('collapse', (e) => {
    if (e.pieces.length >= 25) pending.push(e.pieces);
  });
  // A blast that cracks the front over the ground floor leaves its cells standing in it: they go with it
  d.on('fracture', (e) => {
    const list = ofFront.get(e.piece);
    if (!list) return;
    for (const p of e.pieces) {
      list.push(p);
      ofFront.set(p, list);
    }
  });
}

/** Lean the tall sections that came loose since the last call; `hit`: where the last blast was (or the last round that broke something). */
export function leanFalls(d: Destruction, hit: V3 | null, time: number): void {
  for (let i = pushes.length - 1; i >= 0; i--) {
    if (time < pushes[i].until) continue;
    const { pieces, tower } = pushes[i];
    const pushed = new Set(pieces);
    for (const p of pieces) {
      if (p.state === 'gone') continue;
      p.body.clearForces();
      // A tower falls on as loose blocks: pushed over joined, now and then hundreds of them were
      // shot along the ground at the speed limit, out past the town
      if (tower) for (const b of [...p.bonds]) if (pushed.has(b.other(p))) d.unbond(b);
    }
    pushes.splice(i, 1);
  }
  for (const pieces of pending.splice(0)) {
    const live = pieces.filter((p) => p.state === 'loose');
    if (live.length < 25) continue;
    const min: V3 = [Infinity, Infinity, Infinity];
    const max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const p of live)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p.bounds.min[k]);
        max[k] = Math.max(max[k], p.bounds.max[k]);
      }
    const height = max[1] - min[1];
    const extent = Math.max(max[0] - min[0], max[2] - min[2]);
    const masonry = live.filter((p) => p.materialName.startsWith('limestone') || p.materialName.startsWith('rubble')).length / live.length;
    // Masonry: towers only (a length of wall just drops); timber: a storey or more
    const tower = height >= 6 && height >= 0.9 * extent;
    if (masonry > 0.5 ? !tower : height < 4) continue;
    const base: V3 = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
    // Toward the hit (the side whose support went), or any way if it was far off
    let dir: V3 = hit ? [hit[0] - base[0], 0, hit[2] - base[2]] : [0, 0, 0];
    let l = Math.hypot(dir[0], dir[2]);
    if (!hit || l < 0.3 || l > 20) {
      const a = Math.random() * Math.PI * 2;
      dir = [Math.cos(a), 0, Math.sin(a)];
      l = 1;
    }
    dir = [dir[0] / l, 0, dir[2] / l];
    // Not into what still stands beside it (a tower against the town wall would lean on it and
    // stay): the clear way nearest the hit, by rays from its middle across its width (its own
    // pieces are moving now, so the rays pass through them)
    const clear = (v: V3) =>
      [0.25, 0.5].every((f) =>
        [-0.4, 0, 0.4].every((w) => {
          const o: V3 = [base[0] - v[2] * w * extent, base[1] + height * f, base[2] + v[0] * w * extent];
          return !d.raycast(o, v, extent / 2 + height * 0.7);
        }),
      );
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const [c, s] = [Math.cos(turn), Math.sin(turn)];
      const v: V3 = [dir[0] * c - dir[2] * s, 0, dir[0] * s + dir[2] * c];
      if (clear(v)) {
        dir = v;
        break;
      }
    }
    // Turning about a point toward the side it falls to, so its heel lifts off the stump rather
    // than driving into it: its top set going at a few m/s, and pushed on for a moment, past the
    // point where it would rock back onto its stump; then gravity has it
    const toe: V3 = [base[0] + dir[0] * extent * 0.2, base[1], base[2] + dir[2] * extent * 0.2];
    const k = (masonry > 0.5 ? 9 : 3) / Math.max(4, height);
    const w: V3 = [dir[2] * k, 0, -dir[0] * k];
    const a = scale(w, (masonry > 0.5 ? 0.9 : 0.4) / k);
    for (const p of live) {
      const r = sub(p.pose.position, toe);
      p.body.set({ velocity: cross(w, r), angularVelocity: w });
      p.body.applyForce(scale(cross(a, r), p.mass));
    }
    pushes.push({ pieces: live, until: time + PUSH, tower: masonry > 0.5 });
    // What's left of its stump crumbles on the side it falls to
    if (masonry <= 0.5) continue;
    const at: V3 = [base[0] + dir[0] * extent * 0.3, min[1] - 0.3, base[2] + dir[2] * extent * 0.3];
    d.explode({ at, radius: Math.max(1.5, extent * 0.4), speed: 2, spin: 2, budget: 120 });
  }
}

/**
 * A jettied house's front: what carries it on the ground floor (`below`: its posts, or the blocks of
 * a stone front), the upper front walls over it and the front rows of the jetties' floors. `f` is
 * the house's frame (u along the front, 0 to `width`, w inward).
 */
export function watchFront(f: Frame, width: number, below: Piece[], upper: Piece[], jetties: Piece[]): void {
  if (!below.length || !upper.length) return;
  const along = rotate(f.q, [1, 0, 0]);
  // Each carrier's run along the front (from its bounds, the frames being square to x and z)
  const span = (p: Piece): [number, number] => {
    const { min, max } = p.bounds;
    const c = ((min[0] + max[0]) / 2 - f.o[0]) * along[0] + ((min[2] + max[2]) / 2 - f.o[2]) * along[2];
    const h = (Math.abs(along[0]) * (max[0] - min[0]) + Math.abs(along[2]) * (max[2] - min[2])) / 2;
    return [c - h, c + h];
  };
  // Posts are cut at the rails: a post stands only while all its lengths do
  const columns = new Map<number, { run: [number, number]; pieces: Piece[] }>();
  for (const p of below) {
    const run = span(p);
    const key = Math.round(((run[0] + run[1]) / 2) * 20);
    const c = columns.get(key) ?? { run, pieces: [] };
    c.pieces.push(p);
    columns.set(key, c);
  }
  const front = { columns: [...columns.values()], width, upper: [...upper], jetties: [...jetties], along, out: rotate(f.q, [0, 0, -1]) };
  fronts.push(front);
  for (const list of [front.upper, front.jetties]) for (const p of list) ofFront.set(p, list);
}

/** Under this share of the ground floor's carriers standing, or a run this long (m) with none, the front above goes. */
const CARRIED = 0.6;
const GAP = 3;

/** Let go the upper fronts whose ground floor no longer carries them, once the blast before has settled. */
export function releaseFronts(d: Destruction, time: number, quiet: number): void {
  if (time < checkAt || quiet < 1.5) return;
  checkAt = time + 0.5;
  for (let i = fronts.length - 1; i >= 0; i--) {
    const { columns, width, upper, jetties, along, out } = fronts[i];
    const standing = columns.filter((c) => c.pieces.every((p) => p.state === 'fixed')).map((c) => c.run);
    standing.sort((a, b) => a[0] - b[0]);
    let gap = false;
    let x = 0;
    for (const [a, b] of [...standing, [width, width] as [number, number]]) {
      if (a - x >= GAP) gap = true;
      x = Math.max(x, b);
    }
    if (standing.length >= CARRIED * columns.length && !gap) continue;
    fronts.splice(i, 1);
    // What's left of them, however little (a remnant left alone hung there): the walls moving out,
    // their top turning outward, and the jetties dropping
    const still = (pieces: Piece[]) => pieces.filter((p) => p.state === 'fixed');
    d.release(still(upper), scale(out, 1.2), scale(along, -0.8));
    d.release(still(jetties));
  }
}
