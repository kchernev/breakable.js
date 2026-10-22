// The yard's gulls: a few on the bollards, the crane's girders and the stacks' roofs, three always
// wheeling over the water. A blast or the gun puts the perched ones up: they jump off away from it,
// beat up to circle high over the harbour, and come back to their perches once it's been quiet a
// while. One in a round's way or near a blast is shot down (../../birds.ts). Two instanced meshes
// (bodies, wings), made with the scenery and drawn from the start.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { V3 } from '../../../lib/index.ts';
import { blown, Fall, first, reach, struck } from '../../birds.ts';
import type { Round } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';

const WHITE = 0xe8eaea;
const GREY = 0x8e979c;
const BLACK = 0x26282a;
/** How long they keep away after the last noise before heading back (s, and up to as much again at random). */
const AWAY = 25;
const HIDDEN = -200;
/** How near a round passes one to strike it (m); its body's middle over `at`; the way its model faces. */
const REACH = reach(1.4);
const MIDDLE = 0.07;
const FORWARD = new THREE.Vector3(1, 0, 0);

interface Gull {
  at: V3;
  v: V3;
  yaw: number;
  roll: number;
  /** 'perched' on its perch, 'flying' (wheeling round `circle`), 'landing' on its perch. */
  mode: 'perched' | 'flying' | 'landing';
  perch: V3 | null;
  /** Its wing beat: phase, how hard (0 gliding, 1 beating), how folded (1: perched). */
  phase: number;
  beat: number;
  fold: number;
  /** Where it wheels: a centre, radius, turn rate (rad/s, signed), angle. */
  circle: { c: V3; r: number; w: number; a: number };
  /** When it heads back to its perch (Infinity: it never perches), and when it may take off. */
  home: number;
  goAt: number;
  /** When it next turns its head on its perch. */
  lookAt: number;
  /** Shot down: falling, then lying (or floating) where it landed. */
  fall: Fall | null;
}

/** A gull's body (0.5 m, nose along +x), white with a grey back, and a yellow bill. */
function bodyGeometry(): THREE.BufferGeometry {
  const paint = (g: THREE.BufferGeometry, top: number, under = top) => {
    const c = new THREE.Color();
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) c.set(pos.getY(i) > 0.02 ? top : under).toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const body = paint(new THREE.SphereGeometry(1, 10, 6).scale(0.25, 0.075, 0.072), GREY, WHITE);
  const head = paint(new THREE.SphereGeometry(1, 8, 5).scale(0.055, 0.045, 0.042).translate(0.23, 0.065, 0), WHITE);
  const bill = paint(new THREE.ConeGeometry(0.012, 0.07, 5).rotateZ(-Math.PI / 2).translate(0.31, 0.06, 0), 0xd8b040);
  const tail = paint(new THREE.ConeGeometry(0.05, 0.14, 4).rotateZ(Math.PI / 2).scale(1, 0.35, 1).translate(-0.27, 0.01, 0), WHITE);
  for (const g of [body, head, bill, tail]) g.deleteAttribute('uv');
  return mergeGeometries([body, head, bill, tail])!;
}

/** A right wing (along +z from the shoulder, 0.7 m), grey above with a black tip. */
function wingGeometry(): THREE.BufferGeometry {
  // The arm, then the hand swept back to the tip
  const p: V3[] = [
    [0.09, 0, 0],
    [-0.09, 0, 0],
    [0.05, 0, 0.36],
    [-0.11, 0, 0.34],
    [-0.13, 0, 0.7],
  ];
  const tris = [
    [0, 1, 2],
    [1, 3, 2],
    [2, 3, 4],
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const t of tris)
    for (const i of t) {
      pos.push(...p[i]);
      c.set(i === 4 ? BLACK : i >= 2 ? 0x7e878c : GREY).toArray(col, col.length);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export class Gulls {
  /** One shot down has landed at `at` (on the quay, or on the water: a splash). */
  onLanded: (at: V3) => void = () => {};
  private readonly gulls: Gull[] = [];
  private readonly bodies: THREE.InstancedMesh;
  private readonly wings: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, count: number, wheeling: number, rand: () => number) {
    const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    this.bodies = new THREE.InstancedMesh(bodyGeometry(), m, count);
    this.wings = new THREE.InstancedMesh(wingGeometry(), m, count * 2);
    this.bodies.name = 'harbor:gulls';
    this.wings.name = 'harbor:gull-wings';
    for (const o of [this.bodies, this.wings]) {
      o.frustumCulled = false;
      o.castShadow = true;
      scene.add(o);
    }
    for (let i = 0; i < count; i++) {
      const always = i < wheeling;
      this.gulls.push({
        at: [0, HIDDEN, 0],
        v: [0, 0, 0],
        yaw: 0,
        roll: 0,
        mode: always ? 'flying' : 'perched',
        perch: null,
        phase: rand() * 6,
        beat: 0,
        fold: always ? 0 : 1,
        circle: { c: [-10 + rand() * 40, 24 + rand() * 14, -70 - rand() * 50], r: 18 + rand() * 20, w: (rand() < 0.5 ? -1 : 1) * (0.12 + rand() * 0.1), a: rand() * 6.3 },
        home: always ? Infinity : 0,
        goAt: 0,
        lookAt: 0,
        fall: null,
      });
    }
    this.draw();
  }

  /** Each perched gull on a perch (the tops of what stands, found once the yard is built), the wheeling ones up over the water. */
  settle(perches: V3[]): void {
    let k = 0;
    for (const g of this.gulls) {
      if (g.home === Infinity) {
        const { c, r, a } = g.circle;
        g.at = [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r];
        continue;
      }
      g.perch = perches[k++ % perches.length] ?? null;
      if (g.perch) g.at = [...g.perch];
      g.yaw = Math.random() * Math.PI * 2;
    }
  }

  /** A loud noise at `from`: those perched or coming in take off away from it, and all keep away a while. */
  scatter(from: V3, time: number, rand: () => number): void {
    for (const g of this.gulls) {
      if (g.home === Infinity || g.fall) continue;
      g.home = Math.max(g.home, time + AWAY * (1 + rand()));
      if (g.mode === 'flying') continue;
      const dx = g.at[0] - from[0];
      const dz = g.at[2] - from[2];
      const d = Math.hypot(dx, dz) || 1;
      // Away from it, the first up at once and the rest a moment after; then round over the harbour
      g.goAt = time + (g.mode === 'landing' ? 0 : rand() * 0.6);
      g.mode = 'flying';
      g.v = [(dx / d) * 4 + (rand() - 0.5) * 2, 3.5 + rand() * 1.5, (dz / d) * 4 + (rand() - 0.5) * 2];
      g.circle = { c: [g.at[0] + (dx / d) * 30 + (rand() - 0.5) * 30, 22 + rand() * 14, Math.min(g.at[2] - 40, -60) - rand() * 40], r: 15 + rand() * 20, w: (rand() < 0.5 ? -1 : 1) * (0.14 + rand() * 0.1), a: Math.atan2(dz, dx) };
    }
  }

  /** Where one of the gulls in the air is (null: none), for a call to come from. */
  flying(rand: () => number): V3 | null {
    const up = this.gulls.filter((g) => g.mode !== 'perched' && !g.fall);
    return up.length ? up[Math.floor(rand() * up.length)].at : null;
  }

  /** A round across the yard: the first gull in its way, sat or flying, is shot down. */
  shoot(round: Round, rt: WorldRuntime): void {
    const i = first(round, this.middles(), REACH);
    if (i >= 0) this.down(i, new THREE.Vector3(...round.direction).multiplyScalar(2), rt);
  }

  /** A blast: those near it are blown out of the air (or off their perches). */
  blast(at: V3, radius: number, rt: WorldRuntime): void {
    for (const { i, push } of blown(at, radius, this.middles())) this.down(i, push, rt);
  }

  /** Where each gull's body is (null: shot already). */
  private middles(): Array<THREE.Vector3 | null> {
    return this.gulls.map((g) => (g.fall ? null : new THREE.Vector3(g.at[0], g.at[1] + MIDDLE, g.at[2])));
  }

  /** Gull i struck, pushed by `push` (m/s): feathers and a cry, and down it goes. */
  private down(i: number, push: THREE.Vector3, rt: WorldRuntime): void {
    const g = this.gulls[i];
    const at = new THREE.Vector3(g.at[0], g.at[1] + MIDDLE, g.at[2]);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(g.roll, g.yaw, this.pitch(g), 'YZX'));
    g.fall = new Fall(at, new THREE.Vector3(...g.v), q, push, FORWARD, 1.3, 0.07);
    struck(at, WHITE, 2, rt, 'gulls.call');
  }

  private pitch(g: Gull): number {
    return g.mode === 'perched' ? 0.15 : Math.atan2(g.v[1], Math.hypot(g.v[0], g.v[2])) * 0.5;
  }

  update(dt: number, time: number, perchOk: (perch: V3) => boolean, floor: (at: V3) => number): void {
    for (const g of this.gulls) {
      if (g.fall) {
        const was = g.fall.down;
        g.fall.update(dt, floor);
        if (g.fall.down && !was) this.onLanded(g.fall.at.toArray() as V3);
        g.phase += dt * 14;
        continue;
      }
      if (g.mode === 'perched') {
        // Now and then it turns its head (the whole bird, a little)
        if (time > g.lookAt) {
          g.lookAt = time + 2 + Math.random() * 5;
          g.yaw += (Math.random() - 0.5) * 0.8;
        }
        g.fold = 1;
        g.beat = 0;
        continue;
      }
      if (time < g.goAt) continue;
      if (g.mode === 'flying' && time > g.home) {
        // Back to its perch if it's still there, else round again a while
        if (g.perch && perchOk(g.perch)) g.mode = 'landing';
        else g.home = time + AWAY;
      }
      let target: V3;
      let speed: number;
      if (g.mode === 'landing' && g.perch) {
        target = g.perch;
        const d = Math.hypot(target[0] - g.at[0], target[1] - g.at[1], target[2] - g.at[2]);
        if (d < 0.3) {
          g.mode = 'perched';
          g.at = [...g.perch];
          g.v = [0, 0, 0];
          g.roll = 0;
          continue;
        }
        speed = Math.min(9, 0.8 + d * 0.9);
      } else {
        const c = g.circle;
        c.a += c.w * dt;
        target = [c.c[0] + Math.cos(c.a) * c.r, c.c[1] + Math.sin(c.a * 2) * 2, c.c[2] + Math.sin(c.a) * c.r];
        speed = 9;
      }
      const to: V3 = [target[0] - g.at[0], target[1] - g.at[1], target[2] - g.at[2]];
      const l = Math.hypot(...to) || 1;
      const k = Math.min(1, dt * 1.3);
      for (let i = 0; i < 3; i++) {
        g.v[i] += ((to[i] / l) * speed - g.v[i]) * k;
        g.at[i] += g.v[i] * dt;
      }
      // Heading along its way, banked into the turn; beating its wings while it climbs, slows to
      // land or has just taken off, gliding otherwise
      const yaw = Math.atan2(-g.v[2], g.v[0]);
      let turn = yaw - g.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      g.yaw += turn;
      g.roll += (Math.max(-0.7, Math.min(0.7, (-turn / Math.max(dt, 1e-3)) * 0.35)) - g.roll) * Math.min(1, dt * 3);
      const beating = g.v[1] > 0.6 || g.mode === 'landing' || time - g.goAt < 1.5 || Math.sin(time * 0.7 + g.circle.a * 3) > 0.85;
      g.beat += ((beating ? 1 : 0) - g.beat) * Math.min(1, dt * 4);
      g.fold += (0 - g.fold) * Math.min(1, dt * 6);
      g.phase += dt * Math.PI * 2 * (2.2 + g.beat * 1.4);
    }
    this.draw();
  }

  private draw(): void {
    const m = new THREE.Matrix4();
    const w = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    this.gulls.forEach((g, i) => {
      const f = g.fall;
      if (f) m.compose(f.at, f.q, s.set(1, 1, 1));
      else m.compose(p.set(g.at[0], g.at[1] + MIDDLE, g.at[2]), q.setFromEuler(e.set(g.roll, g.yaw, this.pitch(g), 'YZX')), s.set(1, 1, 1));
      this.bodies.setMatrixAt(i, m);
      // Each wing from its shoulder: beating up and down about the body's length, folded back along
      // it on the perch; shot, limp and half folded, a last flutter dying away as it falls, folded lying
      const flap = f ? 0.3 + 0.6 * Math.sin(g.phase) * Math.exp(-f.t * 1.5) : g.beat * Math.sin(g.phase) * 0.75 + (1 - g.beat) * 0.08;
      const fold = f ? (f.down ? 1 : 0.35) : g.fold;
      for (const side of [1, -1]) {
        e.set(-side * flap * (1 - fold), -side * fold * 1.35, 0, 'YXZ');
        w.compose(p.set(0.02, 0.035, side * 0.035), q.setFromEuler(e), s.set(1, 1, side * (1 - 0.45 * fold)));
        this.wings.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), w.premultiply(m));
      }
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.wings.instanceMatrix.needsUpdate = true;
  }
}
