// Birds shot down. Each world's birds are its own (pigeons, gulls, doves, a hawk, jackdaws), but the
// gun and a blast do the same to any of them: struck, a bird drops out of the air in a puff of its
// feathers, limp and tumbling, onto whatever is under it, and lies there. What's here: whether a
// round passes close enough to a bird to strike it, what that looks and sounds like, and the fall.

import * as THREE from 'three/webgpu';
import type { V3 } from '../lib/index.ts';
import type { Round } from './gun.ts';
import type { WorldRuntime } from './worlds/types.ts';

/** Gravity (m/s²), and how fast the air slows a limp bird (1/s) and its tumble (1/s). */
const G = 9.8;
const DRAG = 0.35;
const SPIN_DRAG = 0.4;
/** How often (s) one lying on something looks whether it's still there. */
const LOOK = 0.5;
/** How far round a blast (times its radius) the birds are blown out of the air. */
const BLAST = 2.5;

const _q = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * How near a round has to pass a bird's middle to strike it (m), by the bird's span: a little more
 * than its body, or one wheeling 30 m up takes a burst's luck to hit.
 */
export const reach = (span: number) => 0.2 + span * 0.45;

/** How far along `round` (m) it passes within `radius` of `at`, before what it struck (null: it misses). */
export function along(round: Round, at: THREE.Vector3, radius: number): number | null {
  const [ox, oy, oz] = round.from;
  const [dx, dy, dz] = round.direction;
  const t = (at.x - ox) * dx + (at.y - oy) * dy + (at.z - oz) * dz;
  if (t < 0 || t > round.reach + radius) return null;
  const x = ox + dx * t - at.x;
  const y = oy + dy * t - at.y;
  const z = oz + dz * t - at.z;
  return x * x + y * y + z * z <= radius * radius ? t : null;
}

/** Which of `birds` (where each is; null: none to strike there) `round` strikes first, within `radius`: its index, or -1. */
export function first(round: Round, birds: Array<THREE.Vector3 | null>, radius: number): number {
  let best = -1;
  let near = Infinity;
  birds.forEach((at, i) => {
    const t = at && along(round, at, radius);
    if (t !== null && t !== undefined && t < near) {
      near = t;
      best = i;
    }
  });
  return best;
}

/** Which of `birds` a blast of `radius` at `at` blows out of the air, and how hard (each: its index and the push, m/s). */
export function blown(at: V3, radius: number, birds: Array<THREE.Vector3 | null>): Array<{ i: number; push: THREE.Vector3 }> {
  const out: Array<{ i: number; push: THREE.Vector3 }> = [];
  const r = radius * BLAST;
  _p.set(...at);
  birds.forEach((b, i) => {
    if (!b) return;
    const d = b.distanceTo(_p);
    if (d < r) out.push({ i, push: b.clone().sub(_p).normalize().multiplyScalar(12 * (1 - d / r) + 2).add(_b.set(0, 3, 0)) });
  });
  return out;
}

/** A bird struck at `at`: a puff of its feathers in `color` (`size`: its span over a pigeon's), the hit, and its cry if it has one. */
export function struck(at: THREE.Vector3, color: THREE.ColorRepresentation, size: number, rt: WorldRuntime, cry?: string): void {
  const p = at.toArray() as V3;
  rt.effects.feathers(p, color, size);
  rt.sound.play('bird.hit', { at: p });
  if (cry) rt.sound.play(cry, { at: p, delay: 0.04 });
}

/**
 * A bird shot or blown out of the air, falling: it keeps some of its speed and takes the push,
 * tumbles, and once it lands lies on its side (rolled `rest` about its length, one way or the
 * other), its length level, turned as its tumble left it. If what it lies on goes, it falls again.
 */
export class Fall {
  readonly at = new THREE.Vector3();
  readonly v = new THREE.Vector3();
  readonly q = new THREE.Quaternion();
  /** Lying where it landed. */
  down = false;
  /** Seconds since it was struck (its wings' last flutter goes by it). */
  t = 0;
  private readonly spin = new THREE.Vector3();
  private readonly forward: THREE.Vector3;
  private readonly rest: number;
  /** How high its origin lies over what it lies on (m). */
  private readonly lift: number;
  private look = 0;

  /**
   * At `at`, flying at `velocity`, turned `q`, pushed by `push` (m/s). Its `forward` is the way its
   * model faces (its own axis), `rest` how far it rolls onto its side lying (radians), `lift` how
   * high its origin lies over the floor then.
   */
  constructor(at: THREE.Vector3, velocity: THREE.Vector3, q: THREE.Quaternion, push: THREE.Vector3, forward: THREE.Vector3, rest = 1.35, lift = 0.05) {
    this.at.copy(at);
    this.v.copy(velocity).multiplyScalar(0.6).add(push);
    this.q.copy(q);
    this.forward = forward.clone();
    this.rest = (Math.random() < 0.5 ? -1 : 1) * rest;
    this.lift = lift;
    this.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 6);
  }

  /** On through the air (or lying there), `floor` saying what's under a point. */
  update(dt: number, floor: (at: V3) => number): void {
    this.t += dt;
    if (this.down) {
      // What it lies on gone from under it: down again
      if ((this.look -= dt) > 0) return;
      this.look = LOOK;
      if (floor([this.at.x, this.at.y + 0.1, this.at.z]) < this.at.y - this.lift - 0.1) this.down = false;
      return;
    }
    // What's under it from where it is, before it moves (from under a roof's edge, the roof)
    const under = floor([this.at.x, this.at.y, this.at.z]);
    this.v.y -= G * dt;
    this.v.multiplyScalar(Math.exp(-DRAG * dt));
    this.at.addScaledVector(this.v, dt);
    const w = this.spin.length();
    if (w > 1e-4) this.q.premultiply(_q.setFromAxisAngle(_a.copy(this.spin).divideScalar(w), w * dt));
    this.spin.multiplyScalar(Math.exp(-SPIN_DRAG * dt));
    // (Not while it's still going up: off a perch, it starts on what it sat on)
    if (this.v.y > 0 || this.at.y > under + this.lift) return;
    // Landed: on its side, its length level and turned as it came down
    this.at.y = under + this.lift;
    this.v.set(0, 0, 0);
    this.down = true;
    this.look = LOOK;
    const head = _a.copy(this.forward).applyQuaternion(this.q).setY(0);
    if (head.lengthSq() < 1e-6) head.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    this.q.setFromUnitVectors(_b.copy(this.forward).setY(0).normalize(), head.normalize()).multiply(_q.setFromAxisAngle(this.forward, this.rest));
  }
}
