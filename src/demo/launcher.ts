// The rocket launcher: a shoulder-fired tube held at the lower right of the view, a rocket's warhead
// in its muzzle (the kit in public/packs/kit, a made-up launcher and rocket; a drawn tube without
// it). Click fires: a flash at the muzzle and a back-blast behind, and the rocket leaves the tube
// and flies (speeding up, a little drop, a smoke trail) until its path meets a standing piece, the
// scenery or the ground, and goes off there. It's aimed a little high, by as much as it drops on the
// way, so it comes down where the crosshair was. Then the tube dips and the next rocket goes into
// the muzzle.
//
// The view model is drawn with the scene, lit by its sun (in the sun's shadows), its sky and its
// lights, but on a layer of its own (out of the world's AO pre-pass) and with its depth squeezed
// into the front of the depth range, so it never goes through a wall. The machine gun's (gun.ts)
// is drawn the same way; the kit has its model too. The launcher is one of the weapons
// (weapons.ts): lowered out of view while the other is in hand, its rockets flying on.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { atan, cameraProjectionMatrix, cos, float, Fn, mrt, output, positionView, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Destruction, V3 } from '../lib/index.ts';
import type { Effects } from './effects.ts';
import type { GunKit } from './gun.ts';
import type { Solids } from './player.ts';
import type { Weapon } from './weapons.ts';

export interface Blast {
  at: V3;
  normal: V3;
  /** The rocket that went off. */
  rocket: THREE.Object3D;
}

/** The launcher and its rocket (loadKit). */
export interface Kit {
  /** The launcher, in metres: its tube along -Z (the muzzle that way), +Y up, the origin on the tube's axis where it's held. */
  launcher: THREE.Object3D;
  /** The rocket: its nose along -Z, the origin on its axis halfway along. */
  rocket: THREE.Object3D;
  /** The tube's axis at the muzzle and at the rear end (the launcher's frame). */
  muzzle: V3;
  rear: V3;
  /** The rocket's length. */
  length: number;
  /** The machine gun (default: a drawn one). */
  gun?: GunKit;
}

export interface LauncherOptions {
  /** The launcher and the rocket (loadKit()); default a drawn tube and rocket. */
  kit?: Kit;
  /** The muzzle flash's light and the back-blast's smoke come from these (default none). */
  effects?: Pick<Effects, 'sparks' | 'trail' | 'dust'>;
  /** Shaken a little by each shot (the player). */
  player?: { shake: number };
  /** The scenery's fixed bodies (main.ts's): aimed at and stopped by as pieces are (default none: rockets fly through them). */
  solids?: Pick<Solids, 'raycast'>;
}

interface Rocket {
  object: THREE.Object3D;
  body: THREE.Object3D;
  flame: THREE.Object3D;
  /** Where it left from and which way it's aimed: its path is a function of its age (flight()). */
  from: THREE.Vector3;
  aim: THREE.Vector3;
  position: THREE.Vector3;
  age: number;
  /** Its size as it leaves (the view model's for the player's, else 1). */
  scale: number;
}

/**
 * The rocket's top speed, the speed it leaves the tube at, and how fast it gets from one to the
 * other once its motor lights (m/s, m/s²), IGNITE s out: till then it coasts, with no flame and no
 * smoke, clear of the player.
 */
const SPEED = 48;
const LAUNCH = 20;
const THRUST = 160;
const IGNITE = 0.08;
/** How fast it falls away from its aim (m/s²). */
const DROP = 1.5;
// How long it speeds up for, and how far it has come along its aim when it lights and at full speed
const RAMP = (SPEED - LAUNCH) / THRUST;
const COAST = LAUNCH * IGNITE;
const RAMPED = COAST + ((LAUNCH + SPEED) / 2) * RAMP;
/** Seconds between shots. */
const RELOAD = 0.75;
// After a shot (s): the muzzle flash is gone at FLASH; the tube dips from DIP to RELOAD; the next
// rocket shows SLIDE m ahead of the muzzle at SHOW and is in by SEAT
const FLASH = 0.07;
const DIP = 0.2;
const SHOW = 0.34;
const SEAT = 0.6;
const SLIDE = 0.35;
/** How much of the loaded rocket stands out of the muzzle (m). */
const OUT = 0.3;
/** Where the muzzle is held (camera space, m), and what it points at (the crosshair, some way off). */
const MUZZLE_AT = new THREE.Vector3(0.26, -0.24, -0.9);
const AIM_AT = new THREE.Vector3(0, 0, -30);
/**
 * The view model's size: at full size the near end of the tube, a hand's breadth from the eye, would
 * fill half the view. A fired rocket grows to full size as it leaves (by GROWN s), unseen.
 */
const SCALE = 0.55;
const GROWN = 0.2;
/** The view model's layer: the player's camera sees it, a camera that sees only the world (layer 0) doesn't. */
export const VIEW_LAYER = 2;
/**
 * The view model's depth is squeezed into this front part of the depth range: it's in front of
 * anything further than ~5.5 cm (with the near plane at 5 cm), and still in its own order.
 */
const DEPTH = 0.1;
const FORWARD = new THREE.Vector3(0, 0, -1);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

const squeezed = Fn(() => {
  const p = cameraProjectionMatrix.mul(positionView);
  return vec4(p.xy, p.z.mul(DEPTH), p.w);
})();
// With reflections on, the beauty pass also writes how much each pixel reflects (main.ts): the view
// model reflects nothing (its depth isn't where it is)
const noShine = mrt({ output, shine: vec2(0, 1) });
/** How far a weapon lowered out of view goes down (m), and how far its muzzle tips down (rad). */
export const LOWER = { drop: 0.32, tip: 0.65 };
/** The lowered weapon's pose: 0 (in hand) to 1 (out of view), eased. */
export const lowering = (lowered: number) => lowered * lowered * (3 - 2 * lowered);

/** The view model's surfaces: a standard material's maps, depth squeezed, none of the world's screen-space AO. */
class ViewMaterial extends THREE.MeshStandardNodeMaterial {
  constructor(from: THREE.MeshStandardMaterial) {
    super();
    const { color, map, normalMap, normalScale, roughness, roughnessMap, metalness, metalnessMap, aoMap, aoMapIntensity, emissive, emissiveMap, emissiveIntensity, side } = from;
    this.setValues({ color, map, normalMap, normalScale, roughness, roughnessMap, metalness, metalnessMap, aoMap, aoMapIntensity, emissive, emissiveMap, emissiveIntensity, side });
    this.vertexNode = squeezed;
    this.mrtNode = noShine;
  }

  // The pass's AO comes from a pre-pass that doesn't see the view model (there, it's the world's
  // behind): leave it out, keep the model's own
  override setupAmbientOcclusion(builder: THREE.NodeBuilder): THREE.Node {
    const context = builder.context as { getAO?: unknown };
    const getAO = context.getAO;
    delete context.getAO;
    const ao = super.setupAmbientOcclusion(builder);
    context.getAO = getAO;
    return ao;
  }
}

export class Launcher implements Weapon {
  readonly name = 'launcher';
  /** The view model (a child of the camera): the launcher and the rocket in it. */
  readonly view = new THREE.Group();
  /** How far it's lowered out of view (Weapons sets it while switching): 0 in hand, 1 out of view. */
  lowered = 0;
  onBlast: (b: Blast) => void = () => {};
  /** A rocket leaves the tube (from the player's launcher: `fired`; else scripted). */
  onLaunch: (rocket: THREE.Object3D, fired: boolean) => void = () => {};
  /** Each frame of each rocket's flight: where its nozzle is, and its velocity. */
  onTrail: (at: V3, velocity: V3) => void = () => {};
  private readonly kit: Kit;
  private readonly loaded: THREE.Object3D;
  private readonly flash = new THREE.Group();
  private readonly star: THREE.Object3D;
  private readonly glow = uniform(0);
  private flashTurn = 0;
  private readonly rockets: Rocket[] = [];
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly destruction: Destruction;
  private readonly ground: (x: number, z: number) => number;
  private readonly solids: Pick<Solids, 'raycast'> | null;
  private readonly effects: LauncherOptions['effects'];
  private readonly player: LauncherOptions['player'];
  // The view model at rest (camera space), and where the loaded rocket sits in it
  private readonly rest = new THREE.Vector3();
  private readonly aim = new THREE.Quaternion();
  private readonly seat = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  /** Seconds since the last shot. */
  private shot = Infinity;
  private time = 0;
  /** Rockets still to fire, one per reload (burst). */
  private queued = 0;
  // Footfalls kick a spring (the view dips and sways, one side then the other)
  private readonly bob = new THREE.Vector2();
  private readonly bobVelocity = new THREE.Vector2();
  private side = 1;
  // The tube lags a little behind the view as it turns
  private readonly lag = new THREE.Vector2();
  private readonly lastLook = new THREE.Quaternion();
  // A speck of a rocket, flame lit, at the muzzle for the first frames: its shaders are made while
  // the world loads, not at the first shot
  private warm: THREE.Object3D | null;

  /** `ground`: the ground's height at (x, z), where a rocket that hits nothing else goes off. */
  constructor(scene: THREE.Scene, camera: THREE.Camera, destruction: Destruction, ground: (x: number, z: number) => number, options: LauncherOptions = {}) {
    this.ground = ground;
    this.scene = scene;
    this.camera = camera;
    this.destruction = destruction;
    this.solids = options.solids ?? null;
    this.effects = options.effects;
    this.player = options.player;
    const kit = (this.kit = options.kit ?? drawnKit());
    const muzzle = new THREE.Vector3(...kit.muzzle);
    this.axis.copy(muzzle).sub(new THREE.Vector3(...kit.rear)).normalize();
    // Held so the muzzle is at MUZZLE_AT, the tube pointing at the crosshair some way off
    this.aim.setFromUnitVectors(FORWARD, AIM_AT.clone().sub(MUZZLE_AT).normalize()).multiply(new THREE.Quaternion().setFromUnitVectors(this.axis, FORWARD));
    this.rest.copy(MUZZLE_AT).sub(muzzle.clone().multiplyScalar(SCALE).applyQuaternion(this.aim));
    this.view.scale.setScalar(SCALE);
    this.view.add(viewModel(kit.launcher));
    // The rocket in the muzzle, its warhead out
    this.loaded = viewModel(kit.rocket);
    this.loaded.quaternion.setFromUnitVectors(FORWARD, this.axis);
    this.seat.copy(muzzle).addScaledVector(this.axis, OUT - kit.length / 2);
    this.loaded.position.copy(this.seat);
    this.view.add(this.loaded);
    // The muzzle flash: a star facing the eye, and a plume out of the muzzle
    this.star = flashMesh(new THREE.PlaneGeometry(0.42, 0.42), starShape(this.glow));
    this.flash.add(this.star);
    for (const turn of [0, Math.PI / 2]) {
      const plume = flashMesh(new THREE.PlaneGeometry(0.2, 0.6).rotateX(-Math.PI / 2).translate(0, 0, -0.3), plumeShape(this.glow));
      plume.quaternion.setFromUnitVectors(FORWARD, this.axis).multiply(new THREE.Quaternion().setFromAxisAngle(FORWARD, turn));
      this.flash.add(plume);
    }
    // Drawn (black) while the speck warms up too, so its shaders are ready for the first shot; after
    // that only while it shows: even black it writes the pass's other outputs (Harbor's reflections)
    this.flash.position.copy(muzzle);
    this.view.add(this.flash);
    this.view.traverse((o) => o.layers.set(VIEW_LAYER));
    camera.layers.enable(VIEW_LAYER);
    camera.add(this.view);
    const speck = this.rocket();
    speck.flame.visible = true;
    this.warm = speck.object;
    this.warm.scale.setScalar(1e-3);
    this.warm.position.copy(MUZZLE_AT);
    camera.add(this.warm);
    this.lastLook.copy(camera.quaternion);
    this.pose(0, 0);
  }

  fire(): boolean {
    if (this.shot < RELOAD) return false;
    this.shot = 0;
    this.view.updateWorldMatrix(true, false);
    const eye = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = FORWARD.clone().applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    const muzzle = this.view.localToWorld(new THREE.Vector3(...this.kit.muzzle));
    const along = this.axis.clone().transformDirection(this.view.matrixWorld);
    // The back end as if the tube were full size: behind the shoulder
    const rear = muzzle.clone().addScaledVector(along, -new THREE.Vector3(...this.kit.muzzle).distanceTo(new THREE.Vector3(...this.kit.rear)));
    // From the loaded rocket, aimed where the crosshair points (a piece, the scenery or the ground, else far off)
    const from = this.view.localToWorld(this.seat.clone());
    const aim = this.firstHit(eye, dir, 300);
    const target = aim ? new THREE.Vector3(...aim.at) : eye.clone().addScaledVector(dir, 200);
    const rocket = this.launch(from, target, SCALE);
    this.loaded.visible = false;
    this.flashTurn = Math.random() * Math.PI * 2;
    // The flash (a light, a few sparks), the back-blast (a jet of smoke and a cloud behind), a jolt
    this.effects?.sparks(muzzle.clone().addScaledVector(along, 0.1).toArray() as V3, along.toArray() as V3, 0.12, 0xffb45a);
    this.effects?.trail(rear.toArray() as V3, along.clone().multiplyScalar(150).toArray() as V3);
    this.effects?.dust(rear.clone().addScaledVector(along, -2).toArray() as V3, 0.3, 0x8f8c87);
    if (this.player) this.player.shake = Math.max(this.player.shake, 0.45);
    this.onLaunch(rocket.object, true);
    // Up against a wall (it's between the eye and the muzzle): it goes off there
    const reach = muzzle.clone().sub(eye);
    const blocked = this.firstHit(eye, reach.clone().normalize(), reach.length());
    if (blocked) this.explode(this.rockets.length - 1, { at: blocked.at, normal: blocked.normal, rocket: rocket.object });
    return true;
  }

  /** Fire from a point at a target (scripted): the rocket goes off there, unless something's in the way. */
  fireFrom(from: THREE.Vector3, to: THREE.Vector3): void {
    this.onLaunch(this.launch(from.clone(), to, 1).object, false);
  }

  /** The trigger: a rocket each time it's pressed (once reloaded). */
  trigger(down: boolean): void {
    if (down && this.lowered === 0) this.fire();
  }

  /** Fire `n` rockets, one each time it has reloaded. */
  burst(n: number): void {
    this.queued = n;
  }

  /** A foot came down (or the player landed) at `speed` m/s: the launcher dips with it. */
  footfall(speed: number): void {
    const k = Math.min(1.5, speed / 4);
    this.bobVelocity.y -= 0.24 * k;
    this.bobVelocity.x += 0.06 * k * this.side;
    this.side = -this.side;
  }

  update(dt: number, moving: number): void {
    this.shot += dt;
    this.time += dt;
    if (this.warm && this.time > 0.5) {
      this.warm.removeFromParent();
      this.warm = null;
    }
    if (this.queued > 0 && this.lowered === 0 && this.fire()) this.queued--;
    this.pose(dt, moving);
    if (dt <= 0) return;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.age += dt;
      const lit = r.age > IGNITE;
      // Where it is now: along its aim, below it by its drop; what it met on the way there
      const { speed, reach } = flight(r.age);
      const next = r.from.clone().addScaledVector(r.aim, reach);
      next.y -= (DROP / 2) * r.age ** 2;
      const velocity = r.aim.clone().multiplyScalar(speed);
      velocity.y -= DROP * r.age;
      const dir = velocity.clone().normalize();
      const step = next.clone().sub(r.position);
      const hit = this.firstHit(r.position, step.clone().normalize(), step.length());
      if (hit) this.explode(i, { at: hit.at, normal: hit.normal, rocket: r.object });
      else if (r.age > 6) this.explode(i, { at: next.toArray() as V3, normal: [0, 1, 0], rocket: r.object });
      else {
        r.position.copy(next);
        r.object.position.copy(next);
        r.object.quaternion.setFromUnitVectors(FORWARD, dir);
        r.object.scale.setScalar(r.scale + (1 - r.scale) * Math.min(1, r.age / GROWN));
        // It spins slowly about its axis; the flame flickers
        r.body.rotation.z += dt * 9;
        r.flame.visible = lit;
        r.flame.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 0.6 + Math.random() * 0.8);
        const nozzle = next.clone().addScaledVector(dir, (-this.kit.length / 2) * r.object.scale.z);
        if (lit) this.onTrail(nozzle.toArray() as V3, velocity.toArray() as V3);
      }
    }
  }

  /** A rocket in flight: the model (spinning) and its flame (once lit). */
  private rocket(): { object: THREE.Object3D; body: THREE.Object3D; flame: THREE.Object3D } {
    const object = new THREE.Group();
    const body = this.kit.rocket.clone();
    const flame = new THREE.Mesh(FLAME, flameMaterial());
    flame.position.z = this.kit.length / 2;
    flame.visible = false;
    object.add(body, flame);
    return { object, body, flame };
  }

  /** A rocket from `from` at `to`, `scale` its size: aimed above `to` by as much as it will have dropped by then. */
  private launch(from: THREE.Vector3, to: THREE.Vector3, scale: number): Rocket {
    const way = to.clone().sub(from);
    // The drop depends on the time, the time on the length of the raised path: a few rounds settle it
    const aim = way.clone();
    for (let k = 0; k < 3; k++) aim.y = way.y + (DROP / 2) * flightTime(aim.length()) ** 2;
    aim.normalize();
    const { object, body, flame } = this.rocket();
    object.position.copy(from);
    object.quaternion.setFromUnitVectors(FORWARD, aim);
    object.scale.setScalar(scale);
    this.scene.add(object);
    const rocket = { object, body, flame, from: from.clone(), aim, position: from.clone(), age: 0, scale };
    this.rockets.push(rocket);
    return rocket;
  }

  /** The first thing a ray meets within `max` m: a piece, the scenery (what it starts inside doesn't count) or the ground. */
  private firstHit(from: THREE.Vector3, dir: THREE.Vector3, max: number): { at: V3; normal: V3; distance: number } | null {
    const o = from.toArray() as V3;
    const d = dir.toArray() as V3;
    let first: { at: V3; normal: V3; distance: number } | null = null;
    const solid = this.solids?.raycast(o, d, max);
    if (solid && solid.distance > 0) first = { at: solid.point, normal: solid.normal, distance: solid.distance };
    const ground = groundHit(this.ground, from, dir, first ? first.distance : max);
    if (ground) first = { at: ground.toArray() as V3, normal: [0, 1, 0], distance: ground.distanceTo(from) };
    // A piece as near or nearer: what's dormant on the way is woken first, and met as its pieces
    const piece = this.destruction.wakeAlong(o, d, first ? first.distance + 0.05 : max);
    if (piece && (!first || piece.distance <= first.distance + 0.05)) first = { at: piece.point, normal: piece.normal, distance: piece.distance };
    return first;
  }

  private explode(i: number, blast: Blast): void {
    blast.rocket.removeFromParent();
    this.rockets.splice(i, 1);
    this.onBlast(blast);
  }

  /** Where the view model is this frame: at rest, plus the kick, the reload, the footfalls, the sway. */
  private pose(dt: number, moving: number): void {
    const t = this.shot;
    // The kick: back and up at once, then settling
    const kick = Math.exp(-t * 16);
    // The reload: the tube dips and swings in, side on (the rocket going in is seen), and comes back up
    const s = Math.min(1, Math.max(0, (t - DIP) / (RELOAD - DIP)));
    const dip = Math.sin(Math.PI * s) ** 2;
    // Footfalls: a damped spring
    this.bobVelocity.addScaledVector(this.bob, -170 * dt).multiplyScalar(Math.exp(-13 * dt));
    this.bob.addScaledVector(this.bobVelocity, dt);
    // The lag: this frame's turn (camera frame), the tube turned a little the other way
    const turn = this.lastLook.invert().multiply(this.camera.quaternion);
    const rate = dt > 0 ? 2 / dt : 0;
    const clamp = (x: number) => Math.max(-0.06, Math.min(0.06, x));
    const blend = Math.min(1, dt * 12);
    this.lag.x += (clamp(-turn.x * rate * 0.012) - this.lag.x) * blend;
    this.lag.y += (clamp(-turn.y * rate * 0.012) - this.lag.y) * blend;
    this.lastLook.copy(this.camera.quaternion);
    // Breathing, and a little lower while walking
    const b = this.time;
    const swayX = Math.sin(b * 1.1) * 0.0025 + Math.sin(b * 0.37) * 0.0015;
    const swayY = Math.sin(b * 1.6) * 0.002 - 0.008 * moving;
    // Lowered out of view while the other weapon is in hand (drawn for the first frames all the
    // same, below the view: its shaders are made at load)
    const low = lowering(this.lowered);
    this.view.visible = this.lowered < 1 || this.time < 0.5;
    this.view.position.set(this.rest.x + swayX + this.bob.x - 0.03 * dip + 0.04 * low, this.rest.y + swayY + this.bob.y + 0.012 * kick - 0.06 * dip - LOWER.drop * low, this.rest.z + 0.075 * kick + 0.03 * dip);
    const pitch = 0.11 * kick - 0.12 * dip + this.lag.x + Math.sin(b * 0.8) * 0.004 + this.bob.y * 1.5 - LOWER.tip * low;
    const yaw = 0.32 * dip + this.lag.y + Math.sin(b * 1.2) * 0.004;
    const roll = 0.35 * dip + this.bob.x * 1.5 + 0.25 * low;
    this.view.quaternion.copy(this.aim).multiply(_q.setFromEuler(_e.set(pitch, yaw, roll)));
    // The next rocket: in the muzzle when loaded; just fired, none; then it slides in
    this.loaded.visible = t >= SHOW;
    const sliding = Math.min(1, Math.max(0, (t - SHOW) / (SEAT - SHOW)));
    this.loaded.position.copy(this.seat).addScaledVector(this.axis, SLIDE * (1 - sliding) ** 3);
    // The flash: brief, each one turned its own way, the star facing the eye
    this.glow.value = Math.max(0, 1 - t / FLASH);
    this.flash.visible = this.glow.value > 0 || this.warm !== null;
    this.star.quaternion.copy(this.view.quaternion).invert().multiply(_q.setFromAxisAngle(FORWARD, this.flashTurn));
  }

}

/** A part of a muzzle flash in the view: glowing (added in), its depth squeezed as the view model's, drawn last. */
export function flashMesh(geometry: THREE.BufferGeometry, colour: THREE.Node<'vec3'>): THREE.Mesh {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  m.colorNode = colour;
  m.vertexNode = squeezed;
  m.mrtNode = noShine;
  const mesh = new THREE.Mesh(geometry, m);
  mesh.renderOrder = 2000;
  return mesh;
}

/** Where a ray first meets the ground (`ground`: its height at x, z) within `range` m (to a centimetre or so, on it), or null. */
export function groundHit(ground: (x: number, z: number) => number, from: THREE.Vector3, dir: THREE.Vector3, range: number): THREE.Vector3 | null {
  const below = (t: number) => {
    const p = from.clone().addScaledVector(dir, t);
    return p.y <= ground(p.x, p.z);
  };
  for (let t = 0.5; t < range + 0.5; t += 0.5) {
    if (!below(Math.min(t, range))) continue;
    let a = t - 0.5;
    let b = Math.min(t, range);
    for (let k = 0; k < 6; k++) {
      const m = (a + b) / 2;
      if (below(m)) b = m;
      else a = m;
    }
    const p = from.clone().addScaledVector(dir, b);
    p.y = ground(p.x, p.z);
    return p;
  }
  return null;
}

/** How fast a rocket goes `t` s after it leaves (m/s), and how far it has come along its aim (m). */
function flight(t: number): { speed: number; reach: number } {
  if (t <= IGNITE) return { speed: LAUNCH, reach: LAUNCH * t };
  const burn = Math.min(t - IGNITE, RAMP);
  const speed = LAUNCH + THRUST * burn;
  return { speed, reach: COAST + ((LAUNCH + speed) / 2) * burn + SPEED * (t - IGNITE - burn) };
}

/** How long a rocket takes to come `d` m along its aim (flight's reach, the other way). */
function flightTime(d: number): number {
  if (d <= COAST) return d / LAUNCH;
  if (d >= RAMPED) return IGNITE + RAMP + (d - RAMPED) / SPEED;
  return IGNITE + (Math.sqrt(LAUNCH * LAUNCH + 2 * THRUST * (d - COAST)) - LAUNCH) / THRUST;
}

/**
 * Load the kit from `base` (default 'packs/kit/models/': index.json, launcher.glb, rocket.glb and
 * gun.glb; made by scripts/assets/packs/kit). Without the gun's (not listed, or it fails to load)
 * the kit has none: the gun is drawn.
 */
export async function loadKit(base = 'packs/kit/models/'): Promise<Kit> {
  const r = await fetch(`${base}index.json`);
  if (!r.ok) throw new Error(`loadKit: ${base}index.json: ${r.status}`);
  const index = (await r.json()) as { launcher: { file: string; muzzle: V3; rear: V3 }; rocket: { file: string; size: V3 }; gun?: { file: string; muzzle: V3; eject: V3 } };
  const loader = new GLTFLoader();
  const gun = index.gun;
  const [launcher, rocket, gunModel] = await Promise.all([
    loader.loadAsync(base + index.launcher.file),
    loader.loadAsync(base + index.rocket.file),
    gun ? loader.loadAsync(base + gun.file).catch((e) => void console.warn('No gun model:', e.message)) : undefined,
  ]);
  for (const o of [launcher.scene, rocket.scene, gunModel?.scene]) o?.traverse((m) => (m.castShadow = m.receiveShadow = (m as THREE.Mesh).isMesh === true));
  return {
    launcher: launcher.scene,
    rocket: rocket.scene,
    muzzle: index.launcher.muzzle,
    rear: index.launcher.rear,
    length: index.rocket.size[2],
    gun: gun && gunModel ? { model: gunModel.scene, muzzle: gun.muzzle, eject: gun.eject } : undefined,
  };
}

/** A copy of a model for the view: view materials, in the sun's shadows but casting none. */
export function viewModel(model: THREE.Object3D): THREE.Object3D {
  const copy = model.clone();
  const made = new Map<THREE.Material, THREE.Material>();
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const from = mesh.material as THREE.MeshStandardMaterial;
    if (!made.has(from)) made.set(from, new ViewMaterial(from));
    mesh.material = made.get(from)!;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  });
  return copy;
}

const FIRE = vec3(9, 4.4, 1.5);

/** A six-pointed star of flame, bright in the middle. */
export function starShape(glow: THREE.Node<'float'>): THREE.Node<'vec3'> {
  return Fn(() => {
    const p = uv().sub(0.5).mul(2);
    const r = p.length();
    const spikes = cos(atan(p.y, p.x).mul(3)).abs().pow(6);
    const core = float(1).sub(r.mul(1.6)).max(0).pow(2);
    const rays = float(1).sub(r.div(spikes.mul(0.75).add(0.25))).max(0).pow(2).mul(0.6);
    return FIRE.mul(core.add(rays).mul(glow));
  })();
}

/** A tongue of flame along the plane's length (uv.y 0 at the muzzle), narrowing. */
export function plumeShape(glow: THREE.Node<'float'>): THREE.Node<'vec3'> {
  return Fn(() => {
    const across = uv().x.sub(0.5).abs().mul(2);
    const along = uv().y;
    const width = float(1).sub(along).mul(0.8).add(0.2);
    const shape = float(1).sub(across.div(width)).max(0).pow(2).mul(float(1).sub(along).pow(1.5));
    return FIRE.mul(shape.mul(glow).mul(0.8));
  })();
}

// The rocket's flame: a white-hot cone out of the nozzle (the trail's glow and smoke do the rest)
const FLAME = new THREE.ConeGeometry(0.028, 0.32, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.16);
let flame: THREE.Material | null = null;
function flameMaterial(): THREE.Material {
  return (flame ??= new THREE.MeshBasicNodeMaterial({ color: new THREE.Color().setRGB(10, 6, 2.6), side: THREE.DoubleSide }));
}

/** The drawn launcher and rocket (without the kit): a dark tube with a flared back, a green-tipped rocket. */
function drawnKit(): Kit {
  const body = new THREE.MeshStandardNodeMaterial({ color: 0x16202d, roughness: 0.7, metalness: 0.05 });
  const dark = new THREE.MeshStandardNodeMaterial({ color: 0x161b22, roughness: 0.6, metalness: 0.15 });
  const tube = (r: number, l: number, m: THREE.Material, z: number) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 28).rotateX(Math.PI / 2), m);
    mesh.position.z = z;
    return mesh;
  };
  const launcher = new THREE.Group();
  launcher.add(tube(0.085, 1.15, body, 0), tube(0.1, 0.16, dark, -0.5), tube(0.1, 0.2, dark, 0.45));
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.22, 28, 1, true).rotateX(Math.PI / 2), dark);
  flare.position.z = 0.65;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), dark);
  grip.position.set(0, -0.14, 0.12);
  grip.rotation.x = 0.25;
  const fore = grip.clone();
  fore.position.z = -0.22;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.16), dark);
  sight.position.set(-0.06, 0.11, -0.12);
  launcher.add(flare, grip, fore, sight);

  const rocket = new THREE.Group();
  const green = new THREE.MeshStandardNodeMaterial({ color: 0x5f8f4e, roughness: 0.5, metalness: 0.2 });
  const grey = new THREE.MeshStandardNodeMaterial({ color: 0x5a6068, roughness: 0.5, metalness: 0.5 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.075, 0.2, 20).rotateX(-Math.PI / 2), green);
  head.position.z = -0.25;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 20).rotateX(Math.PI / 2), green);
  neck.position.z = -0.09;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 12).rotateX(Math.PI / 2), grey);
  motor.position.z = 0.15;
  rocket.add(head, neck, motor);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.07, 0.1), grey);
    fin.position.set(Math.cos((k * Math.PI) / 2) * 0.05, Math.sin((k * Math.PI) / 2) * 0.05, 0.3);
    fin.rotation.z = (k * Math.PI) / 2;
    rocket.add(fin);
  }
  return { launcher, rocket, muzzle: [0, 0, -0.58], rear: [0, 0, 0.76], length: 0.7 };
}
