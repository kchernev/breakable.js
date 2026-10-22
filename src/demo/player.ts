// First person: mouse look (pointer lock), WASD to walk, Space to jump, Shift to run, F to fly.
// Walking stands on the road, the sidewalks, and whatever of the structures still stands (rubble
// and a breakable ground's slabs included), found with the library's CPU raycast under the foot's
// breadth, and on the scenery's fixed bodies; walls of either stop you the same way, and so do the
// edge of where the world lets you walk and, down in a crater, the edge of its breakable ground.
// Each footfall and landing is reported (onStep, onLand), with what's underfoot, for their sounds.

import type { Body } from 'three-avbd';
import * as THREE from 'three/webgpu';
import { boxConvex, type Convex, type Destruction, hullConvex, type Piece, type Q, raycastConvex, rotate, type V3 } from '../lib/index.ts';

const EYE = 1.65;
const RADIUS = 0.35;
/** The highest step walked up without a jump (m): the lower of the rays that find walls. */
const STEP = 0.5;
/** Where under the feet the ground is looked for: the middle and round it, so a foot on a rim or a chunk of rubble stands on it. */
const FOOT: Array<[number, number]> = [
  [0, 0],
  [0.2, 0],
  [-0.2, 0],
  [0, 0.2],
  [0, -0.2],
];

export interface PlayerOptions {
  /** Where the player may walk (x, z): a step off it stops at the edge. Flying goes anywhere. */
  walkable?: (x: number, z: number) => boolean;
  /** Fixed bodies that aren't pieces (the scenery's walls, steps, rocks): stood on and walked into. */
  solids?: Solids;
}

/** A body's shape and pose, as the world has them (three-avbd's Body); gone once it's not `alive`. */
export type SolidBody = Pick<Body, 'shape' | 'size' | 'hull' | 'position' | 'rotation'> & { alive?: boolean };

/**
 * Fixed bodies as convex shapes on the CPU (their poses never change), for rays against them; one
 * taken out of the world (a dormant tower's stand-in, woken into pieces) is passed through.
 */
export class Solids {
  private readonly shapes: Array<{ convex: Convex; min: V3; max: V3; body?: SolidBody }> = [];

  constructor(bodies: Iterable<SolidBody> = []) {
    for (const b of bodies) {
      const at = b.position as V3;
      const turn = b.rotation as Q;
      let convex: Convex | null;
      if (b.shape === 'hull' && b.hull) {
        const v = b.hull.vertices;
        const points: V3[] = [];
        for (let i = 0; i < v.length; i += 3) {
          const p = rotate(turn, [v[i], v[i + 1], v[i + 2]]);
          points.push([p[0] + at[0], p[1] + at[1], p[2] + at[2]]);
        }
        convex = hullConvex(points);
      } else convex = boxConvex(b.size as V3, at, turn); // a sphere as its box: near enough to walk into
      if (!convex) continue;
      const min: V3 = [Infinity, Infinity, Infinity];
      const max: V3 = [-Infinity, -Infinity, -Infinity];
      for (const f of convex.faces)
        for (const p of f.pts)
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[k]);
            max[k] = Math.max(max[k], p[k]);
          }
      this.shapes.push({ convex, min, max, body: b });
    }
  }

  /**
   * Those that rise above `ground` (the world's groundAt) somewhere. The rest, each corner at most
   * 5 cm over the ground there, are the ground itself or under it, and the ground has them as
   * they're drawn: a quay deck to climb back onto out of the water, terrain hulls that only roughly
   * follow the hills.
   */
  above(ground: (x: number, z: number) => number): Solids {
    const s = new Solids();
    s.shapes.push(...this.shapes.filter((shape) => !underground(shape, ground)));
    return s;
  }

  /** How many shapes. */
  get count(): number {
    return this.shapes.length;
  }

  /** The nearest shape a ray (unit direction) enters within `max`, or null. Shapes it starts inside it passes through. */
  raycast(origin: V3, dir: V3, max: number): { distance: number; point: V3; normal: V3 } | null {
    let best: { t: number; n: V3 } | null = null;
    for (const s of this.shapes) {
      if (s.body?.alive === false) continue;
      // The ray's box against the shape's first: most are far off
      let out = false;
      for (let k = 0; k < 3 && !out; k++) {
        const a = origin[k];
        const b = a + dir[k] * max;
        out = Math.max(a, b) < s.min[k] || Math.min(a, b) > s.max[k];
      }
      if (out) continue;
      // One it starts inside comes back at 0 (no face entered): it mustn't hide what's beyond
      const hit = raycastConvex(s.convex, origin, dir, best ? best.t : max);
      if (hit && hit.t > 0 && (!best || hit.t < best.t)) best = hit;
    }
    if (!best) return null;
    const t = best.t;
    return { distance: t, point: [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t], normal: best.n };
  }
}

/** Whether no corner of a shape is over 5 cm above the ground, read at the corner or just inside it (a corner on a quay's edge is on the quay). */
function underground({ convex, min, max }: { convex: Convex; min: V3; max: V3 }, ground: (x: number, z: number) => number): boolean {
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  // A hull's faces share their corners: each read once
  const seen = new Set<V3>();
  for (const f of convex.faces)
    for (const p of f.pts) {
      if (seen.has(p)) continue;
      seen.add(p);
      const [x, y, z] = p;
      if (y <= ground(x, z) + 0.05) continue;
      const l = Math.hypot(cx - x, cz - z) || 1;
      if (y > ground(x + ((cx - x) / l) * 0.01, z + ((cz - z) / l) * 0.01) + 0.05) return false;
    }
  return true;
}

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  /** Feet. */
  readonly position = new THREE.Vector3(0, 0, 0);
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  fly = false;
  /** Shake: decays each frame. */
  shake = 0;
  /** A foot comes down: on rubble, or on something hard (the street, a floor). */
  onStep: (on: 'hard' | 'rubble', speed: number) => void = () => {};
  /** Landing from a fall or a jump, at `speed` m/s. */
  onLand: (speed: number) => void = () => {};
  private underfoot: Piece | null = null;
  private readonly keys = new Set<string>();
  private readonly destruction: Destruction;
  private readonly ground: (x: number, z: number) => number;
  private readonly walkable: ((x: number, z: number) => boolean) | null;
  private readonly solids: Solids | null;
  private onGround = false;
  private bob = 0;
  /** How far the eye is still to rise after a step up (m): the feet go up at once, the eye eases after them. */
  private stepLag = 0;

  /** `ground`: the ground's height at (x, z), structures aside. */
  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, destruction: Destruction, ground: (x: number, z: number) => number, options: PlayerOptions = {}) {
    this.camera = camera;
    this.destruction = destruction;
    this.ground = ground;
    this.walkable = options.walkable ?? null;
    this.solids = options.solids ?? null;
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.fly = !this.fly;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * 0.0022));
    });
  }

  /** The way the camera looks. */
  get forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  /** Stand at `feet`, looking at `target`. */
  place(feet: THREE.Vector3, target: THREE.Vector3): void {
    this.position.copy(feet);
    const d = target.clone().sub(feet.clone().add(new THREE.Vector3(0, EYE, 0)));
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.velocity.set(0, 0, 0);
    this.stepLag = 0;
  }

  update(dt: number): void {
    const k = this.keys;
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = this.fly ? (run ? 18 : 8) : run ? 7 : 4;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (k.has('KeyW')) wish.add(fwd);
    if (k.has('KeyS')) wish.sub(fwd);
    if (k.has('KeyD')) wish.add(right);
    if (k.has('KeyA')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    if (this.fly) {
      if (k.has('Space') || k.has('KeyE')) wish.y += speed;
      if (k.has('KeyC') || k.has('KeyQ')) wish.y -= speed;
      this.velocity.lerp(wish, Math.min(1, dt * 8));
      this.position.addScaledVector(this.velocity, dt);
    } else {
      // Walk: ground friction toward the wished velocity, gravity, jump
      const blend = Math.min(1, dt * (this.onGround ? 12 : 2));
      this.velocity.x += (wish.x - this.velocity.x) * blend;
      this.velocity.z += (wish.z - this.velocity.z) * blend;
      this.velocity.y -= 22 * dt;
      if (this.onGround && k.has('Space')) this.velocity.y = 7;
      // Walls: stop along a blocked direction
      const step = new THREE.Vector3(this.velocity.x * dt, 0, this.velocity.z * dt);
      if (step.lengthSq() > 0) {
        const dir = step.clone().normalize();
        for (const h of [0.5, 1.2]) {
          const o: V3 = [this.position.x, this.position.y + h, this.position.z];
          const hit = this.wall(o, [dir.x, 0, dir.z], step.length() + RADIUS);
          if (hit) {
            const n = new THREE.Vector3(...hit.normal).setY(0).normalize();
            const into = this.velocity.dot(n);
            if (into < 0) this.velocity.addScaledVector(n, -into);
            step.set(this.velocity.x * dt, 0, this.velocity.z * dt);
          }
        }
      }
      // The world's edge: no step from where it lets you walk to where it doesn't (along the edge
      // is fine; from outside, any way back). Down in a crater, no step out of its breakable ground
      // up onto ground higher than a step (a curb, the road past where it breaks): from inside, that
      // edge is a wall as the crater's own sides are, met by the body's front, not its middle
      const p = this.position;
      const w = this.walkable;
      const pit = this.destruction.grounds.find((g) => g.contains(p.x, p.z) && p.y < g.top - STEP);
      const fromPit = (x: number, z: number) => !pit || pit.contains(x, z) || this.ground(x, z) <= p.y + STEP;
      const may = (x: number, z: number) => {
        if (w && !w(x, z)) return false;
        const l = Math.hypot(x - p.x, z - p.z);
        return fromPit(x, z) && (l < 1e-9 || fromPit(x + ((x - p.x) / l) * RADIUS, z + ((z - p.z) / l) * RADIUS));
      };
      if (may(p.x, p.z)) {
        const x = p.x + this.velocity.x * dt;
        const z = p.z + this.velocity.z * dt;
        if (!may(x, z)) {
          if (may(x, p.z)) this.velocity.z = 0;
          else if (may(p.x, z)) this.velocity.x = 0;
          else this.velocity.x = this.velocity.z = 0;
        }
      }
      const from = this.position.y;
      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y += this.velocity.y * dt;
      const ground = this.groundAt(this.position);
      const wasOnGround = this.onGround;
      const falling = -this.velocity.y;
      if (this.position.y <= ground) {
        // Walking up onto something (a chunk, out of a crater): the eye follows the feet up smoothly
        if (wasOnGround && ground > from) this.stepLag += ground - from;
        this.position.y = ground;
        this.velocity.y = Math.max(0, this.velocity.y);
        this.onGround = true;
      } else this.onGround = this.position.y - ground < 0.05;
      if (this.onGround && !wasOnGround && falling > 3) this.onLand(falling);
      // A footfall each half turn of the bob
      const before = Math.floor((this.bob * 2) / Math.PI);
      const pace = Math.hypot(this.velocity.x, this.velocity.z);
      this.bob += pace * dt * 1.8;
      if (this.onGround && pace > 0.5 && Math.floor((this.bob * 2) / Math.PI) !== before) this.onStep(this.underfoot?.state === 'rubble' ? 'rubble' : 'hard', pace);
    }

    // The camera at the eye, bobbing a little as you walk, easing up after a step, shaken by blasts
    this.shake *= Math.exp(-dt * 5);
    this.stepLag = this.fly ? 0 : this.stepLag * Math.exp(-dt * 15);
    const s = this.shake;
    const bob = this.fly ? 0 : Math.sin(this.bob * 2) * 0.03;
    this.camera.position.set(this.position.x, this.position.y + EYE + bob - this.stepLag, this.position.z);
    this.camera.rotation.set(this.pitch + (Math.random() - 0.5) * s * 0.04, this.yaw + (Math.random() - 0.5) * s * 0.04, (Math.random() - 0.5) * s * 0.02, 'YXZ');
  }

  /** The nearest wall along a ray: a piece, or a fixed body of the scenery. */
  private wall(o: V3, dir: V3, max: number): { normal: V3 } | null {
    const hit = this.destruction.raycast(o, dir, max);
    return this.solids?.raycast(o, dir, hit ? hit.distance : max) ?? hit;
  }

  /**
   * Height of what's underfoot: the ground, a piece (standing, rubble, a prop) or the scenery, the
   * highest under the foot's breadth (at a crater's rim you stand on the rim until you step off it)
   * that's no more than a step up (a curb over a crater isn't stood on until you're up there).
   */
  private groundAt(p: THREE.Vector3): number {
    let top = -Infinity;
    for (const [dx, dz] of FOOT) {
      const [x, z] = [p.x + dx, p.z + dz];
      const base = this.ground(x, z);
      const from: V3 = [x, p.y + 1.0, z];
      const hit = this.destruction.raycast(from, [0, -1, 0], 3);
      const under = this.solids?.raycast(from, [0, -1, 0], 3)?.point[1] ?? -Infinity;
      const y = Math.max(base, under, hit ? hit.point[1] : -Infinity);
      if (y <= top || ((dx || dz) && y > p.y + STEP)) continue;
      top = y;
      this.underfoot = hit && hit.point[1] > Math.max(base, under) ? hit.piece : null;
    }
    return top;
  }
}
