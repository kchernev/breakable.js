// The water tower's water. Each round into the tank's staves under the waterline leaves a hole that
// spurts a thin stream out and down: it splashes where it comes down and darkens the dirt there,
// and slows as the level falls (every hole drains the one tank) until the level is under it. A tank
// whose bottom is shot through, with a third of its wall shot away or that comes down with the
// tower lets what's left go at once. The droplets are GPU particles drawn as Brick Street's hydrant's
// are (lit by the sun and the sky, streaked along their motion, fogged by hand, on the particles'
// layer); the spray is the effects' puffs.

import { atan, cameraPosition, cameraViewMatrix, dot, Fn, float, hash, If, instancedArray, instanceIndex, length, mix, mx_noise_float, normalize, positionWorld, pow, saturate, select, smoothstep, storage, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Destruction, Piece, V3, Voice } from '../../../lib/index.ts';
import type { BulletHit } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';
import { BED, onStreet } from './scenery.ts';
import type { Tank } from './works.ts';

/** Droplets in flight at once, for all the streams together. */
const CAP = 4096;
/** Streams at once: a round within a hand of a running one is into the same hole. */
const HOLES = 6;
const SAME = 0.3;
/** Wet patches on the ground at once; each dries in the sun. */
const PATCHES = 8;
/** Droplets a second in a stream from the bottom of a full tank (fewer as its head falls). */
const RATE = 450;
/**
 * How fast the level falls for each hole (m/s, times the root of the head over it, m): one hole at
 * the bottom empties a full tank in about 50 s. Game time; a real tank this size takes hours.
 */
const DRAIN = 0.07;
/** A hole's jet: this share of the speed falling its head would give (what a hole loses). */
const JET = 0.8;
const G = 9.81;
/** The longest a droplet lives (s); it goes where it comes down. */
const LIFE = 3;
/** How much a patch dries a second (it has taken a second of a full stream for each 1). */
const DRY = 0.12;
/** How long a patch takes to fade once the ground under it is blown away (s). */
const SINK = 0.5;
/** The layer the demo's particles are on (the ambient occlusion's pre-pass leaves them out). */
const PARTICLES = 1;

/** A dark patch where a stream comes down on the dirt. */
interface Patch {
  mesh: THREE.Mesh;
  opacity: THREE.UniformNode<'float', number>;
  /** Seconds of a full stream soaked up, less what's dried. */
  wet: number;
  /** Its line out from the tank's axis, how far along it the stream has come down (nearest and furthest), the ground's height, and how wide it spreads at most (m, each side). */
  out: V3;
  near: number;
  far: number;
  y: number;
  width: number;
  /** When the ground it lies on was blown away from under it (Infinity: it's there): it fades out then. */
  gone: number;
}

interface Hole {
  /** On the tank's face, and the way it spurts: level, out from the axis. */
  at: V3;
  out: V3;
  /** Where its stream comes down and on what (found again as it weakens), and when next to look. */
  land: V3;
  floor: number;
  look: number;
  /** Its patch (null: it comes down on the deck). */
  patch: Patch | null;
  /** Droplets and puffs of spray owed. */
  carry: number;
  mist: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Water {
  private readonly d: Destruction;
  private readonly tank: Tank;
  /** The water's surface (m), from a little under the rim down to the floor. */
  private level: number;
  private readonly full: number;
  private readonly holes: Hole[] = [];
  private readonly patches: Patch[] = [];
  /** The splashing of the streams coming down (one voice for them all), and when to ask for it again if none was free. */
  private splash: Voice | null = null;
  private splashIn = 0;
  /** When to look again at what the patches lie on. */
  private groundIn = 0;
  /** The wall's staves and the floor (and the cells of those shot), how much of each stood at the start (m³), when to look again, and what's left to spill once it bursts (s). */
  private readonly staves = new Set<Piece>();
  private readonly floorPieces = new Set<Piece>();
  private readonly wall: number;
  private readonly bottom: number;
  private checkIn = 0;
  private spilling = 0;
  private spillCarry = 0;
  // The droplets
  private readonly P = instancedArray(CAP, 'vec4'); // position, age
  private readonly V = instancedArray(CAP, 'vec4'); // velocity, the height it goes at
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private head = 0;
  private start = 0;
  private pending = 0;
  /** When the last droplet comes down (s). */
  private lastDeath = -1;
  private time = 0;
  private readonly sprite: THREE.Sprite;
  private readonly kernel: THREE.ComputeNode;
  private renderer: THREE.Renderer | null = null;
  /** Drawn once and its kernel run then: their shaders are made while the world loads. */
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

  /** The tower's tank (built in `d`), full. */
  constructor(d: Destruction, tank: Tank) {
    this.d = d;
    this.tank = tank;
    this.level = tank.rim - 0.25;
    this.full = this.level - tank.floor;
    for (const p of d.all()) if (this.inWall(p)) this.staves.add(p);
    for (const p of tank.bottom) this.floorPieces.add(p);
    d.on('fracture', (e) => {
      if (this.staves.delete(e.piece)) for (const p of e.pieces) if (this.inWall(p)) this.staves.add(p);
      if (this.floorPieces.delete(e.piece)) for (const p of e.pieces) this.floorPieces.add(p);
    });
    this.wall = this.standing(this.staves);
    this.bottom = this.standing(this.floorPieces);
    const scene = d.scene!;
    this.p = this.P.value.array as Float32Array;
    this.v = this.V.value.array as Float32Array;
    // Every droplet starts spent (an age of LIFE)
    for (let i = 0; i < CAP; i++) this.p[i * 4 + 3] = LIFE;
    this.kernel = this.compute();
    this.sprite = new THREE.Sprite(this.material());
    this.sprite.count = CAP;
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 1002;
    this.sprite.layers.set(PARTICLES);
    // Drawn from the start (all its droplets spent), its kernel run at the first draw: the demo
    // draws a frame before play, so both are made while the world loads
    this.sprite.onBeforeRender = (renderer) => {
      if (this.drawn) return;
      this.renderer = renderer as unknown as THREE.Renderer;
      this.renderer.compute(this.kernel);
      this.drawn = true;
    };
    scene.add(this.sprite);
    // The patches are there from the start too, too small to see
    const disc = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    for (let i = 0; i < PATCHES; i++) {
      const opacity = uniform(0);
      const mesh = new THREE.Mesh(disc, wetDirt(opacity));
      mesh.scale.setScalar(1e-3);
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.patches.push({ mesh, opacity, wet: 0, out: [1, 0, 0], near: 0, far: 0, y: 0, width: 1.1, gone: Infinity });
    }
  }

  /** A round struck something: into the tank's wall under the waterline, it leaves a hole that spurts. */
  shot(hit: BulletHit, rt: WorldRuntime): void {
    const { centre: c, radius: R } = this.tank;
    const [x, y, z] = hit.at;
    const r = Math.hypot(x - c[0], z - c[2]);
    // The wall's staves (not the roof, the floor or the spout; not falling), under the water
    if (hit.material !== 'stave' || hit.piece?.state === 'loose' || r < R - 0.15 || r > R + 0.05 || y < this.tank.floor || y > this.level - 0.02 || this.spilling) return;
    const out: V3 = [(x - c[0]) / r, 0, (z - c[2]) / r];
    const at: V3 = [c[0] + out[0] * R, y, c[2] + out[2] * R];
    // Water bursts back out where it went in: a puff of spray, not the dry wood's dust
    rt.effects.puff([at[0] + out[0] * 0.1, y, at[2] + out[2] * 0.1], { color: 0xe8eef0, size: 0.7, life: 1, opacity: 0.3, rise: 0.1, velocity: [out[0] * 1.2, 0.2, out[2] * 1.2] });
    if (this.holes.some((h) => Math.hypot(h.at[0] - at[0], h.at[1] - at[1], h.at[2] - at[2]) < SAME)) return;
    if (this.holes.length >= HOLES) {
      // As many as are drawn: this one in place of the highest, if it's lower
      const top = this.holes.reduce((a, b) => (b.at[1] > a.at[1] ? b : a));
      if (top.at[1] <= y) return;
      this.holes.splice(this.holes.indexOf(top), 1);
    }
    const h: Hole = { at, out, land: at, floor: 0, look: 0, patch: null, carry: 0, mist: 0 };
    this.landing(h);
    h.patch = h.floor < this.tank.deckTop - 1 ? this.patchFor(h) : null;
    this.holes.push(h);
    rt.sound.play('water.spurt', { at, volume: 0.5 + 0.5 * Math.sqrt((this.level - y) / this.full) });
  }

  update(dt: number, rt: WorldRuntime): void {
    this.time += dt;
    this.uDt.value = dt;
    this.findLights(rt.scene);
    this.uWind.value.copy(rt.effects.wind);
    const { tank } = this;
    // A tank shot through its bottom or a third of its wall, or brought down, lets what's left go. A
    // tenth of the floor gone is a round into it: a round low in the wall cuts the floor's edge by
    // it too (up to 3% of it), and that hole spurts
    this.checkIn -= dt;
    if (this.level > tank.floor + 0.05 && !this.spilling && this.checkIn <= 0) {
      this.checkIn = 0.25;
      if (this.standing(this.floorPieces) < this.bottom * 0.9 || this.standing(this.staves) < this.wall * 0.65) this.burst(rt);
    }
    if (this.spilling > 0) this.spill(dt);
    // The streams, slowing as the level falls, until it's under them
    let flow = 0;
    const mid: V3 = [0, 0, 0];
    for (const h of [...this.holes]) {
      const fall = this.level - h.at[1];
      if (fall < 0.02) {
        this.holes.splice(this.holes.indexOf(h), 1);
        continue;
      }
      this.level -= DRAIN * Math.sqrt(fall) * dt;
      const k = Math.sqrt(fall / this.full);
      if (this.time >= h.look) {
        this.landing(h);
        // Coming down somewhere else now (lower, in a crater; short, on the deck): its own patch there
        if (h.floor >= this.tank.deckTop - 1) h.patch = null;
        else if (!h.patch || h.patch.gone < Infinity || Math.abs(h.patch.y - h.floor) > 0.05) h.patch = this.patchFor(h);
      }
      this.stream(h, k, dt, rt);
      flow += k;
      for (let i = 0; i < 3; i++) mid[i] += h.land[i] * k;
    }
    // Their splashing, from among where they come down
    if (flow > 0) {
      const at: V3 = [mid[0] / flow, mid[1] / flow, mid[2] / flow];
      this.splashIn -= dt;
      if (!this.splash && this.splashIn <= 0) {
        this.splash = rt.sound.play('water.stream', { at, fadeIn: 0.3 });
        this.splashIn = 0.5;
      }
      if (this.splash) {
        this.splash.position = at;
        this.splash.setVolume(Math.min(1.2, 0.35 + 0.45 * flow), 0.25);
      }
    } else if (this.splash) {
      this.splash.stop(1.2);
      this.splash = null;
    }
    // The patches dry in the sun (a dry one, drawn for the warm-up before play, isn't drawn since),
    // and one whose ground is blown away from under it fades rather than hang over the hole
    this.groundIn -= dt;
    const look = this.groundIn <= 0;
    if (look) this.groundIn = 0.25;
    for (const p of this.patches) {
      p.mesh.visible = p.wet > 0;
      if (!p.mesh.visible) continue;
      p.wet = Math.max(0, p.wet - dt * DRY);
      if (look && p.gone === Infinity && this.undermined(p)) p.gone = this.time;
      const left = Math.min(1, (p.gone + SINK - this.time) / SINK);
      if (left <= 0) Object.assign(p, { wet: 0, gone: Infinity });
      else this.lay(p, left);
    }
    this.flush();
    const live = this.time < this.lastDeath;
    if (this.renderer && live) this.renderer.compute(this.kernel);
    this.sprite.visible = live || !this.drawn;
  }

  /** A frame of a hole's stream at `k` of a full one's strength: droplets out of the hole, a splash and spray where they come down, the ground wetted. */
  private stream(h: Hole, k: number, dt: number, rt: WorldRuntime): void {
    const v = JET * Math.sqrt(2 * G * (this.level - h.at[1]));
    const [ox, , oz] = h.out;
    h.carry += RATE * k * dt;
    const n = Math.floor(h.carry);
    h.carry -= n;
    for (let i = 0; i < n; i++) {
      // A tight jet, a little ragged; each droplet left the hole at its own moment in the frame, or
      // a frame's droplets would go in a clump
      const s = v * rand(0.97, 1.02);
      const side = v * rand(-0.018, 0.018);
      this.emit(h.at[0] + ox * 0.02, h.at[1] + rand(-0.01, 0.01), h.at[2] + oz * 0.02, ox * s - oz * side, v * rand(-0.01, 0.025), oz * s + ox * side, h.floor, ((i + Math.random()) / n) * dt);
      // Splashes thrown up where it comes down
      if (Math.random() > 0.5) continue;
      const a = rand(0, Math.PI * 2);
      const out = rand(0.3, 1.5) * (0.4 + k);
      this.emit(h.land[0] + Math.cos(a) * 0.08, h.floor + 0.02, h.land[2] + Math.sin(a) * 0.08, Math.cos(a) * out + ox * out * 0.6, rand(1, 2.6) * (0.4 + k), Math.sin(a) * out + oz * out * 0.6, h.floor, rand(0, dt));
    }
    // A little spray off it in the sun
    h.mist += dt * 4 * k;
    while (h.mist >= 1) {
      h.mist--;
      rt.effects.puff([h.land[0], h.floor + 0.15, h.land[2]], { color: 0xe8eef0, size: 0.6 + 0.5 * k, life: 1, opacity: 0.14 + 0.14 * k, rise: 0.2, velocity: [ox * 0.5, 0.5, oz * 0.5] });
    }
    const p = h.patch;
    if (!p) return;
    p.wet += k * dt;
    const along = (h.land[0] - this.tank.centre[0]) * ox + (h.land[2] - this.tank.centre[2]) * oz;
    p.near = Math.min(p.near, along);
    p.far = Math.max(p.far, along);
  }

  /** Where a hole's stream comes down now: on the deck round the tank, or past it on the ground or what lies there. */
  private landing(h: Hole): void {
    const { centre: c, deck, deckTop } = this.tank;
    const v = JET * Math.sqrt(2 * G * Math.max(0, this.level - h.at[1]));
    const out = (to: number) => v * Math.sqrt((2 * Math.max(0, h.at[1] - to)) / G);
    const at = (s: number, y: number): V3 => [h.at[0] + h.out[0] * s, y, h.at[2] + h.out[2] * s];
    let p = at(out(deckTop), deckTop);
    if (Math.abs(p[0] - c[0]) > deck || Math.abs(p[2] - c[2]) > deck) {
      p = at(out(0), 0);
      const ground = onStreet(p[0], p[2]) ? BED : 0;
      const hit = this.d.raycast([p[0], 3, p[2]], [0, -1, 0], 3 - ground);
      const y = hit ? hit.point[1] : ground;
      p = at(out(y), y);
    }
    h.land = p;
    h.floor = p[1];
    h.look = this.time + 0.25;
  }

  /** A patch for a hole's stream where it comes down now: one it comes down on already (at that height), else the driest. */
  private patchFor(h: Hole): Patch {
    const c = this.tank.centre;
    const along = (h.land[0] - c[0]) * h.out[0] + (h.land[2] - c[2]) * h.out[2];
    const lying = this.patches.filter((p) => p.gone === Infinity);
    const on = lying.find((p) => p.wet > 0 && Math.abs(p.y - h.floor) <= 0.05 && h.out[0] * p.out[0] + h.out[2] * p.out[2] > 0.97 && along > p.near - 0.5 && along < p.far + 0.5);
    if (on) return on;
    const p = (lying.length ? lying : this.patches).reduce((a, b) => (b.wet < a.wet ? b : a));
    Object.assign(p, { wet: 0, out: h.out, near: along, far: along, y: h.floor, width: 1.1, gone: Infinity });
    return p;
  }

  /** Whether the ground a patch lies on has gone from under where its stream came down (a crater blown there, a hole dug). */
  private undermined(p: Patch): boolean {
    const c = this.tank.centre;
    return [p.near, (p.near + p.far) / 2, p.far].some((s) => {
      const [x, z] = [c[0] + p.out[0] * s, c[2] + p.out[2] * s];
      const hit = this.d.raycast([x, 3, z], [0, -1, 0], 3 - BED);
      return (hit ? hit.point[1] : onStreet(x, z) ? BED : 0) < p.y - 0.05;
    });
  }

  /** A patch drawn as wet as it is (and `left` of that, fading): over where its stream has come down, a soft-edged oval along it. */
  private lay(p: Patch, left: number): void {
    const c = this.tank.centre;
    // Out to its width once soaked, drying in from the edge
    const r = p.width * Math.min(1, (0.35 + 0.3 * Math.sqrt(p.wet)) / 1.1);
    const mid = (p.near + p.far) / 2;
    p.mesh.position.set(c[0] + p.out[0] * mid, p.y + 0.005, c[2] + p.out[2] * mid);
    p.mesh.rotation.y = Math.atan2(-p.out[2], p.out[0]);
    p.mesh.scale.set((p.far - p.near) / 2 + r, 1, r);
    p.opacity.value = Math.min(0.8, p.wet * 0.25) * left;
  }

  /** Whether a piece is of the tank's wall: a stave round it, under its rim. */
  private inWall(p: Piece): boolean {
    const { centre: c, radius: R, floor, rim } = this.tank;
    const [x, y, z] = p.pose.position;
    const r = Math.hypot(x - c[0], z - c[2]);
    return p.materialName === 'stave' && r > R - 0.2 && r < R + 0.05 && y > floor && y < rim;
  }

  /** How much of the tank's wall or floor stands (m³). */
  private standing(pieces: Set<Piece>): number {
    let v = 0;
    for (const p of pieces) if (p.state === 'fixed') v += p.volume;
    return v;
  }

  /** The tank bursts: what's in it goes at once, in a sheet off its wall over the next second and a half. */
  private burst(rt: WorldRuntime): void {
    this.spilling = 1.5;
    this.holes.length = 0;
    const { centre: c } = this.tank;
    rt.sound.play('water.spurt', { at: [c[0], this.level, c[2]], volume: 1.6, pitch: 0.7 });
    // Round under it, the ground soaked
    const p = this.patches.reduce((a, b) => (b.wet < a.wet ? b : a));
    Object.assign(p, { wet: 14, out: [1, 0, 0], near: 0, far: 0, y: 0, width: 4, gone: Infinity });
  }

  /** A frame of the spill: droplets from round the wall under the level, out and down, from where the tank is now. */
  private spill(dt: number): void {
    const { centre: c, radius: R, floor } = this.tank;
    // Where what's left of the tank is: its bottom's middle, carried as it falls
    const left = this.tank.bottom.filter((p) => p.state !== 'gone');
    const mid: V3 = left.length ? (left.reduce<V3>((m, p) => [m[0] + p.pose.position[0], m[1] + p.pose.position[1], m[2] + p.pose.position[2]], [0, 0, 0]).map((v) => v / left.length) as V3) : [c[0], floor, c[2]];
    const drift = left[0]?.state === 'loose' ? (left[0].body.velocity as V3) : ([0, 0, 0] as V3);
    const depth = Math.max(0.3, this.level - floor);
    this.spillCarry += 1600 * dt * Math.min(1, depth / this.full + 0.2);
    const n = Math.floor(this.spillCarry);
    this.spillCarry -= n;
    const ground = onStreet(mid[0], mid[2]) ? BED : 0;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(1, 3.5);
      const y = mid[1] + rand(0, depth);
      this.emit(mid[0] + Math.cos(a) * R, y, mid[2] + Math.sin(a) * R, drift[0] + Math.cos(a) * s, drift[1] + rand(-0.5, 0.8), drift[2] + Math.sin(a) * s, ground, rand(0, dt));
    }
    this.spilling = Math.max(0, this.spilling - dt);
    this.level = floor + depth * (this.spilling / 1.5);
    if (this.spilling === 0) this.level = floor;
  }

  /**
   * One droplet, written into the next slot (the oldest is overwritten): from (x, y, z) at that
   * velocity, `ahead` seconds on already, going where it comes down to `floor`.
   */
  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, floor: number, ahead = 0): void {
    const i = this.head;
    if (this.pending === 0) this.start = i;
    if (this.pending < CAP) this.pending++;
    this.head = (i + 1) % CAP;
    // Down by then, from the height it starts at to the one it goes at
    const fall = Math.max(0, y - floor);
    this.lastDeath = Math.max(this.lastDeath, this.time + Math.min(LIFE, (Math.max(vy, 0) + Math.sqrt(vy * vy + 2 * G * fall)) / G + 0.1));
    const o = i * 4;
    this.p.set([x + vx * ahead, y + vy * ahead - 0.5 * G * ahead * ahead, z + vz * ahead, ahead], o);
    this.v.set([vx, vy - G * ahead, vz, floor], o);
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
      If(age.lessThan(LIFE), () => {
        const vel = vv.xyz.toVar();
        // Falling, and carried a little by the air
        vel.y.subAssign(float(G).mul(dt));
        vel.addAssign(this.uWind.sub(vel).mul(dt.mul(0.15)));
        const pos = pp.xyz.add(vel.mul(dt)).toVar();
        age.addAssign(dt);
        // Gone where it comes down (the ground, the deck, what lies there)
        If(pos.y.lessThan(vv.w), () => {
          age.assign(LIFE);
        });
        pp.assign(vec4(pos, age));
        vv.assign(vec4(vel, vv.w));
      });
    })().compute(CAP);
  }

  private material(): THREE.SpriteNodeMaterial {
    const p = storage(this.P.value, 'vec4', CAP).toReadOnly().element(instanceIndex);
    const v = storage(this.V.value, 'vec4', CAP).toReadOnly().element(instanceIndex);
    const alive = p.w.lessThan(LIFE);
    const seed = hash(instanceIndex);
    const size = mix(float(0.018), float(0.036), seed);
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
    const lit = vec3(0.8, 0.86, 0.9).mul(this.uSun.mul(float(0.8).add(glint)).add(this.uSky)).mul(1 / Math.PI);
    const depth = cameraViewMatrix.mul(vec4(p.xyz, 1)).z.negate();
    const fog = smoothstep(this.uFog.x, this.uFog.y, depth).mul(this.uFog.z);
    const q = uv().mul(2).sub(1);
    const a = smoothstep(0.2, 1, dot(q, q)).oneMinus().mul(0.6);
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

/** Wet dirt: darker and a little glossy, its edge soft and ragged; as opaque as `opacity` says. */
function wetDirt(opacity: THREE.UniformNode<'float', number>): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x46321f, roughness: 0.45, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const r = uv().mul(2).sub(1).length();
  const edge = r.add(mx_noise_float(positionWorld.xz.mul(2.2)).mul(0.22));
  m.opacityNode = smoothstep(1, 0.6, edge).mul(opacity);
  return m;
}
