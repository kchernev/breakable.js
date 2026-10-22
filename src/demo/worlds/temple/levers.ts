// Spans that shear at their supports. The library tips a span that has lost a support and lets it
// go with what it carries; but a span let go still resting on what's left at one end (or both, a
// section bridging a lost column) turns down about that edge into its neighbour over the gap, and
// the two jam there in the air. So when a section is let go, each span in it that rests on
// something still standing is cut at that support's far edge, and so is everything in it standing
// on that span: the part over the support stands again, the rest falls straight down. A span that
// has lost what it rested on goes too, though the roof's frame would hold it: one with nothing
// standing under it (a frieze block hung from the cornice on it, a wall plate whose cornice went,
// a small roof's rafter whose foot went), or one with its centre out past what's left under it (a
// plate or a frieze backer on a sheared stub, cut at the stub's edge). And stone that comes to
// rest high up out past what holds it up, over a gap or propped on its neighbour (a section
// bridging a lost column on the columns either side, which sat down onto their cracked feet; a
// block tipped off a column's top), is cut at the edge of what holds it, and the rest falls:
// dry-laid stone doesn't hang. So is stone that only creeps there, on a column still sitting down.
// A column left with nothing standing on past it (sat down, or between two gaps) sheds what's left
// over its abacus, as dry-laid beams out past it would leave it: no stack of stubs cut square.

import * as THREE from 'three/webgpu';
import { type Bond, clip, type Convex, type Destruction, lerp, type Piece, type PieceState, type RayHit, raycastConvex, type TextureFrame, type V3, volumeCentroid } from '../../../lib/index.ts';

/** Spans that shear (and with them what stands on them): the stone ones and the roof timbers on the cornice (plates, tie ends); a tile let go isn't cut where it rests. */
const SHEARS = new Set(['marble', 'ruin', 'triglyph', 'limestone', 'timber']);
/** Dry-laid stone: at rest, it's held only by what's under it. */
const STONE = new Set(['marble', 'ruin', 'triglyph', 'limestone']);
/** A part smaller than this (m³) isn't made: the piece goes whole to the side that has the rest. */
const SLIVER = 0.004;
/** The gap left between the part that stands and the part that falls (m), as the kit leaves between neighbours: one falling doesn't rub on the other. */
const GAP = 0.003;
/** How far under a piece's foot its supports are looked for (m, from 2 cm under it): standing, at rest (it may lie tilted on an edge), and wedged in at rest touching nothing under it. */
const REACH = 0.03;
const RESTS = 0.05;
const WEDGED = 0.3;
/** Stone come to rest higher than this (m) is looked at; with something this near under its centre (m), it rests on that (unless propped on a neighbour). */
const HIGH = 3;
const HOLLOW = 1;
/** How far inside where it's held up a resting piece's centre must be (m). */
const BALANCE = 0.05;
/**
 * Loose stone high up that has moved less than this (m) in this long (s) is looked at as if it had
 * come to rest: the library waits until what it creeps on (a column sitting down) has stopped, 6 s
 * or more. What's moving faster than STIRS (m/s) doesn't hold anything up.
 */
const CREEP = 0.15;
const SLOW = 0.5;
const STIRS = 1;
/** How high over a creeping piece cut there what's on it is cut too (m): the frieze, the cornice and the sima over a beam. */
const ENTABLATURE = 2.5;
/** How hard a part over a column left alone is pushed off (m/s: it slides about half a metre on marble), and tipped (rad/s). */
const SHOVE = 2.5;
const SPIN = 1.5;
/** Where what stands on past a column is looked for: from this far behind where a piece over it is cut (m: an abacus's width and a little), this far on. */
const ABACUS = 1.45;
const BESIDE = 0.6;
/** How near something that goes a perched part is looked at again (m, along each axis). */
const PERCHED = 2.5;
/** Most time a frame spends making again what's cut and letting go of undermined spans, and looking at stone come to rest (ms): the rest wait their turn. */
const BUDGET = 3;
const LOOK = 1;

type Plane = { n: V3; d: number };
type Support = { piece: Piece; at: V3 };
/**
 * A piece to make again as its part over what holds it (standing again, or loose to settle where it
 * is) and its part that falls, cut at `plane`, as it was when cut (in `state`: its section let go,
 * or come to rest).
 */
type Cut = { p: Piece; state: PieceState; held: Convex; free: Convex | null; plane: Plane; stands: boolean; low: number; look: { tint: THREE.Color; textureFrame: TextureFrame } };

export class Levers {
  private readonly d: Destruction;
  /**
   * The pieces that span between supports (beams, lintels, slabs, cornice blocks, plates, tiles) or
   * hang between their neighbours (a small roof's rafters): whether each rested square on what's
   * under it as built, or hangs, and what it abuts.
   */
  private readonly spans = new WeakMap<Piece, { square: boolean; hung: boolean; with: Piece[] }>();
  /** The spans each standing piece bears or abuts, and those to look at again since one of those went or a bond of theirs broke. */
  private readonly bears = new Map<Piece, Piece[]>();
  private readonly changed = new Set<Piece>();
  /** Sections let go since the last update. */
  private readonly let: Piece[][] = [];
  /** Stone come to rest high up (or creeping there), waiting to be looked at. */
  private readonly rested = new Set<Piece>();
  /** Seconds since the start, and where each loose stone high up was when it was last seen moving on (and when). */
  private time = 0;
  private readonly moved = new WeakMap<Piece, { at: V3; t: number }>();
  /** Stone knocked loose once already: one that comes to rest wedged where it was again stays. And parts shoved off once already. */
  private readonly knocked = new WeakSet<Piece>();
  private readonly shoved = new WeakSet<Piece>();
  /** Undermined spans waiting their turn to be let go, and cuts waiting to be made. */
  private readonly due = new Set<Piece>();
  private readonly cuts: Cut[] = [];
  /**
   * Pieces stood again here. One the library lets go again (it finds it hanging, or its column sits
   * down onto a cracked drum) goes as it is.
   */
  private readonly stood = new WeakSet<Piece>();
  /** The parts made here over what held them (stood again or settling), and where they were cut. */
  private readonly parts = new WeakMap<Piece, Plane>();
  /** Parts over a column that sat down or stands alone, kept there by what stands on past it: looked at again when something near goes. */
  private readonly perched = new Set<Piece>();
  /** Whether each standing piece looked at stands on the ground, and what stands under each span (found afresh each time). */
  private readonly down = new Map<Piece, boolean>();
  private readonly under = new Map<Piece, Support[]>();

  constructor(d: Destruction) {
    this.d = d;
    d.on('collapse', (e) => this.let.push(e.pieces));
    // A support goes (let go, broken, cut), or a span's bond to it gives way
    d.on('state', (e) => {
      if (e.from === 'fixed') {
        for (const p of this.bears.get(e.piece) ?? []) this.changed.add(p);
        this.bears.delete(e.piece);
        const [x, y, z] = e.piece.pose.position;
        for (const p of this.perched) {
          const [px, py, pz] = p.pose.position;
          if (Math.abs(px - x) + Math.abs(pz - z) < PERCHED && Math.abs(py - y) < PERCHED) this.rested.add(p);
        }
      }
      if (e.to === 'gone') this.perched.delete(e.piece);
      if (e.to === 'rubble' && STONE.has(e.piece.materialName) && e.piece.bounds.min[1] > HIGH) this.rested.add(e.piece);
    });
    d.on('bondBreak', ({ bond }) => {
      for (const p of [bond.a, bond.b]) if (this.spans.has(p)) this.changed.add(p);
    });
  }

  /** Watch a piece that spans between supports (one resting on nothing as built is hung there by hand: not watched). */
  add(p: Piece | null): void {
    const under = p ? onto(p) : [];
    if (p && under.length) this.watch(p, over(p, under), false);
  }

  addAll(ps: Array<Piece | null>): void {
    for (const p of ps) this.add(p);
  }

  /** Watch a piece hung between its neighbours as built (a small roof's rafter, a tie beam's middle over a room): it goes once one of them has, with nothing under it. Not one resting on something. */
  hang(p: Piece | null): void {
    if (p && !onto(p).length) this.watch(p, false, true);
  }

  private watch(p: Piece, square: boolean, hung: boolean): void {
    // What it abuts as built (its neighbours along a beam, a rafter's segments)
    const side = [...p.bonds].filter((b) => Math.abs(b.normal[1]) < 0.9).map((b) => b.other(p));
    this.spans.set(p, { square, hung, with: side });
    this.lean(p, [...onto(p).map((b) => b.other(p)), ...side]);
  }

  /** Look at a span again when one of these goes. */
  private lean(p: Piece, on: Piece[]): void {
    for (const q of on) {
      const list = this.bears.get(q);
      if (!list) this.bears.set(q, [p]);
      else if (!list.includes(p)) list.push(p);
    }
  }

  /**
   * Each frame, before the sections let go have moved: cut them at what still holds them, lowest
   * first, as many as the frame has time for (in a frame that lets many go, the rest are made
   * again in the next frames where they were, each on what's made again under it); then let go of
   * the spans that have lost what they rested on, each with what stands on it reaching past where
   * it's cut, as the library lets a section go, and cut those too; and look at the stone come to
   * rest high up, a few a frame (what's cut there is made again in the next frames' time).
   */
  update(dt: number): void {
    this.time += dt;
    this.forget();
    for (const section of this.let.splice(0)) this.cut(section, false);
    for (const p of this.changed) if (this.undermined(p)) this.due.add(p);
    this.changed.clear();
    const deadline = performance.now() + BUDGET;
    let made = this.make(deadline, true);
    for (const p of this.due) {
      if (performance.now() > deadline) break;
      this.due.delete(p);
      if (p.state !== 'fixed') continue;
      this.d.release(this.reaching(p));
      this.forget();
      for (const section of this.let.splice(0)) this.cut(section, true);
      made += this.make(deadline, false);
    }
    // What stands again is weighed with the rest
    if (made) this.d.reweigh();
    this.creeping();
    const until = performance.now() + LOOK;
    for (const p of this.rested) {
      if (performance.now() > until) break;
      this.rested.delete(p);
      if (p.state === 'rubble' || p.state === 'loose') this.rest(p);
    }
  }

  /** Loose stone high up that has moved less than CREEP in SLOW seconds is looked at as stone come to rest is (and again each SLOW seconds it goes on so). */
  private creeping(): void {
    for (const p of this.d.loosePieces) {
      const at = p.pose.position;
      if (!STONE.has(p.materialName) || at[1] < HIGH) continue;
      const was = this.moved.get(p);
      if (!was || Math.hypot(at[0] - was.at[0], at[1] - was.at[1], at[2] - was.at[2]) > CREEP) this.moved.set(p, { at, t: this.time });
      else if (this.time - was.t > SLOW) {
        this.moved.set(p, { at, t: this.time });
        if (p.bounds.min[1] > HIGH) this.rested.add(p);
      }
    }
  }

  /** What's known of the standing pieces goes stale once some are let go. */
  private forget(): void {
    this.down.clear();
    this.under.clear();
  }

  /**
   * Whether a standing piece stands on the ground: down through what it rests on to a static piece
   * or the ground. The top of a column blown out at its foot doesn't, though it stands (hung from
   * the beams on it) until the library next weighs it: nothing is cut to rest on it.
   */
  private readonly grounded = (p: Piece): boolean => {
    const known = this.down.get(p);
    if (known !== undefined) return known;
    this.down.set(p, false);
    let down = p.isStatic || p.anchor || p.bounds.min[1] < 0.01;
    for (const b of p.bonds) if (!down && on(b, p) && b.other(p).state === 'fixed') down = this.grounded(b.other(p));
    this.down.set(p, down);
    return down;
  };

  /** What's standing under a span's foot: for one that shears, only what stands on the ground (a tile rests on rafters hung from their feet). */
  private supports(p: Piece): Support[] {
    let out = this.under.get(p);
    if (!out) this.under.set(p, (out = supports(this.d, p, REACH, (q) => q.state === 'fixed' && (!SHEARS.has(p.materialName) || this.grounded(q)))));
    return out;
  }

  /**
   * Stone come to rest high up with its centre out past where what's under it holds it up
   * (standing pieces, and rubble whose centre is lower), propped on a neighbour no lower than itself
   * (the other arm of a V) or over a gap: it's made again as its part over what holds it and the
   * rest, both loose, so the rest falls; or, with nothing past that to cut away or nothing under it
   * at all, it's knocked loose. The library lets a section rest that bridges a lost column on the
   * columns either side, sat down onto their cracked feet (it sags less than it gives way at), a
   * V's arms each over the edge of a stack on those columns, and a block tipped off a column's top
   * lean on its neighbours or wedge against the stub of what stands. Stone still creeping there
   * (loose) is looked at the same way, what's under it loose too, and the loose stone stacked on it
   * is cut with it. A part made here over a column that has since sat down or been left alone
   * between two gaps, with nothing standing on past it, is shoved off instead.
   */
  private rest(p: Piece): void {
    const [x, y, z] = p.pose.position;
    const near = this.near(p);
    // What it touches under its foot; wedged in tilted, what's a little further under it
    let touches = supports(this.d, p, RESTS, () => true, true, near);
    if (!touches.length) touches = supports(this.d, p, WEDGED, () => true, true, near);
    const under = touches.filter((t) => t.piece.state === 'fixed' || t.piece.pose.position[1] < y);
    // A part made here over a column that has sat down (nothing under it stands) or stands alone, with nothing standing on past it
    const cut = this.parts.get(p);
    if (cut && !this.shoved.has(p) && !under.some((u) => u.piece.state === 'fixed' && !this.alone(u.piece))) {
      if (!this.beside(p, cut)) return this.shove(p, cut.n);
      this.perched.add(p);
    }
    if (under.length && centred(p, under)) return;
    // Not propped, with something under its centre besides what it's balanced on the edge of: it rests on that
    const below = under.length === touches.length && ray(this.d, [x, p.bounds.min[1] - 0.01, z], HOLLOW, near);
    if (below && !under.some((u) => u.piece === below.piece)) return;
    const plane = edgeOf(p, under);
    const held = plane && part(p.convex, plane.n, plane.d);
    const free = plane && part(p.convex, [-plane.n[0], 0, -plane.n[2]], -plane.d - GAP);
    if (!plane || !held || !free) return this.knock(p, plane?.n ?? null);
    this.cuts.push({ p, state: p.state, held, free, plane, stands: false, low: p.bounds.min[1], look: look(p) });
    // The loose stone on it across the cut (a frieze, a cornice over a beam creeping on a column) is cut there too
    for (const q of this.stacked(p)) {
      const h = part(q.convex, plane.n, plane.d);
      const f = h && part(q.convex, [-plane.n[0], 0, -plane.n[2]], -plane.d - GAP);
      if (f) this.cuts.push({ p: q, state: 'loose', held: h, free: f, plane, stands: false, low: q.bounds.min[1], look: look(q) });
    }
  }

  /**
   * Whether something stands on past what holds a piece up, the other way from where it's cut (the
   * entablature going on past a column that sat down), at its height: looked for from just past an
   * abacus's width behind the cut.
   */
  private beside(p: Piece, { n, d }: Plane): boolean {
    const [x, y, z] = p.pose.position;
    const back = x * n[0] + z * n[2] - d + ABACUS;
    return this.d.raycast([x - n[0] * back, y, z - n[2] * back], [-n[0], 0, -n[2]], BESIDE)?.piece.state === 'fixed';
  }

  /** The loose pieces that may touch a piece (their bounding spheres within WEDGED of its), but those falling or flung. */
  private near(p: Piece): Piece[] {
    const [x, y, z] = p.pose.position;
    const out: Piece[] = [];
    for (const q of this.d.loosePieces) {
      const [qx, qy, qz] = q.pose.position;
      if (q !== p && Math.hypot(qx - x, qy - y, qz - z) < p.radius + q.radius + WEDGED && Math.hypot(...q.body.velocity) < STIRS) out.push(q);
    }
    return out;
  }

  /** The loose stone over a loose piece, up to the height of an entablature on it (their boxes overlapping in plan). */
  private stacked(p: Piece): Piece[] {
    if (p.state !== 'loose') return [];
    const b = p.bounds;
    const out: Piece[] = [];
    for (const q of this.d.loosePieces) {
      const y = q.pose.position[1];
      if (q === p || !STONE.has(q.materialName) || y < b.max[1] || y > b.max[1] + ENTABLATURE) continue;
      const c = q.bounds;
      if (c.min[0] < b.max[0] && c.max[0] > b.min[0] && c.min[2] < b.max[2] && c.max[2] > b.min[2] && c.min[1] > b.max[1] - 0.1) out.push(q);
    }
    return out;
  }

  /**
   * Knock a piece at rest loose, on out past what it rests on (`out`), or else away from what stands
   * beside it (it's wedged against that): once, and wedged again where it was, it stays. One still
   * creeping there is pushed so.
   */
  private knock(p: Piece, out: V3 | null): void {
    if (this.knocked.has(p)) return;
    this.knocked.add(p);
    const push: V3 = out ? [out[0], -1, out[2]] : [0, -1, 0];
    if (!out) {
      const b = p.bounds;
      const [x, y, z] = p.pose.position;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const from: V3 = [dx ? b[dx > 0 ? 'max' : 'min'][0] + dx * 0.01 : x, y, dz ? b[dz > 0 ? 'max' : 'min'][2] + dz * 0.01 : z];
        if (this.d.raycast(from, [dx, 0, dz], 0.05)?.piece.state === 'fixed') {
          push[0] -= dx;
          push[2] -= dz;
        }
      }
    }
    if (p.state === 'loose') this.d.push(p, push);
    else this.d.loosen(p, push);
  }

  /**
   * Push a part made here over a column that has since sat down onto a cracked drum (or was sitting
   * down) off the way its part that fell went (`out`), tipping it that way: a column left so, with
   * nothing standing on past it, should end at its abacus, as dry-laid beams out past it would
   * leave it, not under a stack of stubs cut square to it. Once. What it's joined to stays.
   */
  private shove(p: Piece, out: V3): void {
    this.shoved.add(p);
    this.perched.delete(p);
    const v: V3 = [out[0] * SHOVE, 0, out[2] * SHOVE];
    if (p.state === 'loose') {
      for (const b of [...p.bonds]) this.d.unbond(b);
      this.d.push(p, v);
    } else this.d.loosen(p, v, [out[2] * SPIN, 0, -out[0] * SPIN]);
  }

  /**
   * Whether a standing span has lost what it rested on: with nothing standing under it (it hangs
   * from what it carries, or from its neighbours; one hung there as built, once one of those has
   * gone), or with its centre out past what's left under it and something there to cut away, at
   * whose edge it'll be cut, having rested square on it as built (a plate or a backer on a sheared
   * stub) or reached out to a neighbour that has gone that way (a tie beam's end whose middle
   * fell). What it rests on now (the cells of a broken support, a stub cut here) is watched from
   * then on.
   */
  private undermined(p: Piece): boolean {
    const span = this.spans.get(p);
    if (p.state !== 'fixed' || !span || (span.hung && span.with.every((q) => q.state === 'fixed'))) return false;
    const under = onto(p);
    this.lean(p, under.map((b) => b.other(p)));
    if (!under.length) {
      const found = this.supports(p);
      this.lean(p, found.map((s) => s.piece));
      return !found.length;
    }
    if (over(p, under)) return false;
    const plane = edgeOf(p, this.supports(p));
    return plane !== null && past(p, plane) && beyond(p.convex, plane) && (span.square || span.with.some((q) => q.state !== 'fixed' && past(q, plane)));
  }

  /** An undermined span and what stands on it (and on that) that will be cut where it is, or falls: what's wholly over its support stands as it is. All of it, when it rests on nothing. */
  private reaching(p: Piece): Piece[] {
    const plane = edgeOf(p, this.supports(p));
    const all = stack(p);
    return plane ? all.filter((q) => q === p || beyond(q.convex, plane)) : all;
  }

  /** Make again what's been cut, lowest first, until the deadline (with `one`, one at least): each still as it was when cut. How many were. */
  private make(deadline: number, one: boolean): number {
    this.cuts.sort((a, b) => a.low - b.low);
    let n = 0;
    while (this.cuts.length && ((one && !n) || performance.now() < deadline)) {
      const c = this.cuts.shift()!;
      if (c.p.state !== c.state) continue;
      this.remake(c);
      n++;
    }
    return n;
  }

  /**
   * Cut a section let go at the supports its spans rest on (made again by make()). What was stood
   * again here goes as it is, if the library let it go (`own`: let go here). A span on a column's
   * top left alone, with nothing else on it but parts stood again here (a column between two gaps),
   * isn't cut: it goes whole, off the column, and those parts are shoved off it.
   */
  private cut(section: Piece[], own: boolean): void {
    const again = (p: Piece) => !own && this.stood.has(p);
    const members = new Set(section);
    const planned = new Map<Piece, Plane>();
    // Each span resting on something standing: the plane at the far edge of what's under it
    for (const p of section) {
      if (p.state !== 'loose' || !this.spans.has(p) || again(p) || !SHEARS.has(p.materialName)) continue;
      const under = this.supports(p);
      const lone = under.filter((u) => this.alone(u.piece));
      for (const u of lone)
        for (const q of this.stubs(u.piece)) {
          const cut = this.parts.get(q);
          if (cut) this.shove(q, cut.n);
          else this.d.loosen(q);
        }
      const plane = lone.length ? null : edgeOf(p, under);
      if (plane) planned.set(p, plane);
    }
    if (!planned.size) return;
    // Then up through what stands on each (in the section), with the same plane
    const seen = new Set<Piece>();
    const climb = (p: Piece, n: V3, d: number) => {
      if (seen.has(p) || p.isStatic) return;
      seen.add(p);
      const held = part(p.convex, n, d);
      if (!held) return;
      const free = part(p.convex, [-n[0], 0, -n[2]], -d - GAP);
      if (free || !again(p)) this.cuts.push({ p, state: 'loose', held, free, plane: { n, d }, stands: true, low: p.bounds.min[1], look: look(p) });
      for (const b of p.bonds) {
        const q = b.other(p);
        if (members.has(q) && on(b, q)) climb(q, n, d);
      }
    };
    for (const [p, { n, d }] of planned) climb(p, n, d);
  }

  /** Whether a standing piece is a column's top (it stands on a drum) with nothing standing on it but parts stood again here. */
  private alone(s: Piece): boolean {
    let column = false;
    for (const b of s.bonds) {
      const q = b.other(s);
      if (q.state !== 'fixed') continue;
      if (on(b, s)) column ||= q.materialName === 'drum';
      else if (on(b, q) && !this.stood.has(q)) return false;
    }
    return column;
  }

  /**
   * What stands on a column's top, and on that, on up: the parts stood again here, and the stone
   * over it (a triglyph over the axis, which nothing cut: left standing, it would pin the parts under
   * it as they're shoved).
   */
  private stubs(s: Piece): Piece[] {
    const { min, max } = s.bounds;
    const over = (q: Piece) => q.pose.position[0] > min[0] && q.pose.position[0] < max[0] && q.pose.position[2] > min[2] && q.pose.position[2] < max[2];
    const out = new Set<Piece>();
    const up = (p: Piece) => {
      for (const b of p.bonds) {
        const q = b.other(p);
        if (q.state === 'fixed' && on(b, q) && !out.has(q) && (this.stood.has(q) || (STONE.has(q.materialName) && over(q)))) {
          out.add(q);
          up(q);
        }
      }
    };
    up(s);
    return [...out];
  }

  /** Make a piece again as its part that stands (a span still, if it was one; or loose, to settle where it is) and its part that falls, if any, with its look. */
  private remake({ p, held, free, plane, stands, look }: Cut): void {
    const options = { material: p.materialName, ...look };
    const span = this.spans.get(p);
    this.spans.delete(p);
    this.d.removePiece(p);
    const kept = this.d.addConvex({ ...options, points: points(held), loose: !stands });
    if (kept) this.parts.set(kept, plane);
    if (kept && stands) {
      this.stood.add(kept);
      if (span?.hung) this.hang(kept);
      else if (span) this.add(kept);
    }
    if (free) this.d.addConvex({ ...options, points: points(free), loose: true });
  }
}

/** A piece's look, for its parts. */
function look(p: Piece): Cut['look'] {
  return { tint: new THREE.Color().fromArray(p.tint), textureFrame: p.textureFrame };
}

/** A piece's foot: the face looking most nearly down (a tile's, a raking cornice block's, a beam come to rest tilted), a few of its corners (a drum's twenty: six) and its middle. */
function footOf(p: Piece): { pts: V3[]; mid: V3 } {
  const face = p.convex.faces.reduce((a, f) => (f.n[1] < a.n[1] ? f : a)).pts;
  const mid = face.reduce((m: V3, q): V3 => [m[0] + q[0] / face.length, m[1] + q[1] / face.length, m[2] + q[2] / face.length], [0, 0, 0]);
  const step = Math.max(1, Math.floor(face.length / 6));
  return { pts: face.filter((_, i) => i % step === 0), mid };
}

/**
 * What's just under a piece's foot (within `reach`, from 2 cm under it) and holds it up, and where
 * it touches: looked for from its foot's corners (a little in from them) and its middle, and with
 * `edges` the middles of its edges too (a piece at rest may lie tilted on an edge), among what
 * stands and the loose pieces `also`. A piece standing or at rest isn't in its own way.
 */
function supports(d: Destruction, p: Piece, reach: number, holds: (q: Piece) => boolean, edges = false, also: Piece[] = []): Support[] {
  const { pts, mid } = footOf(p);
  const from = edges ? [...pts, ...pts.map((q, i): V3 => lerp(q, pts[(i + 1) % pts.length], 0.5)), mid] : [...pts, mid];
  const out: Support[] = [];
  for (const [x, y, z] of from) {
    const hit = ray(d, [x + Math.sign(mid[0] - x) * 0.02, y - 0.02, z + Math.sign(mid[2] - z) * 0.02], reach, also);
    if (hit && hit.piece !== p && holds(hit.piece)) out.push({ piece: hit.piece, at: hit.point });
  }
  return out;
}

/** The first piece straight down from a point, within `reach`: standing (the library's ray), or one of the loose pieces `also`. */
function ray(d: Destruction, from: V3, reach: number, also: Piece[]): RayHit | null {
  const down: V3 = [0, -1, 0];
  let hit = d.raycast(from, down, reach);
  for (const q of also) {
    const h = raycastConvex(q.convex, from, down, reach);
    if (h && (!hit || h.t < hit.distance)) hit = { piece: q, point: [from[0], from[1] - h.t, from[2]], normal: h.n, distance: h.t };
  }
  return hit;
}

/**
 * Where a span shears: square to the way from where it touches its supports to its centre (along
 * x or z when it's nearly so), at the far edge of those supports, in plan. Null when there are
 * none or no telling which way it leans.
 */
function edgeOf(p: Piece, under: Support[]): Plane | null {
  if (!under.length) return null;
  const cx = under.reduce((s, u) => s + u.at[0], 0) / under.length;
  const cz = under.reduce((s, u) => s + u.at[2], 0) / under.length;
  let [dx, dz] = [p.pose.position[0] - cx, p.pose.position[2] - cz];
  const l = Math.hypot(dx, dz);
  if (l < 0.05) return null;
  // Most spans run along x or z: a little off from where it touches, it still goes square across
  if (Math.abs(dx) > 0.95 * l) dz = 0;
  else if (Math.abs(dz) > 0.95 * l) dx = 0;
  const m = Math.hypot(dx, dz);
  const n: V3 = [dx / m, 0, dz / m];
  const pieces = new Set(under.map((u) => u.piece));
  return { n, d: Math.max(...[...pieces].flatMap((q) => q.corners.map((c) => c[0] * n[0] + c[2] * n[2]))) + 0.005 };
}

/** Whether a piece's centre, in plan, is out past a plane. */
function past(p: Piece, plane: Plane): boolean {
  return p.pose.position[0] * plane.n[0] + p.pose.position[2] * plane.n[2] > plane.d;
}

/** Whether a piece's centre, in plan, is among where it's held up (within their extent, by more than BALANCE: one balanced on an edge is held up by what it leans on). */
function centred(p: Piece, under: Support[]): boolean {
  const [x, , z] = p.pose.position;
  const xs = under.map((u) => u.at[0]);
  const zs = under.map((u) => u.at[2]);
  return x > Math.min(...xs) + BALANCE && x < Math.max(...xs) - BALANCE && z > Math.min(...zs) + BALANCE && z < Math.max(...zs) - BALANCE;
}

/** The part of c on the side n·x <= d, or null when there's next to nothing there. */
function part(c: Convex, n: V3, d: number): Convex | null {
  const out = clip(c, n, d);
  return out && volumeCentroid(out).volume > SLIVER ? out : null;
}

/** Whether there's more than a sliver of c past a plane (and the gap left at it). */
function beyond(c: Convex, plane: Plane): boolean {
  return part(c, [-plane.n[0], 0, -plane.n[2]], -plane.d - GAP) !== null;
}

/** A standing piece and what stands on it, and on that, on up (static pieces aside). */
function stack(p: Piece): Piece[] {
  const out = new Set([p]);
  for (const q of out)
    for (const b of q.bonds) {
      const r = b.other(q);
      if (r.state === 'fixed' && !r.isStatic && on(b, r)) out.add(r);
    }
  return [...out];
}

/** The bonds pressing a piece onto standing pieces under it. */
function onto(p: Piece): Bond[] {
  return [...p.bonds].filter((b) => on(b, p) && b.other(p).state === 'fixed');
}

/** Whether a piece's centre, in plan, is over what these bonds press it onto (each face taken as a square of its area). */
function over(p: Piece, under: Bond[]): boolean {
  const [x, , z] = p.pose.position;
  const r = (b: Bond) => Math.sqrt(b.area) / 2;
  const lo = (i: number) => Math.min(...under.map((b) => b.center[i] - r(b)));
  const hi = (i: number) => Math.max(...under.map((b) => b.center[i] + r(b)));
  return x >= lo(0) && x <= hi(0) && z >= lo(2) && z <= hi(2);
}

/** Whether a bond of q presses it onto the other piece (q stands on it). */
function on(b: Bond, q: Piece): boolean {
  return b.a === q ? b.normal[1] < -0.7 : b.normal[1] > 0.7;
}

/** A convex's corners, each once: its faces list each three or four times, and hullConvex is slow to weld them. */
function points(c: Convex): V3[] {
  const out: V3[] = [];
  for (const f of c.faces) for (const q of f.pts) if (!out.some((o) => Math.abs(o[0] - q[0]) + Math.abs(o[1] - q[1]) + Math.abs(o[2] - q[2]) < 1e-6)) out.push(q);
  return out;
}
