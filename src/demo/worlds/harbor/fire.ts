// What a burning tank shows: a flame at each hole (an orange cone with a yellow one inside, bright
// enough to bloom, flickering) and one orange point light at the newest fire; its black smoke is the
// demo's puffs (index.ts). And what a holed tank or drum shows before that: a dark stream running
// down from each hole and the pool it spreads at its foot (Leaks). Made with the scenery and drawn
// from the start, out of sight, so nothing is compiled when a tank catches or a drum is holed.

import { abs, color, float, mix, modelPosition, modelScale, mrt, mx_noise_float, normalView, output, positionGeometry, positionLocal, positionViewDirection, positionWorld, sin, smoothstep, step, time, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { V3 } from '../../../lib/index.ts';

/** The demo draws particles on layer 1: not in the ambient occlusion's pre-pass. */
const PARTICLES = 1;
/** Drawn after the demo's dust and smoke (1000, 1001), so a flame shows through the blast's cloud. */
const OVER_SMOKE = 1002;
const HIDDEN = -200;

export class Fires {
  private readonly light: THREE.PointLight;
  private readonly flames: Array<{ outer: THREE.Mesh; inner: THREE.Mesh; at: V3 | null; phase: number }> = [];

  constructor(scene: THREE.Scene) {
    // Never quite dark: a light's intensity counts in pipeline keys as zero or not
    this.light = new THREE.PointLight(0xff8a3a, 0.01, 30, 2);
    this.light.position.set(0, HIDDEN, 0);
    this.light.castShadow = false;
    scene.add(this.light);

    // Flames: bright near the root (which fades in, so the cone's rim doesn't show), torn into
    // tongues toward the tip (noise rising through them), the tip swaying, soft at the silhouette,
    // over white so bloom takes them
    const flame = (hex: number, height: number, gain: number, seed: number) => {
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const p = positionGeometry;
      const t = p.y.div(height).clamp(0, 1);
      const sway = vec3(mx_noise_float(vec3(p.y.mul(0.6).sub(time.mul(1.7)), seed, 0)), 0, mx_noise_float(vec3(p.y.mul(0.6).sub(time.mul(1.9)), seed, 5)));
      m.positionNode = p.add(sway.mul(t.mul(t).mul(height * 0.22)));
      const rising = mx_noise_float(vec3(p.x.mul(2.2), p.y.mul(1.1).sub(time.mul(3.4)), p.z.mul(2.2).add(seed))).mul(0.5).add(0.5);
      const tongues = smoothstep(0.42, 0.62, rising.add(float(1).sub(t).mul(0.9)).sub(0.5));
      const edge = abs(normalView.dot(positionViewDirection)).pow(2.5);
      const heat = mix(color(hex), color(0xff2a08), t);
      m.colorNode = vec4(heat.mul(float(1).sub(t).pow(0.9).mul(smoothstep(0, 0.15, t)).mul(tongues).mul(edge).mul(gain)), 1) as unknown as THREE.Node<'vec4'>;
      // Added to nothing but the colour: with the look's reflections the beauty pass also writes
      // normals and how much each pixel reflects, and the cone's own showed as a pale outline
      // round the flame
      m.mrtNode = mrt({ output, normal: vec4(0), shine: vec4(0) });
      return m;
    };
    const outerGeo = new THREE.ConeGeometry(1.2, 4, 16, 1, true).translate(0, 2, 0);
    const innerGeo = new THREE.ConeGeometry(0.6, 2.6, 12, 1, true).translate(0, 1.3, 0);
    const outerMat = flame(0xff6a18, 4, 2.4, 0);
    const innerMat = flame(0xffb040, 2.6, 2.8, 7);
    for (let i = 0; i < 3; i++) {
      const outer = new THREE.Mesh(outerGeo, outerMat);
      const inner = new THREE.Mesh(innerGeo, innerMat);
      for (const c of [outer, inner]) {
        c.position.set(0, HIDDEN, 0);
        c.scale.setScalar(1e-4);
        c.frustumCulled = false;
        c.renderOrder = OVER_SMOKE;
        c.layers.set(PARTICLES);
        scene.add(c);
      }
      this.flames.push({ outer, inner, at: null, phase: i * 2.1 });
    }
  }

  /** Light a flame at `at` (its foot): its index, or -1 when all three are burning. */
  start(at: V3): number {
    const i = this.flames.findIndex((f) => !f.at);
    if (i >= 0) this.flames[i].at = at;
    return i;
  }

  stop(i: number): void {
    const f = this.flames[i];
    if (!f) return;
    f.at = null;
    for (const c of [f.outer, f.inner]) {
      c.position.set(0, HIDDEN, 0);
      c.scale.setScalar(1e-4);
    }
  }

  /** The flames flicker, the newest one's light with them. */
  update(time: number, newest: V3 | null): void {
    for (const f of this.flames) {
      if (!f.at) continue;
      const k = 0.85 + Math.random() * 0.2 + Math.sin(time * 9 + f.phase) * 0.08;
      const up = 0.8 + Math.random() * 0.45 + Math.sin(time * 6.3 + f.phase) * 0.15;
      f.outer.position.set(...f.at);
      f.outer.scale.set(k, up, k);
      f.inner.position.set(...f.at);
      f.inner.scale.set(k, up * (0.9 + Math.random() * 0.25), k);
      f.outer.rotation.y = time * 0.7 + f.phase;
    }
    if (newest) {
      this.light.intensity = 25 + 30 * Math.random() * (0.6 + 0.4 * Math.sin(time * 13));
      this.light.position.set(newest[0], newest[1] + 1.5, newest[2]);
    } else this.light.intensity = 0.01;
  }
}

/** Fuel oil: near black, a little brown, glossy enough to mirror the yard. */
const OIL = 0x0c0907;
/** How fast a stream's front runs down from its hole (m/s). */
const RUN = 2.5;
/** How long a stream takes to thin out and stop (s). */
const THIN = 2;

/** How a leak runs: its strip's width (m; the stream wanders in it), its pool's size and how fast it spreads (m, s), and how long it runs (s). */
export interface LeakOptions {
  strip: number;
  most: number;
  spread: number;
  life: number;
}

/** A pool spreading where a stream reaches the floor. */
interface Pool {
  mesh: THREE.Mesh;
  /** What it leaked from (null: a slot not used yet). */
  source: object | null;
  at: V3;
  most: number;
  spread: number;
  /** When the stream reached it; its radius now; whether a stream still feeds it. */
  since: number;
  radius: number;
  fed: boolean;
}

/** A leak: a stream running down from a hole, and the pool it spreads at its foot. */
export interface Leak {
  /** What it leaks from (a tank, a drum). */
  source: object;
  /** The hole, the level way out from the surface there, and the floor under it. */
  at: V3;
  out: V3;
  floor: number;
  strip: number;
  /** When it began, when it stops running, and when it began to thin out (Infinity: not yet). */
  start: number;
  until: number;
  ending: number;
  stream: THREE.Mesh;
  pool: Pool;
  options: LeakOptions;
}

/**
 * The yard's leaks, each a stream and a pool from a few made up front (a burst of 70 rounds doesn't
 * make 70): past them, the oldest go to the newest holes. A stream is a strip on the surface under
 * its hole, the stream a band wandering down it, its front running down at RUN; a pool a disc on
 * the floor, the oil a blob in it fixed in the world, so it spreads into the yard's low spots as it
 * grows rather than swelling. Neither is drawn under the `walls` (x0, z0, x1, z1: the bund's).
 */
export class Leaks {
  readonly leaks: Leak[] = [];
  private readonly free: THREE.Mesh[] = [];
  private readonly pools: Pool[] = [];

  constructor(scene: THREE.Scene, walls: Array<[number, number, number, number]>, streams = 12, pools = 16) {
    // The stream: a band down the strip (the strip's x -0.5 to 0.5, its y 0 at the hole down to -1
    // at the floor), starting narrow at the hole and wandering and widening as it runs down, its
    // gloss running down with it
    const sm = new THREE.MeshStandardNodeMaterial({ metalness: 0, envMapIntensity: 0.6 });
    const u = positionLocal.x;
    const y = positionWorld.y;
    const seed = modelPosition.x.mul(1.37).add(modelPosition.z.mul(2.71));
    const down = positionLocal.y.negate().mul(modelScale.y);
    const wander = mx_noise_float(vec3(y.mul(1.3), seed, 0.5)).mul(0.22).mul(smoothstep(0, 0.4, down));
    const half = float(0.14).add(mx_noise_float(vec3(y.mul(6), seed, 3.5)).mul(0.04)).add(smoothstep(0, 1.5, down).mul(0.07)).mul(smoothstep(0, 0.15, down).mul(0.5).add(0.5));
    sm.opacityNode = step(abs(u.sub(wander)), half);
    sm.alphaTest = 0.5;
    const flow = mx_noise_float(vec3(u.mul(10), y.mul(2.5).add(time.mul(2.2)), seed)).mul(0.5).add(0.5);
    sm.colorNode = mix(color(OIL), color(0x2a1a0c), flow.mul(0.35));
    sm.roughnessNode = mix(float(0.1), float(0.25), flow);
    const strip = new THREE.PlaneGeometry(1, 1, 1, 24).translate(0, -0.5, 0);
    for (let i = 0; i < streams; i++) {
      const m = new THREE.Mesh(strip, sm);
      hide(m);
      m.receiveShadow = true;
      scene.add(m);
      this.free.push(m);
    }

    // The pool: a blob fixed in the world inside the disc (its x, z -1 to 1), black with a thin
    // film's colours where it's thinnest, at its edge, and a soft sheen: the sky's light off it
    // dimmed, what stands by only blurred in it
    const pm = new THREE.MeshStandardNodeMaterial({ metalness: 0, envMapIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const w = positionWorld.xz;
    const ps = modelPosition.x.mul(0.73).add(modelPosition.z.mul(1.91));
    const r = positionLocal.xz.length();
    const edge = float(1).sub(mx_noise_float(vec3(w.mul(1.1), ps)).mul(0.5).add(0.5).mul(0.4)).sub(mx_noise_float(vec3(w.mul(3.7), ps.add(5))).mul(0.5).add(0.5).mul(0.12));
    let keep: THREE.Node<'float'> = step(r, edge);
    for (const [x0, z0, x1, z1] of walls) keep = keep.mul(float(1).sub(step(x0, w.x).mul(step(w.x, x1)).mul(step(z0, w.y)).mul(step(w.y, z1))));
    pm.opacityNode = keep;
    pm.alphaTest = 0.5;
    const rim = smoothstep(edge.mul(0.55), edge, r);
    const hue = mx_noise_float(vec3(w.mul(2.3), ps.add(9))).mul(3).add(r.mul(4));
    const film = vec3(sin(hue), sin(hue.add(2.1)), sin(hue.add(4.2))).mul(0.5).add(0.5);
    pm.colorNode = mix(color(OIL), film.mul(0.03), rim.mul(0.6));
    pm.roughnessNode = mix(float(0.28), float(0.36), rim);
    const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < pools; i++) {
      const m = new THREE.Mesh(disc, pm);
      hide(m);
      m.receiveShadow = true;
      scene.add(m);
      this.pools.push({ mesh: m, source: null, at: [0, HIDDEN, 0], most: 0, spread: 1, since: 0, radius: 0, fed: false });
    }
  }

  /**
   * A hole in `source` at `at` on a surface facing `normal` starts leaking down to `floor`: its
   * stream and its pool (the oldest leak's stream and the oldest pool when all are taken).
   */
  start(source: object, at: V3, normal: V3, floor: number, options: LeakOptions, time: number): Leak {
    if (!this.free.length) this.end(this.leaks[0], time, true);
    const leak: Leak = { source, at: [...at], out: [0, 0, 1], floor, strip: options.strip, start: time, until: time + options.life, ending: Infinity, stream: this.free.pop()!, pool: this.pools[0], options };
    this.leaks.push(leak);
    this.place(leak, at, normal, floor);
    leak.pool = this.pool(leak, at, floor, time);
    return leak;
  }

  /**
   * Its hole has moved (a drum pushed along by the gun): the stream goes with it, and once its foot
   * is off the pool it was spreading, it spreads a new one there.
   */
  move(leak: Leak, at: V3, normal: V3, floor: number, time: number): void {
    this.place(leak, at, normal, floor);
    const p = leak.pool;
    if (Math.hypot(at[0] + leak.out[0] * 0.08 - p.at[0], at[2] + leak.out[2] * 0.08 - p.at[2]) < 0.3 && Math.abs(floor + 0.004 - p.at[1]) < 0.1) return;
    p.fed = false;
    leak.pool = this.pool(leak, at, floor, time);
  }

  /** The stream on the surface under the hole, facing out from it, down to the floor. */
  private place(leak: Leak, at: V3, normal: V3, floor: number): void {
    const l = Math.hypot(normal[0], normal[2]) || 1;
    const out: V3 = [normal[0] / l, 0, normal[2] / l];
    const x = new THREE.Vector3(out[2], 0, -out[0]);
    leak.stream.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3(0, 1, 0), new THREE.Vector3(...out)));
    leak.stream.position.set(at[0] + out[0] * 0.012, at[1], at[2] + out[2] * 0.012);
    leak.at = [...at];
    leak.out = out;
    leak.floor = floor;
  }

  /** A pool for the leak where its stream reaches the floor, just out from the surface: one not used yet, else the oldest (not fed first). */
  private pool(leak: Leak, at: V3, floor: number, time: number): Pool {
    const pool = this.pools.find((p) => !p.source) ?? this.pools.filter((p) => !p.fed).sort((a, b) => a.since - b.since)[0] ?? this.pools.sort((a, b) => a.since - b.since)[0];
    for (const k of [...this.leaks]) if (k !== leak && k.pool === pool) this.end(k, time, true);
    const out = leak.out;
    Object.assign(pool, { source: leak.source, at: [at[0] + out[0] * 0.08, floor + 0.004, at[2] + out[2] * 0.08], most: leak.options.most, spread: leak.options.spread, since: Infinity, radius: 0, fed: true });
    pool.mesh.position.set(...pool.at);
    pool.mesh.scale.setScalar(1e-4);
    return pool;
  }

  /** The leaks of `source` still running. */
  of(source: object): Leak[] {
    return this.leaks.filter((l) => l.source === source && l.ending === Infinity);
  }

  /** It stops running: the stream thins out (at once: it's gone), the pool keeps what it has. */
  end(leak: Leak, time: number, now = false): void {
    if (leak.ending === Infinity) leak.ending = time;
    leak.pool.fed = false;
    const i = this.leaks.indexOf(leak);
    if (!now || i < 0) return;
    hide(leak.stream);
    this.free.push(leak.stream);
    this.leaks.splice(i, 1);
  }

  /** What leaked the pool reaching within `r` of `at` (null: none). */
  poolNear(at: V3, r: number): object | null {
    return this.pools.find((p) => p.source && p.radius > 0.05 && Math.hypot(p.at[0] - at[0], p.at[2] - at[2]) < p.radius + r && Math.abs(p.at[1] - at[1]) < r + 0.5)?.source ?? null;
  }

  /** A blast throws what lies within `r` of `at`: its pools go, and the streams into them stop. */
  clear(at: V3, r: number, time: number): void {
    for (const p of this.pools) {
      if (!p.source || Math.hypot(p.at[0] - at[0], p.at[1] - at[1], p.at[2] - at[2]) > r + p.radius * 0.5) continue;
      for (const l of [...this.leaks]) if (l.pool === p) this.end(l, time, true);
      p.source = null;
      p.radius = 0;
      hide(p.mesh);
    }
  }

  /** The streams run down and thin out when they stop, the pools they feed spread. */
  update(time: number): void {
    for (const l of [...this.leaks]) {
      const length = Math.max(0.01, l.at[1] - l.floor);
      const run = Math.min(length, (time - l.start) * RUN);
      if (run >= length && l.pool.since === Infinity) l.pool.since = time;
      if (l.ending === Infinity && time > l.until) this.end(l, time);
      const thin = l.ending === Infinity ? 1 : 1 - (time - l.ending) / THIN;
      if (thin <= 0) {
        this.end(l, time, true);
        continue;
      }
      l.stream.scale.set(l.strip * thin, run, 1);
    }
    for (const p of this.pools) {
      if (!p.source || !p.fed || p.since === Infinity) continue;
      p.radius = p.most * (1 - Math.exp(-(time - p.since) / p.spread));
      p.mesh.scale.setScalar(Math.max(1e-4, p.radius));
    }
  }
}

/** Out of sight (drawn, so its pipelines are made at load). */
function hide(m: THREE.Mesh): void {
  m.position.set(0, HIDDEN, 0);
  m.scale.setScalar(1e-4);
}
