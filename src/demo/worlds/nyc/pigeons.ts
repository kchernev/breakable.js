// The street's pigeons: a couple of dozen in small groups on the roofs' copings and the lamp arms.
// The gun or a blast puts them all up, the nearest first, with a clatter of wings from where most of
// them went; they wheel over the street while the noise goes on, and a while after it stops come back
// down by ones and twos to wherever there's still somewhere to sit. A perch knocked out from under
// one sends it up too. One in a round's way, sat or flying, or near a blast, is shot down (../../birds.ts).
// Two instanced meshes (the bodies, and the wings beating), moved on the CPU.

import * as THREE from 'three/webgpu';
import type { Destruction, Piece, V3 } from '../../../lib/index.ts';
import { blown, Fall, first, reach, struck } from '../../birds.ts';
import type { Round } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';
import { STREET } from './city.ts';

const BIRDS = 22;
/** Seconds after the last noise before they start to come back, and over how long they do. */
const AWAY = 18;
const BACK = 24;
/** Flying: their speed and how fast they can change it (m/s, m/s²), the height they wheel at over the street, and its half-length and half-width (m). */
const SPEED = 9.5;
const STEER = 8;
const HIGH = 28;
const WHEEL: [number, number] = [15, 5];
/** Seconds a lap of the wheel takes. */
const LAP = 16;
/** A wingbeat (rad/s: about 6 a second). */
const BEAT = 38;
/** How near a round passes one to strike it (m); the way its model faces. */
const REACH = reach(0.68);
const FORWARD = new THREE.Vector3(0, 0, 1);

interface Perch {
  at: V3;
  /** Which way a bird on it faces (yaw), and which way is out into the open (in plan). */
  facing: number;
  out: [number, number];
  piece: Piece;
  taken: boolean;
}

interface Bird {
  state: 'perched' | 'startled' | 'flying' | 'landing';
  perch: Perch;
  p: THREE.Vector3;
  v: THREE.Vector3;
  yaw: number;
  pitch: number;
  bank: number;
  /** Seconds until it goes (startled), or until it next shifts on its perch. */
  wait: number;
  phase: number;
  /** Where it keeps in the flock, and when it comes back down (rt.time). */
  slot: THREE.Vector3;
  home: number;
  /** Shot down: falling, then lying where it landed. */
  fall: Fall | null;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const _m = new THREE.Matrix4();
const _w = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _t = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

export class Pigeons {
  private readonly birds: Bird[] = [];
  private readonly perches: Perch[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly wings: THREE.InstancedMesh;
  /** Where along the street the flock wheels (x: over the last noise), and how far round it is. */
  private over = 0;
  private lap = Math.random() * Math.PI * 2;
  private time = 0;

  /** The birds on the street `d` has built, sat on its copings and lamp arms. */
  constructor(d: Destruction) {
    for (const piece of d.all()) this.perchesOn(piece);
    const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    this.bodies = new THREE.InstancedMesh(bodyGeometry(), material, BIRDS);
    this.wings = new THREE.InstancedMesh(wingGeometry(), material, BIRDS * 2);
    // Sat in groups of two to five, each group on a perch of its own
    const free = () => this.perches.filter((p) => !p.taken);
    while (this.birds.length < BIRDS && free().length) {
      const start = free()[Math.floor(Math.random() * free().length)];
      const row = this.perches.filter((p) => p.piece === start.piece && !p.taken);
      for (const perch of row.slice(0, Math.min(BIRDS - this.birds.length, 2 + Math.floor(Math.random() * 4)))) {
        perch.taken = true;
        const yaw = perch.facing + rand(-0.6, 0.6);
        this.birds.push({ state: 'perched', perch, p: new THREE.Vector3(...perch.at), v: new THREE.Vector3(), yaw, pitch: 0, bank: 0, wait: rand(1, 6), phase: rand(0, 6), slot: new THREE.Vector3(rand(-4, 4), rand(-1.5, 1.5), rand(-2.5, 2.5)), home: 0, fall: null });
      }
    }
    // Blue-grey mostly, a few darker or brown, now and then a white one
    const colours = [0x737a84, 0x686e78, 0x7e858e, 0x5c6168, 0x8d8780, 0xd6d4cf];
    const c = new THREE.Color();
    for (let i = 0; i < BIRDS; i++) {
      c.setHex(colours[Math.random() < 0.06 ? 5 : Math.floor(Math.random() * 5)]);
      this.bodies.setColorAt(i, c);
      this.wings.setColorAt(2 * i, c);
      this.wings.setColorAt(2 * i + 1, c);
    }
    this.bodies.name = 'nyc:pigeons';
    this.wings.name = 'nyc:pigeon-wings';
    for (const mesh of [this.bodies, this.wings]) {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.count = mesh === this.bodies ? this.birds.length : this.birds.length * 2;
      d.scene!.add(mesh);
    }
    this.draw();
  }

  /**
   * A noise at `from` (a shot, a blast): those sitting go up, the nearest first, and those up stay up
   * a while longer. The clatter of wings comes from where most of them go.
   */
  startle(from: V3, rt: WorldRuntime): void {
    let n = 0;
    let first = Infinity;
    const at = new THREE.Vector3();
    for (const b of this.birds) {
      if (b.fall) continue;
      if (b.state === 'flying' || b.state === 'landing') b.home = rt.time + AWAY + Math.random() * BACK;
      if (b.state === 'landing') {
        b.perch.taken = false;
        this.fly(b, rt);
      }
      if (b.state !== 'perched') continue;
      b.state = 'startled';
      b.wait = 0.05 + b.p.distanceTo(_t.set(...from)) / 45 + Math.random() * 0.4;
      first = Math.min(first, b.wait);
      at.add(b.p);
      n++;
    }
    if (n) this.over = Math.max(-24, Math.min(24, from[0]));
    if (n >= 3) rt.sound.play('pigeons.scatter', { at: at.divideScalar(n).toArray() as V3, delay: first });
  }

  /** A round down the street: the first bird in its way, sat or flying, is shot down. */
  shoot(round: Round, rt: WorldRuntime): void {
    const i = first(round, this.birds.map((b) => (b.fall ? null : middle(b))), REACH);
    if (i >= 0) this.down(i, new THREE.Vector3(...round.direction).multiplyScalar(2.5), rt);
  }

  /** A blast: those near it are blown out of the air (or off their perches). */
  blast(at: V3, radius: number, rt: WorldRuntime): void {
    for (const { i, push } of blown(at, radius, this.birds.map((b) => (b.fall ? null : middle(b))))) this.down(i, push, rt);
  }

  /** Bird i struck, pushed by `push` (m/s): feathers, and down it goes; its perch is free. */
  private down(i: number, push: THREE.Vector3, rt: WorldRuntime): void {
    const b = this.birds[i];
    if (b.state !== 'flying') {
      // Off its perch, out over the street (a round from below would only pin it to the wall)
      b.perch.taken = false;
      if (b.state !== 'landing') push.multiplyScalar(0.2).add(_t.set(b.perch.out[0] * rand(1.5, 2.5), rand(1, 2), b.perch.out[1] * rand(1.5, 2.5)));
    }
    b.fall = new Fall(b.p, b.v, _q.setFromEuler(_e.set(b.pitch, b.yaw, b.bank, 'YXZ')), push, FORWARD, 1.35, 0.05);
    struck(middle(b), this.bodies.getColorAt(i, new THREE.Color()), 1, rt);
  }

  update(dt: number, rt: WorldRuntime): void {
    this.time += dt;
    this.lap += (dt * Math.PI * 2) / LAP;
    // Where the flock is making for: round an ellipse over the street, rising and falling a little
    const centre = new THREE.Vector3(this.over + Math.cos(this.lap) * WHEEL[0], HIGH + Math.sin(this.time * 0.4) * 2, Math.sin(this.lap) * WHEEL[1]);
    for (const b of this.birds) {
      if (b.fall) {
        b.fall.update(dt, rt.floor);
        b.phase += dt * BEAT;
        continue;
      }
      if (b.state === 'perched') {
        // Its perch gone from under it: up it goes. Else now and then it turns a little where it sits
        if (b.perch.piece.state !== 'fixed') {
          b.state = 'startled';
          b.wait = 0;
        } else if ((b.wait -= dt) < 0) {
          b.wait = rand(1.5, 6);
          b.yaw = b.perch.facing + rand(-0.7, 0.7);
        }
        continue;
      }
      if (b.state === 'startled') {
        if ((b.wait -= dt) <= 0) {
          // Off the perch: up and out into the open
          const [ox, oz] = b.perch.out;
          b.v.set(ox * rand(1.5, 3) + rand(-1, 1), rand(3, 4.5), oz * rand(1.5, 3) + rand(-1, 1));
          b.perch.taken = false;
          this.fly(b, rt);
        }
        continue;
      }
      if (b.state === 'flying') {
        this.steer(b, _t.copy(centre).add(b.slot), SPEED, dt);
        if (rt.time > b.home) this.land(b);
      } else {
        // Coming in: to a point out from the perch and over it, then down onto it, slowing
        const perch = b.perch;
        if (perch.piece.state !== 'fixed') {
          this.land(b);
          continue;
        }
        const [ox, oz] = perch.out;
        const at = _t.set(...perch.at);
        const d = b.p.distanceTo(at);
        if (d > 3.6) at.add(_s.set(ox * 3, 1.2, oz * 3));
        this.steer(b, at, Math.min(SPEED, Math.max(1.2, b.p.distanceTo(at) * 1.8)), dt);
        if (d < 0.12) {
          b.state = 'perched';
          b.p.set(...perch.at);
          b.v.set(0, 0, 0);
          b.yaw = perch.facing + rand(-0.6, 0.6);
          b.pitch = b.bank = 0;
          b.wait = rand(1, 5);
        }
      }
      b.p.addScaledVector(b.v, dt);
      // Facing its way, level (its body sits tipped up) but for its climb, banked into its turn
      const yaw = Math.atan2(b.v.x, b.v.z);
      const turn = Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw));
      b.yaw = yaw;
      b.pitch = 0.25 - Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)) * 0.6;
      b.bank += (Math.max(-0.8, Math.min(0.8, (-turn / Math.max(dt, 1e-3)) * 0.25)) - b.bank) * Math.min(1, dt * 6);
      b.phase += dt * BEAT;
    }
    this.draw();
  }

  /** Up and away, to keep with the flock until it's time to come back down. */
  private fly(b: Bird, rt: WorldRuntime): void {
    b.state = 'flying';
    b.home = Math.max(b.home, rt.time + AWAY + Math.random() * BACK);
  }

  /** Back down: to its own perch if it's still there and free, else to a free one somewhere standing. */
  private land(b: Bird): void {
    const free = this.perches.filter((p) => !p.taken && p.piece.state === 'fixed');
    const perch = !b.perch.taken && b.perch.piece.state === 'fixed' ? b.perch : free[Math.floor(Math.random() * free.length)];
    if (!perch) return void (b.state = 'flying');
    perch.taken = true;
    b.perch = perch;
    b.state = 'landing';
  }

  /** Turn its velocity toward `to` at `speed`, by at most STEER m/s². */
  private steer(b: Bird, to: THREE.Vector3, speed: number, dt: number): void {
    const want = _s.copy(to).sub(b.p);
    const d = want.length();
    if (d > 1e-4) want.multiplyScalar(speed / d);
    want.sub(b.v);
    const change = want.length();
    const most = STEER * dt * (b.state === 'landing' ? 1.6 : 1);
    if (change > most) want.multiplyScalar(most / change);
    b.v.add(want);
  }

  /** Each bird's body where it is, and its wings folded, beating, gliding or held up to land. */
  private draw(): void {
    this.birds.forEach((b, i) => {
      const f = b.fall;
      if (f) _m.compose(f.at, f.q, ONE);
      else _m.compose(b.p, _q.setFromEuler(_e.set(b.pitch, b.yaw, b.bank, 'YXZ')), ONE);
      this.bodies.setMatrixAt(i, _m);
      for (const side of [1, -1]) {
        _w.makeTranslation(side * 0.035, 0.1, 0.03);
        if (f && !f.down) {
          // Shot: half spread and limp, a last flutter dying away as it falls
          _w.scale(_s.set(side, 1, 1)).multiply(_r.makeRotationZ(0.35 + 0.7 * Math.sin(b.phase * 0.45) * Math.exp(-f.t * 1.5)));
        } else if (f || b.state === 'perched' || b.state === 'startled') {
          // Folded back along its body, drooping a little
          _w.multiply(_r.makeRotationY((side * Math.PI) / 2 - side * 0.1)).multiply(_r.makeRotationZ(-side * 0.25)).scale(_s.set(side * 0.7, 0.7, 0.7));
        } else {
          // Beating; held up in a V while it glides in a long run, raised high as it comes in to land
          const close = b.state === 'landing' && b.p.distanceToSquared(_t.set(...b.perch.at)) < 4;
          const gliding = b.state === 'flying' && b.v.y < 0.5 && Math.sin(this.time * 0.5 + b.phase * 0.1) > 0.55;
          const angle = close ? 0.9 + 0.3 * Math.sin(b.phase * 1.4) : gliding ? 0.3 : 0.15 + 0.85 * Math.sin(b.phase);
          _w.scale(_s.set(side, 1, 1)).multiply(_r.makeRotationZ(angle));
        }
        this.wings.setMatrixAt(2 * i + (side > 0 ? 0 : 1), _w.premultiply(_m));
      }
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.wings.instanceMatrix.needsUpdate = true;
  }

  /**
   * Places to sit on `piece`, a little apart: along a coping's lip on the street side, or along an
   * iron bar up off the street (a lamp's arm, a fire escape's or a balcony's top rail), across it.
   */
  private perchesOn(piece: Piece): void {
    const { min, max } = piece.bounds;
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const side = Math.sign(min[2] + max[2]);
    const out: [number, number] = [0, -side];
    const spots = (from: number, to: number, at: (s: number) => V3, facing: () => number) => {
      for (let s = from + rand(0.15, 0.3); s < to - 0.15; s += rand(0.24, 0.4)) this.perches.push({ at: at(s), facing: facing(), out, piece, taken: false });
    };
    if (piece.materialName === 'concrete' && Math.abs(size[1] - 0.14) < 0.01 && min[1] > 6 && Math.abs(min[2] + max[2]) / 2 > STREET.front)
      spots(min[0], max[0], (x) => [x, max[1], side * (STREET.front - rand(0.04, 0.08))], () => (side > 0 ? Math.PI : 0));
    if (piece.materialName !== 'metal' || min[1] < 3 || size[1] > 0.15) return;
    const mid: V3 = [(min[0] + max[0]) / 2, max[1], (min[2] + max[2]) / 2];
    if (size[2] > 0.9 && size[0] < 0.15) spots(min[2], max[2], (z) => [mid[0], max[1], z], () => (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2));
    if (size[0] > 0.9 && size[2] < 0.15) spots(min[0], max[0], (x) => [x, max[1], mid[2]], () => (Math.random() < 0.5 ? 0 : Math.PI));
  }
}

/** Where a bird's body is (its middle, over its feet), to be struck. */
function middle(b: Bird): THREE.Vector3 {
  return new THREE.Vector3(0, 0.1, 0).applyEuler(_e.set(b.pitch, b.yaw, b.bank, 'YXZ')).add(b.p);
}

/** A pigeon sat (its feet at the origin, facing +z): a plump body tipped up a little, its head, a fan of a tail; darker at the head and tail. */
function bodyGeometry(): THREE.BufferGeometry {
  const parts: Array<[THREE.BufferGeometry, number]> = [
    [new THREE.SphereGeometry(1, 10, 7).scale(0.06, 0.065, 0.15).rotateX(-0.25).translate(0, 0.095, 0), 1],
    [new THREE.SphereGeometry(1, 8, 6).scale(0.04, 0.042, 0.045).translate(0, 0.17, 0.12), 0.78],
    [new THREE.SphereGeometry(1, 4, 3).scale(0.012, 0.01, 0.025).translate(0, 0.165, 0.17), 0.5],
    [new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.028, 0.085, -0.1, 0.028, 0.085, -0.1, 0.05, 0.06, -0.26, -0.028, 0.085, -0.1, 0.05, 0.06, -0.26, -0.05, 0.06, -0.26], 3)), 0.55],
  ];
  return merged(parts);
}

/** A wing (its root at the origin, spread along +x, leading edge to +z), its flight feathers darker toward the tip. */
function wingGeometry(): THREE.BufferGeometry {
  const rim: Array<[number, number]> = [
    [0, 0.05],
    [0.14, 0.06],
    [0.26, 0.02],
    [0.34, -0.06],
    [0.25, -0.1],
    [0.12, -0.09],
    [0, -0.07],
  ];
  const position: number[] = [];
  const colour: number[] = [];
  const shade = (x: number) => 1 - (x / 0.34) * 0.55;
  for (let i = 0; i < rim.length - 1; i++)
    for (const [x, z] of [[0.06, -0.01], rim[i], rim[i + 1]] as Array<[number, number]>) {
      position.push(x, 0, z);
      colour.push(shade(x), shade(x), shade(x));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  g.computeVertexNormals();
  return g;
}

/** Geometries as one (unindexed: positions and normals, their own or flat), each in a shade of grey as its colour. */
function merged(parts: Array<[THREE.BufferGeometry, number]>): THREE.BufferGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const colour: number[] = [];
  for (const [part, shade] of parts) {
    const g = part.index ? part.toNonIndexed() : part;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const [p, n] = [g.getAttribute('position'), g.getAttribute('normal')];
    for (let i = 0; i < p.count; i++) {
      position.push(p.getX(i), p.getY(i), p.getZ(i));
      normal.push(n.getX(i), n.getY(i), n.getZ(i));
      colour.push(shade, shade, shade);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  return g;
}
