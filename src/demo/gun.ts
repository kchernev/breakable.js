// The machine gun: held at the lower right of the view like the launcher (the kit's model, a made-up
// light machine gun; a drawn one without it), firing while the trigger is held, 14 rounds a second
// for as long as it's held: it never runs dry and never reloads. Each round is a heavy bullet along
// the crosshair (Destruction.shoot at POWER for the pieces: most break at the first, each blowing
// a hole a little wider than itself; the scenery and the ground stop it too), off by a spread that
// opens through a burst and closes again when it stops. Each shot flashes at the muzzle, puffs a
// little smoke, throws a casing out of the ejection port to tumble and bounce at the player's feet,
// kicks the gun back and the view up (both settle), and every other one is a tracer.

import { uniform } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type Destruction, type Ground, type MaterialKind, materialKind, type Piece, type V3 } from '../lib/index.ts';
import type { Effects } from './effects.ts';
import { flashMesh, groundHit, LOWER, lowering, plumeShape, starShape, VIEW_LAYER, viewModel } from './launcher.ts';
import type { Solids } from './player.ts';
import type { Weapon } from './weapons.ts';

/** The gun's model (loadKit: public/packs/kit/models/gun.glb, with its points in index.json). */
export interface GunKit {
  /** Its barrel along -Z (the muzzle that way), +Y up, in metres, the origin on the barrel's axis where it's held. */
  model: THREE.Object3D;
  /** The muzzle and the ejection port (the model's frame). */
  muzzle: V3;
  eject: V3;
}

export interface GunOptions {
  /** The model (loadKit's kit.gun); default a drawn one. */
  kit?: GunKit;
  /** The muzzle's light and smoke, the casings and the tracers (default none). */
  effects?: Pick<Effects, 'muzzle' | 'casing' | 'tracer'>;
  /** Shaken a little by each shot (default none). */
  player?: { shake: number };
  /** The scenery's fixed bodies: they stop bullets (default none). */
  solids?: Pick<Solids, 'raycast'>;
  /** What kind each material is (default materialKind of its name and material). */
  kindOf?: (material: string) => MaterialKind;
  /**
   * What the world's own ground is where a bullet strikes it (default stone). Down in a pit through
   * a breakable ground (its floor, and its sides where it meets the scenery) a bullet strikes what
   * the ground is made of there.
   */
  ground?: (x: number, y: number, z: number) => MaterialKind;
  /**
   * What a pit's side is where the scenery there isn't drawn as the ground's layers: a material,
   * null for the scenery's stone, nothing for the layer at that height (the default).
   */
  pitSide?: (at: V3, ground: Ground) => string | null | undefined;
  /** Where the ground is water (or anything a bullet just goes into: nothing to see or hear). Default nowhere. */
  water?: (x: number, z: number) => boolean;
}

/** What a bullet struck. */
export interface BulletHit {
  at: V3;
  normal: V3;
  /** Its way, and how far it came. */
  direction: V3;
  distance: number;
  /**
   * The piece (null: the scenery or the ground), its material (or, down in a pit through a
   * breakable ground, what the ground is made of there), and what kind of thing it is.
   */
  piece: Piece | null;
  material: string | null;
  kind: MaterialKind;
  /** The piece gave way (it breaks there). */
  broke: boolean;
}

/** A round as it flies: from the eye along its way, as far as what it struck (the gun's range if nothing). */
export interface Round {
  from: V3;
  direction: V3;
  /** How far it went (m). */
  reach: number;
}

/** A burst of the gun, once it has ended. */
export interface Burst {
  /** Rounds fired. */
  rounds: number;
  /** Where most of them struck: the middle of their strikes, each axis apart (null: none struck anything). */
  at: V3 | null;
  /** How long it lasted (s), from the first round until the trigger was let go. */
  seconds: number;
}

/** Rounds a second. */
const RATE = 14;
/**
 * How far a bullet goes (m), and how hard it strikes (Destruction.shoot's power: a brick, a board
 * or a pane goes at the first, a big concrete block in a handful, a steel plate in a few dozen, and
 * each that gives way takes the pieces right around it too).
 */
const RANGE = 400;
const POWER = 6;
/**
 * The spread (radians off the crosshair, at most): the first round's, what each round adds, the
 * most, and how fast it closes (1/s) firing and not; more while moving.
 */
const SPREAD = { first: 0.0025, grow: 0.0035, most: 0.03, firing: 1.5, settle: 5, moving: 0.012 };
/** The view's climb a round (radians up, and at most aside), and how fast it settles (1/s) firing and not. */
const CLIMB = { up: 0.0055, aside: 0.002, firing: 3, settle: 7 };
/** A tracer every this many rounds. */
const TRACER = 2;
/** The muzzle flash's time (s). */
const FLASH = 0.045;
/** How near a breakable ground's area (m) the scenery is the side of a pit through it. */
const EDGE = 0.05;
/** Where the muzzle is held (camera space, m) and what it points at; the model's size in view. */
const MUZZLE_AT = new THREE.Vector3(0.19, -0.2, -0.76);
const AIM_AT = new THREE.Vector3(0, 0, -30);
const SCALE = 0.66;
const FORWARD = new THREE.Vector3(0, 0, -1);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Gun implements Weapon {
  readonly name = 'gun';
  readonly automatic = true;
  /** The view model (a child of the camera). */
  readonly view = new THREE.Group();
  lowered = 0;
  /** Each round fired. */
  onShot: () => void = () => {};
  /** Each round as it flies, before what it struck (for what's in the air on its way: a bird). */
  onRound: (round: Round) => void = () => {};
  /** Each bullet that struck something (nothing for the sky or the water). */
  onHit: (hit: BulletHit) => void = () => {};
  /** A burst ended (the trigger let go, or the gun put away). */
  onBurstEnd: (burst: Burst) => void = () => {};
  /** A casing will land at `at` in `delay` s (now and then: one in three or so). */
  onCasing: (at: V3, delay: number) => void = () => {};
  private readonly camera: THREE.Camera;
  private readonly destruction: Destruction;
  private readonly ground: (x: number, z: number) => number;
  private readonly options: GunOptions;
  private readonly kinds = new Map<string, MaterialKind>();
  private readonly model: THREE.Object3D;
  private readonly muzzle: THREE.Vector3;
  private readonly eject: THREE.Vector3;
  private readonly rest = new THREE.Vector3();
  private readonly aim = new THREE.Quaternion();
  private readonly flash = new THREE.Group();
  private readonly star: THREE.Object3D;
  private readonly glow = uniform(0);
  private flashTurn = 0;
  private held = false;
  /** Rounds still to fire of a scripted burst. */
  private queued = 0;
  /** Seconds until the next round may go (never banked while the trigger is up). */
  private wait = 0;
  /** Rounds in this burst, and all told (for the tracers); when the burst began, and where its rounds struck. */
  private burstRounds = 0;
  private fired = 0;
  private burstStart = 0;
  private readonly strikes: V3[] = [];
  private spread = SPREAD.first;
  /** The view's climb (radians up and aside) laid over where the player looks. */
  private readonly climb = new THREE.Vector2();
  /** Seconds since the last round. */
  private since = Infinity;
  private time = 0;
  // Footfalls kick a spring, the gun lags the view a little as it turns (as the launcher's)
  private readonly bob = new THREE.Vector2();
  private readonly bobVelocity = new THREE.Vector2();
  private side = 1;
  private readonly lag = new THREE.Vector2();
  private readonly lastLook = new THREE.Quaternion();

  /** `ground`: the ground's height at (x, z), where a bullet that meets nothing else strikes. */
  constructor(camera: THREE.Camera, destruction: Destruction, ground: (x: number, z: number) => number, options: GunOptions = {}) {
    this.camera = camera;
    this.destruction = destruction;
    this.ground = ground;
    this.options = options;
    const kit = options.kit ?? drawnGun();
    this.muzzle = new THREE.Vector3(...kit.muzzle);
    this.eject = new THREE.Vector3(...kit.eject);
    this.model = viewModel(kit.model);
    this.view.add(this.model);
    // Held so the muzzle is at MUZZLE_AT, pointing at the crosshair some way off
    this.aim.setFromUnitVectors(FORWARD, AIM_AT.clone().sub(MUZZLE_AT).normalize());
    this.rest.copy(MUZZLE_AT).sub(this.muzzle.clone().multiplyScalar(SCALE).applyQuaternion(this.aim));
    this.view.scale.setScalar(SCALE);
    // The muzzle flash: a star facing the eye and a short plume, each round turned its own way
    this.star = flashMesh(new THREE.PlaneGeometry(0.2, 0.2), starShape(this.glow));
    this.flash.add(this.star);
    for (const turn of [0, Math.PI / 2]) {
      const plume = flashMesh(new THREE.PlaneGeometry(0.09, 0.26).rotateX(-Math.PI / 2).translate(0, 0, -0.13), plumeShape(this.glow));
      plume.quaternion.setFromAxisAngle(FORWARD, turn);
      this.flash.add(plume);
    }
    this.flash.position.copy(this.muzzle);
    this.view.add(this.flash);
    this.view.traverse((o) => o.layers.set(VIEW_LAYER));
    camera.layers.enable(VIEW_LAYER);
    camera.add(this.view);
    this.lastLook.copy(camera.quaternion);
    this.pose(0, 0);
  }

  trigger(down: boolean): void {
    this.held = down && this.lowered === 0;
  }

  burst(n: number): void {
    this.queued = n;
  }

  footfall(speed: number): void {
    const k = Math.min(1.5, speed / 4);
    this.bobVelocity.y -= 0.22 * k;
    this.bobVelocity.x += 0.06 * k * this.side;
    this.side = -this.side;
  }

  update(dt: number, moving: number): void {
    this.time += dt;
    this.since += dt;
    // Down out of view: the trigger let go (a scripted burst waits for it to come up: Weapons
    // cancels it when it's put away)
    if (this.lowered > 0) this.held = false;
    // The spread closes and the view settles back (slowly while it fires: they build up through a
    // burst); the climb is laid over where the player looks (the camera as the player set it)
    const firing = (this.held || this.queued > 0) && this.lowered === 0;
    this.spread += (SPREAD.first + SPREAD.moving * moving - this.spread) * (1 - Math.exp(-(firing ? SPREAD.firing : SPREAD.settle) * dt));
    this.climb.multiplyScalar(Math.exp(-(firing ? CLIMB.firing : CLIMB.settle) * dt));
    this.turn(this.climb.x, this.climb.y);
    // The rounds due this frame, at the rate (none banked while the trigger was up)
    this.wait -= dt;
    if (firing) {
      while (this.wait <= 0 && (this.held || this.queued > 0)) {
        this.shoot(moving);
        if (this.queued > 0) this.queued--;
        this.wait += 1 / RATE;
      }
    } else if (this.burstRounds > 0) this.endBurst();
    if (this.wait < 0) this.wait = 0;
    this.pose(dt, moving);
  }

  /** One round: the bullet along the crosshair (off by the spread), the flash, the casing, the kick. */
  private shoot(moving: number): void {
    if (this.burstRounds++ === 0) this.burstStart = this.time;
    this.fired++;
    this.since = 0;
    const eye = this.camera.getWorldPosition(new THREE.Vector3());
    const look = this.camera.getWorldQuaternion(new THREE.Quaternion());
    // Off the crosshair by up to the spread, anywhere round it
    const r = this.spread * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -1).normalize().applyQuaternion(look);
    const hit = this.trace(eye, dir);
    this.spread = Math.min(SPREAD.most + SPREAD.moving * moving, this.spread + SPREAD.grow);
    // The muzzle and the port where they are in the world
    this.view.updateWorldMatrix(true, false);
    const muzzle = this.view.localToWorld(this.muzzle.clone()).toArray() as V3;
    const fx = this.options.effects;
    fx?.muzzle(muzzle, dir.toArray() as V3);
    if (this.fired % TRACER === 0) fx?.tracer(muzzle, hit?.at ?? (eye.clone().addScaledVector(dir, RANGE).toArray() as V3));
    // The casing: out of the port to the right, up and a little back, tumbling down beside the
    // feet onto what's there (the ground, a floor, a breakable ground's slabs, rubble)
    const port = this.view.localToWorld(this.eject.clone());
    const right = _v.set(1, 0, 0).applyQuaternion(look);
    const up = _w.set(0, 1, 0).applyQuaternion(look);
    const v = right.clone().multiplyScalar(1.6 + Math.random() * 0.8).addScaledVector(up, 1.2 + Math.random() * 0.8).addScaledVector(dir, -0.3 - Math.random() * 0.5);
    const lands = port.clone().addScaledVector(v, 0.6);
    const under = this.destruction.raycast([lands.x, port.y, lands.z], [0, -1, 0], 50);
    const floor = Math.max(this.ground(lands.x, lands.z), under ? under.point[1] : -Infinity);
    fx?.casing(port.toArray() as V3, v.toArray() as V3, floor);
    if (Math.random() < 0.35) this.onCasing([lands.x, floor, lands.z], 0.4 + Math.random() * 0.25);
    // The kick: the view climbs (a little aside too), the gun jolts back, a little shake
    const rise = CLIMB.up * (1 - 0.5 * Math.min(1, this.burstRounds / 20));
    const aside = (Math.random() - 0.5) * 2 * CLIMB.aside;
    this.climb.x += rise;
    this.climb.y += aside;
    this.turn(rise, aside);
    if (this.options.player) this.options.player.shake = Math.max(this.options.player.shake, 0.18);
    this.flashTurn = Math.random() * Math.PI * 2;
    this.onShot();
    this.onRound({ from: eye.toArray() as V3, direction: dir.toArray() as V3, reach: hit?.distance ?? RANGE });
    if (!hit) return;
    this.strikes.push(hit.at);
    this.onHit(hit);
  }

  /** What a bullet from `eye` along `dir` strikes first: a piece, the scenery or the ground (null: the sky, the water). */
  private trace(eye: THREE.Vector3, dir: THREE.Vector3): BulletHit | null {
    const o = eye.toArray() as V3;
    const d = dir.toArray() as V3;
    const solid = this.options.solids?.raycast(o, d, RANGE);
    const solidAt = solid && solid.distance > 0 ? solid.distance : Infinity;
    // The ground in front of the scenery (where groundAt steps up at its face, a pit's side, the
    // face is struck, not the top of the step)
    const ground = groundHit(this.ground, eye, dir, Math.min(solidAt - 0.02, RANGE));
    const groundAt = ground ? ground.distanceTo(eye) : Infinity;
    // A piece first, if it's as near (a slab of a breakable ground lies on the ground's surface)
    const shot = this.destruction.shoot(o, d, POWER, Math.min(solidAt, groundAt, RANGE) + 0.05);
    if (shot) return { at: shot.point, normal: shot.normal, direction: d, distance: shot.distance, piece: shot.piece, material: shot.material, kind: this.kindOf(shot.material), broke: shot.broke };
    if (ground && groundAt <= solidAt) return this.groundStrike(ground.toArray() as V3, [0, 1, 0], d, groundAt);
    if (!solid || solidAt === Infinity) return null;
    // The world's ground is a fixed body too, its top where groundAt says: struck there, it's the
    // ground (dirt where it's dirt, the water where it's water), not the scenery's stone
    const [x, y, z] = solid.point;
    if (solid.normal[1] > 0.7 && Math.abs(y - this.ground(x, z)) < 0.03) return this.groundStrike(solid.point, solid.normal, d, solidAt);
    // The scenery's stone, but where it's the side of a pit through a breakable ground, the layer
    // there (or what the world says it is)
    const material = pitAt(this.destruction.grounds, solid.point, this.options.pitSide);
    return { at: solid.point, normal: solid.normal, direction: d, distance: solidAt, piece: null, material, kind: material ? this.kindOf(material) : 'concrete', broke: false };
  }

  /** A bullet striking the world's ground (null: the water took it); down in a pit through a breakable ground, its floor. */
  private groundStrike(at: V3, normal: V3, direction: V3, distance: number): BulletHit | null {
    if (this.options.water?.(at[0], at[2])) return null;
    const material = pitAt(this.destruction.grounds, at, this.options.pitSide);
    return { at, normal, direction, distance, piece: null, material, kind: material ? this.kindOf(material) : (this.options.ground?.(...at) ?? 'concrete'), broke: false };
  }

  private kindOf(material: string): MaterialKind {
    let k = this.kinds.get(material);
    if (!k) this.kinds.set(material, (k = this.options.kindOf?.(material) ?? materialKind(material, this.destruction.materials[material])));
    return k;
  }

  private endBurst(): void {
    if (this.burstRounds > 0) this.onBurstEnd({ rounds: this.burstRounds, at: middle(this.strikes), seconds: this.time - this.burstStart });
    this.burstRounds = 0;
    this.strikes.length = 0;
  }

  /** Turn the view up and aside (radians) from where it looks. */
  private turn(up: number, aside: number): void {
    this.camera.rotation.x += up;
    this.camera.rotation.y += aside;
  }

  /** Where the view model is this frame: at rest, plus the kick, the footfalls, the sway, lowered. */
  private pose(dt: number, moving: number): void {
    const t = this.since;
    // The kick: back and up at once, settling fast (a burst keeps it shaking)
    const kick = Math.exp(-t * 22) * (0.8 + 0.2 * Math.random());
    // Footfalls (a damped spring), the lag behind the view as it turns, breathing
    this.bobVelocity.addScaledVector(this.bob, -170 * dt).multiplyScalar(Math.exp(-13 * dt));
    this.bob.addScaledVector(this.bobVelocity, dt);
    const turn = this.lastLook.invert().multiply(this.camera.quaternion);
    const rate = dt > 0 ? 2 / dt : 0;
    const clamp = (x: number) => Math.max(-0.05, Math.min(0.05, x));
    const blend = Math.min(1, dt * 12);
    this.lag.x += (clamp(-turn.x * rate * 0.012) - this.lag.x) * blend;
    this.lag.y += (clamp(-turn.y * rate * 0.012) - this.lag.y) * blend;
    this.lastLook.copy(this.camera.quaternion);
    const b = this.time;
    const swayX = Math.sin(b * 1.1) * 0.002 + Math.sin(b * 0.37) * 0.0012;
    const swayY = Math.sin(b * 1.6) * 0.0016 - 0.007 * moving;
    const low = lowering(this.lowered);
    this.view.visible = this.lowered < 1 || this.time < 0.5;
    this.view.position.set(
      this.rest.x + swayX + this.bob.x + 0.04 * low,
      this.rest.y + swayY + this.bob.y + 0.004 * kick - LOWER.drop * low,
      this.rest.z + 0.032 * kick,
    );
    const pitch = 0.035 * kick + this.lag.x + Math.sin(b * 0.8) * 0.003 + this.bob.y * 1.4 - LOWER.tip * low;
    const yaw = this.lag.y + Math.sin(b * 1.2) * 0.003;
    const roll = this.bob.x * 1.4 + 0.25 * low + (Math.random() - 0.5) * 0.02 * kick;
    this.view.quaternion.copy(this.aim).multiply(_q.setFromEuler(_e.set(pitch, yaw, roll)));
    // The flash: brief, each turned its own way, the star facing the eye (and drawn black for the
    // first frames, so its shaders are made at load)
    this.glow.value = Math.max(0, 1 - t / FLASH);
    this.flash.visible = this.glow.value > 0 || this.time < 0.5;
    this.flash.rotation.z = this.flashTurn;
    this.star.quaternion.copy(this.view.quaternion).multiply(this.flash.quaternion).invert().multiply(_q.setFromAxisAngle(FORWARD, this.flashTurn));
  }
}

/**
 * What a breakable ground is made of where a bullet strikes the scenery or the ground at `at`, down
 * in a pit through it (under its top, in its area or at its edge): the bed on its floor; on its
 * sides what `side` says, else the layer at that height. Null: not in a pit, or the scenery's stone.
 */
function pitAt(grounds: readonly Ground[], at: V3, side?: GunOptions['pitSide']): string | null {
  const [x, y, z] = at;
  for (const g of grounds) {
    if (y > g.top - 0.01 || !g.contains(x, z, EDGE)) continue;
    if (y < g.bed + 0.01) return g.bedMaterial;
    const said = side?.(at, g);
    if (said !== undefined) return said;
    // Under the top layer's slabs (as laid), the layer under it
    return g.under && y < (g.slabs[0]?.bounds.min[1] ?? g.top) ? g.under : g.material;
  }
  return null;
}

/** The middle of points, each axis apart (the median: a stray round or two don't move it); null for none. */
function middle(points: readonly V3[]): V3 | null {
  if (!points.length) return null;
  const at = (k: number) => {
    const v = points.map((p) => p[k]).sort((a, b) => a - b);
    const i = v.length >> 1;
    return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
  };
  return [at(0), at(1), at(2)];
}

/** The drawn gun (without the kit): dark boxes and tubes. */
function drawnGun(): GunKit {
  const olive = new THREE.MeshStandardNodeMaterial({ color: 0x3c4230, roughness: 0.7, metalness: 0.1 });
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x1c1e22, roughness: 0.45, metalness: 0.6 });
  const part = (geometry: THREE.BufferGeometry, m: THREE.Material, at: V3, tilt = 0) => {
    const mesh = new THREE.Mesh(geometry, m);
    mesh.position.set(...at);
    mesh.rotation.x = tilt;
    return mesh;
  };
  const tube = (r: number, l: number) => new THREE.CylinderGeometry(r, r, l, 20).rotateX(Math.PI / 2);
  const gun = new THREE.Group();
  gun.add(
    part(new THREE.BoxGeometry(0.06, 0.08, 0.42), olive, [0, 0.005, -0.1]),
    part(tube(0.026, 0.34), olive, [0, 0, -0.45]),
    part(tube(0.012, 0.12), steel, [0, 0, -0.66]),
    part(tube(0.02, 0.06), steel, [0, 0, -0.67]),
    part(new THREE.BoxGeometry(0.02, 0.012, 0.3), steel, [0, 0.05, -0.1]),
    part(new THREE.BoxGeometry(0.035, 0.12, 0.05), steel, [0, -0.09, 0.02], 0.3),
    part(new THREE.BoxGeometry(0.045, 0.1, 0.28), olive, [0, -0.03, 0.2]),
  );
  gun.add(part(new THREE.BoxGeometry(0.03, 0.19, 0.07), olive, [0, -0.13, -0.22], 0.12));
  return { model: gun, muzzle: [0, 0, -0.7], eject: [0.03, 0.01, -0.18] };
}
