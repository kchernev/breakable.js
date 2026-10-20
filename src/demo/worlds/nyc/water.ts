// The street's water: the hydrants and the tanks on the roofs. A hydrant knocked off its base
// (thrown by a blast, struck by what falls, shot off it) leaves the main open: a column of water
// roars up from the stub, comes down as spray and spreads over the sidewalk, the pressure falling off
// over about 20 s. A tank holed by the gun below its water leaks from the hole onto its roof, the
// stream weakening as it drains; one blown open lets all of it go at once. The droplets are GPU
// particles drawn as the effects draw their bits (streaked along their motion, lit by the sun and the
// sky, fogged by hand, on the particles' layer); the mist is the effects' puffs; the hydrant's hiss
// is the base pack's fire loop pitched up, where its crackle turns to spatter.

import { abs, atan, cameraPosition, cameraViewMatrix, dot, Fn, float, hash, If, instancedArray, instanceIndex, length, mix, normalize, pow, saturate, select, smoothstep, storage, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Destruction, ImpactEvent, Piece, V3, Voice } from '../../../lib/index.ts';
import type { BulletHit } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';
import { ROAD, STREET } from './city.ts';

/** Droplets in flight at once, for all the hydrants and tanks together. */
const CAP = 4096;
/** How fast the column leaves the main at full pressure (m/s: about 7 m up). */
const JET = 11.5;
/** Seconds the water runs, its pressure falling off all the while. */
const RUNS = 20;
/** Droplets a second at full pressure. */
const RATE = 1200;
/** Rounds that crack a hydrant off its main. */
const ROUNDS = 3;
/** Leaks: the most in a tank and in all, droplets a second from one at a metre's head, and how many are heard. */
const LEAKS = 3;
const ALL_LEAKS = 6;
const LEAK_RATE = 110;
const HEARD = 2;
/** How far the tank's legs and deck raise it off the roof (city.ts waterTower). */
const STAND = 2.32;
const G = 9.81;
/** The layer the demo's particles are on (the ambient occlusion's pre-pass leaves them out). */
const PARTICLES = 1;

interface Hydrant {
  piece: Piece;
  /** Where it stood. */
  base: V3;
  /** How high the main's stub is: where it stood, or lower in a crater under it (found as it runs). */
  stub: number;
  puddle: THREE.Mesh;
  /** When it burst (-1: it hasn't), and the rounds it has taken. */
  burst: number;
  rounds: number;
  /** Which way the column leans (a unit vector, near straight up). */
  lean: V3;
  hiss: Voice | null;
  /** Water on the sidewalk (how far the puddle has spread). */
  wet: number;
  /** The flags the puddle may spread over: the sidewalk's top layer round it, slabs and the cells cut from them. */
  under: Set<Piece>;
  /** Whether there's a hole under the puddle, and when to look again. */
  holed: boolean;
  look: number;
  carry: number;
  mist: number;
}

interface Tank {
  /** Its staves (the twelve-sided drum), its axis at its foot, its radius, and the roof it stands over. */
  piece: Piece;
  foot: V3;
  radius: number;
  roof: number;
  /** How high the water stands in it (m over its foot). */
  level: number;
  leaks: Leak[];
}

interface Leak {
  /** The hole, and which way the water comes out of it. */
  at: V3;
  dir: V3;
  voice: Voice | null;
  carry: number;
  mist: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Water {
  private readonly hydrants: Hydrant[] = [];
  private readonly tanks: Tank[] = [];
  /** Tanks blown open since the last update, to let their water go then. */
  private readonly opened: Tank[] = [];
  private readonly P = instancedArray(CAP, 'vec4'); // position, age
  private readonly V = instancedArray(CAP, 'vec4'); // velocity, life
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private head = 0;
  private start = 0;
  private pending = 0;
  /** When the last droplet dies (s). */
  private lastDeath = -1;
  private time = 0;
  private readonly sprite: THREE.Sprite;
  private readonly kernel: THREE.ComputeNode;
  private renderer: THREE.Renderer | null = null;
  /** Drawn once, its kernel run then: their shaders are made (the first burst then costs what any does). */
  private drawn = false;
  private sun: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private readonly uDt = uniform(0);
  private readonly uWind = uniform(new THREE.Vector3());
  private readonly uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  private readonly uSun = uniform(new THREE.Vector3(3, 3, 3));
  private readonly uSky = uniform(new THREE.Vector3(1, 1, 1));
  private readonly uFog = uniform(new THREE.Vector3(0, 1, 0)); // near, far, on
  private readonly uFogColor = uniform(new THREE.Vector3());

  private readonly d: Destruction;

  /** The hydrant props among `d`'s pieces, ready to burst, and the tanks on its roofs, full. */
  constructor(d: Destruction) {
    this.d = d;
    const scene = d.scene!;
    this.p = this.P.value.array as Float32Array;
    this.v = this.V.value.array as Float32Array;
    this.kernel = this.compute();
    this.sprite = new THREE.Sprite(this.material());
    this.sprite.count = CAP;
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 1002;
    this.sprite.layers.set(PARTICLES);
    // Drawn from the start (all its droplets dead), its kernel run at the first draw: the demo draws
    // a frame before play, so both are made while the world loads
    this.sprite.onBeforeRender = (renderer) => {
      if (this.drawn) return;
      this.renderer = renderer as unknown as THREE.Renderer;
      this.renderer.compute(this.kernel);
      this.drawn = true;
    };
    scene.add(this.sprite);
    const wet = puddleMaterial();
    const disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    for (const piece of d.all()) {
      const b = piece.bounds;
      // A tank: the tall drum of staves (its cone of a roof is the other piece of wood)
      if (piece.materialName === 'wood' && b.max[1] - b.min[1] > 2) {
        const foot: V3 = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
        this.tanks.push({ piece, foot, radius: (b.max[0] - b.min[0]) / 2, roof: foot[1] - STAND, level: b.max[1] - b.min[1] - 0.15, leaks: [] });
      }
      if (piece.prop?.name !== 'hydrant') continue;
      const base: V3 = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
      // The puddle is there from the start too, too small to see
      const puddle = new THREE.Mesh(disc, wet);
      puddle.position.set(base[0], base[1] + 0.004, base[2]);
      puddle.scale.setScalar(1e-3);
      puddle.receiveShadow = true;
      scene.add(puddle);
      // The flags it may spread over: along the curb 3.2 m each way, back to the facade
      const under = new Set(d.all().filter((p) => p.ground && p.materialName === p.ground.material && this.reaches(base, p)));
      this.hydrants.push({ piece, base, stub: base[1], puddle, burst: -1, rounds: 0, lean: [0, 1, 0], hiss: null, wet: 0, under, holed: false, look: 0, carry: 0, mist: 0 });
    }
    d.on('fracture', ({ piece, pieces }) => {
      // A flag under a puddle broken: what's left of it is under it now
      for (const h of this.hydrants)
        if (h.under.delete(piece)) for (const cell of pieces) if (this.reaches(h.base, cell)) h.under.add(cell);
      // A tank blown open: its water goes, all at once
      const tank = this.tanks.find((t) => t.piece === piece);
      if (tank && tank.level > 0.3) this.opened.push(tank);
    });
  }

  /** Something struck a hydrant hard enough to crack it off its main. */
  struck(e: ImpactEvent, rt: WorldRuntime): void {
    const h = this.hydrants.find((h) => h.piece === e.other);
    if (h && h.burst < 0 && e.speed > 4 && e.piece.mass > 0.05) this.burst(h, rt);
  }

  /**
   * A round struck something: a hydrant takes a few to crack off its main and goes over the way
   * they went; a tank holed below its water leaks from the hole.
   */
  shot(hit: BulletHit, rt: WorldRuntime): void {
    const h = this.hydrants.find((h) => h.piece === hit.piece);
    if (h && h.burst < 0 && ++h.rounds >= ROUNDS) {
      const [x, , z] = hit.direction;
      this.d.push(h.piece, [x * 2.2, 1.6, z * 2.2]);
      this.burst(h, rt);
    }
    const tank = this.tanks.find((t) => t.piece === hit.piece);
    if (!tank || tank.piece.state !== 'fixed' || hit.at[1] > tank.foot[1] + tank.level - 0.05) return;
    if (tank.leaks.length >= LEAKS || this.tanks.reduce((n, t) => n + t.leaks.length, 0) >= ALL_LEAKS) return;
    const heard = this.tanks.reduce((n, t) => n + t.leaks.filter((l) => l.voice).length, 0);
    const voice = heard < HEARD ? rt.sound.play('water.leak', { at: hit.at, fadeIn: 0.3 }) : null;
    tank.leaks.push({ at: hit.at, dir: [hit.normal[0], 0, hit.normal[2]], voice, carry: 0, mist: 0 });
  }

  update(dt: number, rt: WorldRuntime): void {
    this.time += dt;
    this.uDt.value = dt;
    this.findLights(rt.scene);
    this.uWind.value.copy(rt.effects.wind);
    for (const h of this.hydrants) {
      if (h.burst < 0) {
        // Knocked off its base: gone, or moved or tipped on it
        const p = h.piece;
        if (p.state === 'gone' || (p.state === 'loose' && this.moved(h))) this.burst(h, rt);
        continue;
      }
      const pressure = Math.max(0, 1 - (rt.time - h.burst) / RUNS) ** 1.5;
      if (pressure > 0.03) {
        // From the main's stub: down in a crater, if the sidewalk under it has gone
        h.stub = this.floor(h.base[0], h.base[2], h.base[1]);
        this.spray(h, pressure, dt, rt);
      } else if (h.hiss) {
        h.hiss.stop(1.5);
        h.hiss = null;
      }
      // The puddle spreads along the curb and back from it while the water runs, and dries slowly
      // after; its edge stays on the sidewalk (the road is lower). Where the sidewalk under any of it
      // has gone (a crater, a flag shot through) it runs off into the hole: it shrinks until it's
      // clear of it, and none forms over one
      if (h.wet > 0 && rt.time >= h.look) {
        h.holed = this.holed(h);
        h.look = rt.time + 0.2;
      }
      h.wet = h.wet > 0 && h.holed ? Math.max(0, h.wet - dt * 3) : pressure > 0.03 ? h.wet + pressure * dt : Math.max(0, h.wet - dt * 0.02);
      const r = Math.min(2.6, Math.sqrt(h.wet));
      const across = 0.45 + r * 0.45;
      h.puddle.scale.set(Math.max(1e-3, r * 1.2), 1, r > 0 ? across : 1e-3);
      h.puddle.position.z = h.base[2] + Math.sign(h.base[2]) * (across - 0.5);
    }
    for (const tank of this.opened.splice(0)) this.open(tank, rt);
    for (const tank of this.tanks) this.leak(tank, dt, rt);
    this.flush();
    const live = this.time < this.lastDeath;
    if (this.renderer && live) this.renderer.compute(this.kernel);
    this.sprite.visible = live || !this.drawn;
  }

  private moved(h: Hydrant): boolean {
    const b = h.piece.bounds;
    return Math.hypot((b.min[0] + b.max[0]) / 2 - h.base[0], (b.min[2] + b.max[2]) / 2 - h.base[2]) > 0.25 || Math.abs(b.min[1] - h.base[1]) > 0.1;
  }

  /** Whether `piece` lies where a hydrant's puddle at `base` may spread (3.2 m along the curb each way, back to the facade). */
  private reaches(base: V3, piece: Piece): boolean {
    const b = piece.bounds;
    return b.max[0] > base[0] - 3.2 && b.min[0] < base[0] + 3.2 && Math.sign(b.min[2] + b.max[2]) === Math.sign(base[2]) && Math.abs(b.min[2] + b.max[2]) / 2 > STREET.halfRoad;
  }

  /** What's under (x, z) as high as `top` (the pavement, rubble, a chunk), or the bed under a crater. */
  private floor(x: number, z: number, top: number): number {
    const hit = this.d.raycast([x, top + 0.05, z], [0, -1, 0], 3);
    return hit ? hit.point[1] : ROAD.bed;
  }

  /**
   * Whether the puddle lies over a hole anywhere: a point of it (every 8 cm, out to 0.9 of its
   * radius, where it's still wet to see) that no standing flag's top covers.
   */
  private holed(h: Hydrant): boolean {
    const { x, z } = h.puddle.position;
    const [rx, rz] = [h.puddle.scale.x * 0.9, h.puddle.scale.z * 0.9];
    // The flags' tops as outlines seen from above, each with its box
    const tops: Array<{ pts: V3[]; x0: number; x1: number; z0: number; z1: number }> = [];
    for (const p of h.under) {
      if (p.state !== 'fixed') continue;
      const b = p.bounds;
      if (b.max[0] < x - rx || b.min[0] > x + rx || b.max[2] < z - rz || b.min[2] > z + rz) continue;
      for (const f of p.convex.faces)
        if (f.n[1] > 0.95 && f.pts[0][1] > h.base[1] - 0.03) tops.push({ pts: f.pts, x0: b.min[0], x1: b.max[0], z0: b.min[2], z1: b.max[2] });
    }
    const step = 0.08;
    for (let i = -Math.floor(rx / step); i * step <= rx; i++)
      for (let k = -Math.floor(rz / step); k * step <= rz; k++) {
        const [u, w] = [i * step, k * step];
        if ((u / rx) ** 2 + (w / rz) ** 2 > 1) continue;
        const [px, pz] = [x + u, z + w];
        if (!tops.some((t) => px >= t.x0 && px <= t.x1 && pz >= t.z0 && pz <= t.z1 && inside(t.pts, px, pz))) return true;
      }
    return false;
  }

  private burst(h: Hydrant, rt: WorldRuntime): void {
    h.burst = rt.time;
    const a = rand(0, Math.PI * 2);
    const t = rand(0.02, 0.1);
    h.lean = [Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a)];
    h.hiss = rt.sound.play('fire.loop', { at: h.base, pitch: 1.45, fadeIn: 0.2 });
    rt.sound.play('metal.impact.small', { at: h.base, pitch: 0.8 });
  }

  /**
   * A frame of a tank's leaks: each a stream out of its hole as hard as the water over it pushes
   * (weakened: the hole is ragged), landing on the roof in a mist; the water falling as they run, each
   * stopping once it's down to its hole. A tank shot loose or apart stops leaking.
   */
  private leak(tank: Tank, dt: number, rt: WorldRuntime): void {
    if (!tank.leaks.length) return;
    const top = tank.foot[1] + tank.level;
    const standing = tank.piece.state === 'fixed';
    for (const l of tank.leaks) {
      const head = standing ? top - l.at[1] : 0;
      if (head < 0.03) {
        l.voice?.stop(1);
        l.voice = null;
        continue;
      }
      tank.level -= dt * 0.012 * Math.sqrt(head);
      const speed = 0.55 * Math.sqrt(2 * G * head);
      l.voice?.setVolume(Math.min(1, Math.sqrt(head)), 0.3);
      l.carry += dt * LEAK_RATE * Math.sqrt(head);
      const [dx, , dz] = l.dir;
      for (; l.carry >= 1; l.carry--) {
        const s = speed * rand(0.9, 1.04);
        const vy = s * rand(-0.05, 0.12);
        this.emit(l.at[0] + dx * 0.02, l.at[1], l.at[2] + dz * 0.02, dx * s + rand(-0.15, 0.15), vy, dz * s + rand(-0.15, 0.15), this.fall(vy, l.at[1] - tank.roof));
      }
      // Mist where it comes down on the roof
      l.mist += dt * 4 * Math.min(1, head);
      for (; l.mist >= 1; l.mist--) {
        const t = this.fall(0, l.at[1] - tank.roof);
        rt.effects.puff([l.at[0] + dx * speed * t, tank.roof + 0.1, l.at[2] + dz * speed * t], { color: 0xe4eaee, size: 0.6, life: 0.9, opacity: 0.12, rise: 0.15 });
      }
    }
    tank.leaks = tank.leaks.filter((l) => l.voice || (standing && top - l.at[1] >= 0.03));
  }

  /** A tank blown open: the water in it goes all at once, out through the staves and down over the roof. */
  private open(tank: Tank, rt: WorldRuntime): void {
    const [x, y, z] = tank.foot;
    for (let i = 0; i < 900; i++) {
      const a = rand(0, Math.PI * 2);
      const h = rand(0, tank.level);
      const [c, s] = [Math.cos(a), Math.sin(a)];
      const out = rand(1, 4.5);
      const vy = rand(-0.5, 1.5);
      this.emit(x + c * tank.radius, y + h, z + s * tank.radius, c * out, vy, s * out, this.fall(vy, y + h - tank.roof));
    }
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      rt.effects.puff([x + Math.cos(a) * 2, tank.roof + 0.5, z + Math.sin(a) * 2], { color: 0xe4eaee, size: 2.2, life: 2.5, opacity: 0.22, rise: 0.3, velocity: [Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5] });
    }
    for (const l of tank.leaks) l.voice?.stop(0.5);
    rt.sound.play('water.leak', { at: [x, y, z], volume: 2.5 })?.stop(1.8);
    tank.leaks = [];
    tank.level = 0;
  }

  /** Seconds for a droplet leaving at `vy` (m/s up) to fall `drop` metres. */
  private fall(vy: number, drop: number): number {
    return (vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, drop))) / G;
  }

  /** A frame of the column at `pressure` (1 when it burst). */
  private spray(h: Hydrant, pressure: number, dt: number, rt: WorldRuntime): void {
    h.hiss?.setVolume(3 * Math.sqrt(pressure), 0.2);
    h.hiss?.setRate(0.8 + 0.2 * pressure, 0.3);
    const jet = JET * Math.sqrt(pressure);
    const [x, , z] = h.base;
    const y = h.stub;
    h.carry += RATE * pressure * dt;
    const n = Math.floor(h.carry);
    h.carry -= n;
    const [lx, ly, lz] = h.lean;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.75) {
        // The column: tight, fast, a little ragged
        const s = jet * rand(0.82, 1.04);
        const w = r < 0.6 ? 0.05 : 0.22;
        this.emit(x + rand(-0.04, 0.04), y + 0.1, z + rand(-0.04, 0.04), (lx + rand(-w, w)) * s, ly * s, (lz + rand(-w, w)) * s);
      } else {
        // Splashes where it comes down round the base
        const a = rand(0, Math.PI * 2);
        const d = rand(0.3, 1.2) * (0.5 + pressure);
        this.emit(x + Math.cos(a) * d, y + 0.03, z + Math.sin(a) * d, Math.cos(a) * rand(0.5, 1.8), rand(1, 3) * pressure + 0.5, Math.sin(a) * rand(0.5, 1.8));
      }
    }
    // White water up the column's core, and mist where it turns over and where it lands
    h.mist += dt * 16 * pressure;
    const top = (jet * jet) / (2 * 9.81);
    while (h.mist >= 1) {
      h.mist--;
      const r = Math.random();
      if (r < 0.5) rt.effects.puff([x, y + 0.2, z], { color: 0xf2f5f7, size: 0.5 + top * 0.08, life: 0.9, opacity: 0.4, rise: 0, velocity: [lx * jet * 0.8, ly * jet * 0.8, lz * jet * 0.8] });
      else rt.effects.puff([x + rand(-0.5, 0.5), y + (r < 0.75 ? top * rand(0.7, 1) : 0.3), z + rand(-0.5, 0.5)], { color: 0xdfe6ea, size: r < 0.75 ? 2.4 : 1.6, life: 2.5, opacity: 0.16 * pressure + 0.05, rise: 0.1, velocity: [0, r < 0.75 ? -0.6 : 0.4, 0] });
    }
  }

  /** One droplet, written into the next slot (the oldest is overwritten), living `life` s (default: long enough to come down; the ground ends it). */
  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life = (2 * Math.max(vy, 0)) / 9.81 + 0.6): void {
    const i = this.head;
    if (this.pending === 0) this.start = i;
    if (this.pending < CAP) this.pending++;
    this.head = (i + 1) % CAP;
    this.lastDeath = Math.max(this.lastDeath, this.time + life);
    const o = i * 4;
    this.p.set([x, y, z, 0], o);
    this.v.set([vx, vy, vz, life], o);
  }

  /** Upload the slots written since the last flush (two ranges where they wrap round). */
  private flush(): void {
    if (this.pending === 0) return;
    for (const node of [this.P, this.V]) {
      const attr = node.value;
      const first = Math.min(this.pending, CAP - this.start);
      attr.addUpdateRange(this.start * 4, first * 4);
      if (this.pending > first) attr.addUpdateRange(0, (this.pending - first) * 4);
      attr.needsUpdate = true;
    }
    this.pending = 0;
  }

  private compute(): THREE.ComputeNode {
    const { P, V } = this;
    const dt = this.uDt;
    return Fn(() => {
      const pp = P.element(instanceIndex);
      const vv = V.element(instanceIndex);
      const age = pp.w.toVar();
      If(age.lessThan(vv.w), () => {
        const vel = vv.xyz.toVar();
        // Falling, and carried a little by the air
        vel.y.subAssign(float(9.81).mul(dt));
        vel.addAssign(this.uWind.sub(vel).mul(dt.mul(0.4)));
        const pos = pp.xyz.add(vel.mul(dt)).toVar();
        age.addAssign(dt);
        // Gone into the pavement: the sidewalk's top, or the asphalt's over the road; on the
        // breakable stretch, its bed (a crater may be under it: through what's still there, the
        // pavement hides it)
        const ground = select(abs(pos.x).lessThan(ROAD.half), float(ROAD.bed), select(abs(pos.z).lessThan(STREET.halfRoad), float(STREET.road), float(0)));
        If(pos.y.lessThan(ground), () => {
          age.assign(vv.w);
        });
        pp.assign(vec4(pos, age));
        vv.assign(vec4(vel, vv.w));
      });
    })().compute(CAP);
  }

  private material(): THREE.SpriteNodeMaterial {
    const p = storage(this.P.value, 'vec4', CAP).toReadOnly().element(instanceIndex);
    const v = storage(this.V.value, 'vec4', CAP).toReadOnly().element(instanceIndex);
    const alive = p.w.lessThan(v.w);
    const t = p.w.div(v.w.max(1e-3));
    const seed = hash(instanceIndex);
    const size = mix(float(0.018), float(0.04), seed);
    // Streaked along its motion on screen, as the effects' sparks are
    const vView = cameraViewMatrix.mul(vec4(v.xyz, 0)).xy;
    const m = new THREE.SpriteNodeMaterial();
    m.transparent = true;
    m.depthWrite = false;
    // Premultiplied, as the effects' particles
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.OneFactor;
    m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    m.fog = false;
    m.positionNode = p.xyz;
    m.scaleNode = select(alive, vec2(size.add(length(vView).mul(0.03)), size), vec2(0, 0));
    m.rotationNode = atan(vView.y, vView.x);
    // Water: the sky's light on it, the sun's, and a glint looking toward the sun through it
    const view = normalize(p.xyz.sub(cameraPosition));
    const glint = pow(saturate(dot(view, this.uSunDir)), 12).mul(2.5);
    const lit = vec3(0.78, 0.84, 0.9).mul(this.uSun.mul(float(0.45).add(glint)).add(this.uSky)).mul(1 / Math.PI);
    const depth = cameraViewMatrix.mul(vec4(p.xyz, 1)).z.negate();
    const fog = smoothstep(this.uFog.x, this.uFog.y, depth).mul(this.uFog.z);
    const q = uv().mul(2).sub(1);
    const shape = smoothstep(0.2, 1, dot(q, q)).oneMinus();
    const a = shape.mul(0.55).mul(smoothstep(0.8, 1, t).oneMinus());
    m.colorNode = vec4(mix(lit, this.uFogColor, fog).mul(a), a);
    return m;
  }

  /** The scene's sun and sky light, as the effects take them, for the droplets. */
  private findLights(scene: THREE.Scene): void {
    if (!this.sun || !this.hemi) {
      for (const o of scene.children) {
        if (!this.sun && (o as THREE.DirectionalLight).isDirectionalLight) this.sun = o as THREE.DirectionalLight;
        if (!this.hemi && (o as THREE.HemisphereLight).isHemisphereLight) this.hemi = o as THREE.HemisphereLight;
      }
    }
    if (this.sun) {
      const c = this.sun.color;
      this.uSun.value.set(c.r, c.g, c.b).multiplyScalar(this.sun.intensity);
      this.uSunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
    }
    if (this.hemi) {
      const c = this.hemi.color;
      this.uSky.value.set(c.r, c.g, c.b).multiplyScalar(this.hemi.intensity);
    }
    const fog = scene.fog as THREE.Fog | null;
    if (fog?.isFog) {
      this.uFog.value.set(fog.near, fog.far, 1);
      this.uFogColor.value.set(fog.color.r, fog.color.g, fog.color.b);
    }
  }
}

/** Wet pavement: darker and glossy, soft edged. */
function puddleMaterial(): THREE.MeshStandardNodeMaterial {
  // Solid to a third of the way out, then fading to the rim (as an alphaMap it comes out blank here)
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const t = Math.min(1, Math.max(0, (r - 0.35) / 0.65));
      data.fill(Math.round(255 * (1 - t * t * (3 - 2 * t))), (y * n + x) * 4, (y * n + x) * 4 + 4);
    }
  const alpha = new THREE.DataTexture(data, n, n);
  alpha.magFilter = THREE.LinearFilter;
  alpha.needsUpdate = true;
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x15181b, roughness: 0.12, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  m.opacityNode = texture(alpha).r.mul(0.8);
  return m;
}

/** Whether (x, z) is inside a convex face's outline seen from above (on its edge counts). */
function inside(pts: V3[], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    const c = (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
    if (Math.abs(c) < 1e-6) continue;
    if (!sign) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}
