// What flies. A flock of jackdaws bursting off a roof after a blast or a burst of the gun: a score
// of dark birds rising from the ridge, flapping, wheeling out over the sea and gone. A few gulls
// gliding in wide circles off the cliffs all the while. Either, in a round's way or near a blast, is
// shot down (../../birds.ts). And olive leaves shot off a tree, fluttering down. Instanced meshes,
// moved on the CPU.

import { color, frontFacing, select } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { V3 } from '../../../lib/index.ts';
import { blown, Fall, first, reach, struck } from '../../birds.ts';
import type { Round } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';

const COUNT = 22;
const LIFE = 9;
/** The way a bird's model faces. */
const FORWARD = new THREE.Vector3(0, 0, -1);
/** What's under a point (the leaves' floor: through the trees). */
type Floor = (at: V3) => number;

/** A bird seen from afar: two swept wings and a body, flat. */
function birdGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = [0, 0, -0.18, -0.36, 0, 0.06, 0, 0, 0.04, 0, 0, -0.18, 0, 0, 0.04, 0.36, 0, 0.06, 0, 0, -0.2, -0.04, 0, 0.16, 0.04, 0, 0.16];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** How near a round passes a jackdaw (its span 0.86 m) to strike it (m). */
const JACKDAW = reach(0.86);

export class Flock {
  /** One shot down has landed at `at` (on the sea: a splash). */
  onLanded: (at: V3) => void = () => {};
  private readonly mesh: THREE.InstancedMesh;
  /** Each bird; one shot down (`fall`) is out of the flock for good, lying where it landed. */
  private readonly birds = Array.from({ length: COUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), phase: 0, rate: 0, turn: 0, fall: null as Fall | null }));
  private age = Infinity;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicNodeMaterial({ color: 0x1c1c1e, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(birdGeometry(), mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'temple:flock';
    // Drawn from the start, every bird shrunk to nothing: its material is made with the scene's,
    // not in the frame of the first blast that startles them
    this.hide();
    scene.add(this.mesh);
  }

  private hide(): void {
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < COUNT; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Startle them off a ridge at `at`, flying off toward `away` (a direction in plan). */
  start(at: V3, away: [number, number]): void {
    this.age = 0;
    const [ax, az] = away;
    for (const b of this.birds) {
      if (b.fall) continue;
      b.p.set(at[0] + (Math.random() - 0.5) * 8, at[1] + Math.random() * 0.6, at[2] + (Math.random() - 0.5) * 4);
      const spread = (Math.random() - 0.5) * 1.2;
      const c = Math.cos(spread);
      const s = Math.sin(spread);
      b.v.set((ax * c - az * s) * (3 + Math.random() * 3), 4 + Math.random() * 3, (ax * s + az * c) * (3 + Math.random() * 3));
      b.phase = Math.random() * 10;
      b.rate = 11 + Math.random() * 5;
      b.turn = (Math.random() - 0.5) * 0.5;
    }
  }

  /** A round through the flock while it's up: the first bird in its way is shot down. */
  shoot(round: Round, rt: WorldRuntime): void {
    const i = first(round, this.up(), JACKDAW);
    if (i >= 0) this.down(i, new THREE.Vector3(...round.direction).multiplyScalar(2), rt);
  }

  /** A blast: those of the flock near it are blown out of the air. */
  blast(at: V3, radius: number, rt: WorldRuntime): void {
    for (const { i, push } of blown(at, radius, this.up())) this.down(i, push, rt);
  }

  /** Where each bird of the flock is while it's up (null: not up, or shot already). */
  private up(): Array<THREE.Vector3 | null> {
    return this.birds.map((b) => (b.fall || this.age >= LIFE ? null : b.p));
  }

  private down(i: number, push: THREE.Vector3, rt: WorldRuntime): void {
    const b = this.birds[i];
    const q = new THREE.Quaternion().setFromUnitVectors(FORWARD, new THREE.Vector3(b.v.x, b.v.y * 0.3, b.v.z).normalize());
    b.fall = new Fall(b.p, b.v, q, push, FORWARD, 0.25, 0.03);
    struck(b.p, 0x2a2a2c, 1.3, rt);
  }

  update(dt: number, floor: Floor): void {
    const up = this.age < LIFE;
    // Nothing moving: as it was (those shot down lie where they landed)
    if (!up && !this.birds.some((b) => b.fall && !b.fall.down)) return;
    if (up) this.age += dt;
    let i = 0;
    for (const b of this.birds) {
      if (b.fall) {
        // Shot: tumbling down, its wings half closed, then lying spread where it landed
        const was = b.fall.down;
        b.fall.update(dt, floor);
        if (b.fall.down && !was) this.onLanded(b.fall.at.toArray() as V3);
        this.m.compose(b.fall.at, b.fall.q, this.s.set(b.fall.down ? 1.1 : 0.75 + 0.15 * Math.sin(b.fall.t * 17 + b.phase), 1, 1).multiplyScalar(1.2));
        this.mesh.setMatrixAt(i++, this.m);
        continue;
      }
      if (this.age >= LIFE) {
        // Gone out over the sea
        this.mesh.setMatrixAt(i++, this.m.makeScale(0, 0, 0));
        continue;
      }
      // Climbing at first, then levelling off and wheeling as a loose flock
      b.v.y += (this.age < 2 ? 1.5 : -0.8) * dt;
      b.v.y = Math.min(b.v.y, 6);
      const c = Math.cos(b.turn * dt);
      const s = Math.sin(b.turn * dt);
      b.v.set(b.v.x * c - b.v.z * s, b.v.y, b.v.x * s + b.v.z * c);
      const speed = Math.hypot(b.v.x, b.v.z);
      if (speed < 9) b.v.multiplyScalar(1 + dt * 0.3);
      b.p.addScaledVector(b.v, dt);
      // Facing its way; the wings beat (the span shrinks and grows as seen from the ground)
      this.q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(b.v.x, b.v.y * 0.3, b.v.z).normalize());
      const flap = Math.sin(b.phase + this.age * b.rate);
      this.s.set(0.6 + 0.4 * Math.abs(flap), 1, 1).multiplyScalar(1.2);
      this.m.compose(b.p, this.q, this.s);
      this.mesh.setMatrixAt(i++, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** How near a round passes a gull (its span 1.15 m) to strike it (m). */
const GULL = reach(1.15);

/** Gulls riding the wind off the cliffs: slow wide circles, a few wing beats now and then. */
export class Gulls {
  /** One shot down has landed at `at` (on the sea: a splash). */
  onLanded: (at: V3) => void = () => {};
  private readonly mesh: THREE.InstancedMesh;
  /** Each gull: its circle, and where it is and its way (`at`, `v`, `q`) to be shot down; then its `fall`. */
  private readonly birds: Array<{ c: THREE.Vector3; r: number; speed: number; phase: number; rise: number; at: THREE.Vector3; v: THREE.Vector3; q: THREE.Quaternion; fall: Fall | null }>;
  private t = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  constructor(scene: THREE.Scene, centres: Array<[number, number, number]>) {
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0xeceae6, roughness: 0.9, side: THREE.DoubleSide });
    this.birds = centres.map(([x, y, z], i) => ({ c: new THREE.Vector3(x, y, z), r: 14 + ((i * 7) % 5) * 4, speed: (0.13 + (i % 3) * 0.03) * (i % 2 ? 1 : -1), phase: i * 1.7, rise: 1 + (i % 4), at: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), q: new THREE.Quaternion(), fall: null }));
    this.mesh = new THREE.InstancedMesh(birdGeometry(), mat, this.birds.length);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'temple:gulls';
    scene.add(this.mesh);
  }

  /** A round off the cliffs: the first gull in its way is shot down. */
  shoot(round: Round, rt: WorldRuntime): void {
    const i = first(round, this.birds.map((b) => (b.fall ? null : b.at)), GULL);
    if (i >= 0) this.down(i, new THREE.Vector3(...round.direction).multiplyScalar(2), rt);
  }

  /** A blast: gulls near it are blown out of the air. */
  blast(at: V3, radius: number, rt: WorldRuntime): void {
    for (const { i, push } of blown(at, radius, this.birds.map((b) => (b.fall ? null : b.at)))) this.down(i, push, rt);
  }

  private down(i: number, push: THREE.Vector3, rt: WorldRuntime): void {
    const b = this.birds[i];
    b.fall = new Fall(b.at, b.v, b.q, push, FORWARD, 0.3, 0.04);
    struck(b.at, 0xeceae6, 1.7, rt);
  }

  update(dt: number, floor: Floor): void {
    this.t += dt;
    this.birds.forEach((b, i) => {
      if (b.fall) {
        const was = b.fall.down;
        b.fall.update(dt, floor);
        if (b.fall.down && !was) this.onLanded(b.fall.at.toArray() as V3);
        this.m.compose(b.fall.at, b.fall.q, new THREE.Vector3(b.fall.down ? 1.6 : 1.2 + 0.2 * Math.sin(b.fall.t * 15 + b.phase), 1.6, 1.6));
        this.mesh.setMatrixAt(i, this.m);
        return;
      }
      const a = b.phase + this.t * b.speed;
      const p = new THREE.Vector3(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(this.t * 0.2 + b.phase) * b.rise, b.c.z + Math.sin(a) * b.r);
      // Banked into the turn, facing along it; a few beats every so often, else gliding
      const sg = Math.sign(b.speed);
      const heading = Math.atan2(Math.sin(a) * sg, -Math.cos(a) * sg);
      this.e.set(0, heading, Math.sign(b.speed) * 0.35, 'YXZ');
      this.q.setFromEuler(this.e);
      const beating = Math.sin(this.t * 0.7 + b.phase * 3) > 0.6;
      const span = beating ? 0.7 + 0.3 * Math.abs(Math.sin(this.t * 9 + b.phase)) : 1;
      if (dt > 0 && this.t > dt) b.v.copy(p).sub(b.at).divideScalar(dt);
      b.at.copy(p);
      b.q.copy(this.q);
      this.m.compose(p, this.q, new THREE.Vector3(span * 1.6, 1.6, 1.6));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** The leaves there can be at once (a new one takes the oldest's place). */
const LEAVES = 160;
/** The breeze the leaves drift on, toward the sea (as the altar's smoke does: index.ts). */
const BREEZE = new THREE.Vector3(-0.3, 0, -0.1);
/** At most this many leaves come off at once, and so many more a second after (a long burst into a crown isn't a snowstorm). */
const SHED = { most: 40, rate: 20 };

/** An olive leaf, a little large so it reads at a few metres: long and narrow, lying in its xz plane, its tip along -z. */
function leafGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const [l, w] = [0.07, 0.018];
  const v = [0, 0, -l, -w, 0, -l * 0.2, w, 0, -l * 0.2, -w * 0.7, 0, l * 0.5, w * 0.7, 0, l * 0.5, 0, 0, l];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
  g.computeVertexNormals();
  return g;
}

/**
 * Leaves shot off an olive: each tumbles as it falls, slipping from side to side and drifting on the
 * breeze, then lies where it landed a few seconds and shrinks away. Dark grey-green on top, silver
 * underneath, so they flicker as they turn.
 */
export class Leaves {
  private readonly mesh: THREE.InstancedMesh;
  private readonly leaves = Array.from({ length: LEAVES }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Vector3(), side: new THREE.Vector3(), floor: 0, age: Infinity, rest: 0, phase: 0, fall: 1 }));
  private next = 0;
  private live = 0;
  private budget = SHED.most;
  private readonly m = new THREE.Matrix4();
  private readonly s = new THREE.Vector3();
  private readonly dq = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.75, side: THREE.DoubleSide });
    mat.colorNode = select(frontFacing, color(0x4f5c37), color(0xa3ab92));
    this.mesh = new THREE.InstancedMesh(leafGeometry(), mat, LEAVES);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'temple:leaves';
    // Drawn from the start, every leaf shrunk to nothing (as the flock is)
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < LEAVES; i++) this.mesh.setMatrixAt(i, this.m);
    scene.add(this.mesh);
  }

  /**
   * Up to `n` leaves off a crown struck at `at`, on its face turned to `out`, to land on `floor`. They
   * burst out of the face, so they fall outside the crown, not through it.
   */
  shed(at: V3, out: V3, n: number, floor: number): void {
    const count = Math.min(n, Math.floor(this.budget));
    this.budget -= count;
    for (let k = 0; k < count; k++) {
      const f = this.leaves[this.next];
      this.next = (this.next + 1) % LEAVES;
      if (f.age === Infinity) this.live++;
      f.p.set(at[0] + out[0] * 0.1 + (Math.random() - 0.5) * 0.4, at[1] + out[1] * 0.1 + (Math.random() - 0.5) * 0.2, at[2] + out[2] * 0.1 + (Math.random() - 0.5) * 0.4);
      const kick = 0.8 + Math.random() * 1.2;
      f.v.set(out[0] * kick + (Math.random() - 0.5) * 1.2, out[1] * kick + 0.3 + Math.random() * 0.6, out[2] * kick + (Math.random() - 0.5) * 1.2);
      f.q.setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
      f.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(4 + Math.random() * 6);
      const a = Math.random() * Math.PI * 2;
      f.side.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.5 + Math.random() * 0.5);
      f.floor = floor + 0.004;
      f.age = 0;
      f.rest = 0;
      f.phase = Math.random() * 6.3;
      f.fall = 0.6 + Math.random() * 0.5;
    }
  }

  update(dt: number): void {
    this.budget = Math.min(SHED.most, this.budget + dt * SHED.rate);
    if (!this.live) return;
    let i = 0;
    for (const f of this.leaves) {
      const at = i++;
      if (f.age === Infinity) continue;
      f.age += dt;
      if (f.rest) {
        // Lying where it landed, then shrinking away
        const left = f.rest + 6 - f.age;
        if (left <= 0) {
          f.age = Infinity;
          this.live--;
          this.m.makeScale(0, 0, 0);
          this.mesh.setMatrixAt(at, this.m);
          continue;
        }
        this.s.setScalar(Math.min(1, left));
      } else {
        // Falling at its own slow pace, gliding from side to side (slower down while it slips aside),
        // on the breeze; what the bullet gave it dies away
        const swing = Math.sin(f.age * 3.2 + f.phase);
        const ease = 1 - Math.exp(-4 * dt);
        f.v.x += (BREEZE.x + f.side.x * swing * 1.6 - f.v.x) * ease;
        f.v.z += (BREEZE.z + f.side.z * swing * 1.6 - f.v.z) * ease;
        f.v.y += (-f.fall * (0.55 + 0.45 * Math.abs(Math.cos(f.age * 3.2 + f.phase))) - f.v.y) * (1 - Math.exp(-3 * dt));
        f.p.addScaledVector(f.v, dt);
        this.axis.copy(f.spin).normalize();
        f.q.premultiply(this.dq.setFromAxisAngle(this.axis, f.spin.length() * dt));
        if (f.p.y <= f.floor) {
          // Down: flat on the ground, either side up
          f.p.y = f.floor;
          f.rest = f.age;
          f.q.setFromEuler(new THREE.Euler(Math.random() < 0.5 ? 0 : Math.PI, Math.random() * 6.3, 0));
        } else if (f.age > 20) f.rest = f.age;
        this.s.setScalar(1);
      }
      this.m.compose(f.p, f.q, this.s);
      this.mesh.setMatrixAt(at, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
