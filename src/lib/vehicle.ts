// Cars that come apart (public/models/cars, made by scripts/assets/process-cars.py from the prop
// pack's cars): a body with its cabin, and on it its parts, each a prop of its own: four doors,
// the hood and the trunk lid on latches, four wheels, two bumpers; and its windows, each a pane of
// glass that shatters. At rest the car is one, its parts bonded to its body and its panes welded
// in, all of it at rest as a prop is; a blast or a hard knock wakes it and it moves as one, its
// bonds joints that bend before they tear (painted sheet steel: a bumper hangs off by a corner).
//
// What a car does that a wall doesn't is here: a latch that goes lets its door (the hood, the
// trunk lid) swing open on its hinge, and pulled hard enough it tears off; a few rounds into a
// door spring its latch; a round into a tyre lets it down, and the car settles onto its rim; a
// blast near it tears off what's closest and throws the rest open; rounds into its tank hole it.
// What follows (the fuel running out, fire, the car going up) is the world's, by the hooks.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three/webgpu';
import { raycastConvex } from './convex.ts';
import { type Bond, type Destruction, type Piece, type PropModel, WELD } from './destruction.ts';
import { add, conjugate, distance, dot, multiply, normalize, type Q, rotate, scale, sub, toLocal, toWorld, type V3 } from './math.ts';
import { material, presets } from './materials.ts';
import type { BreakableMaterial, MaterialOptions } from './materials.ts';

/** What a part is: trim is what's bolted on besides (a taxi's roof sign). */
export type VehiclePartRole = 'body' | 'door' | 'hood' | 'trunk' | 'wheel' | 'bumper' | 'trim';

/** A part as process-cars.py lists it (the car's frame: glTF's, facing -z, standing on y = 0). */
export interface VehiclePartEntry {
  name: string;
  role: VehiclePartRole;
  /** Where its origin is in the car: on its hinge (a door's, the hood's, the trunk's), at a wheel's axle. */
  pivot: V3;
  /** Its hinge's or axle's way. */
  axis?: V3;
  /** A wheel's radius (m). */
  radius?: number;
  /** Points (its frame) whose convex hull it collides as; the body, its hulls (`colliders`). */
  collider?: V3[];
  colliders?: V3[][];
  mass: number;
  triangles: number;
}

/** A car as process-cars.py lists it in public/models/cars/index.json. */
export interface VehicleEntry {
  file: string;
  mass: number;
  parts: VehiclePartEntry[];
  /** Its windows: each pane's hull (the car's frame), and the part it's set in. */
  glass: Array<{ name: string; on: string; points: V3[]; normal: V3 }>;
  /** Where its fuel tank is (the car's frame). */
  fuel: V3;
  triangles: number;
  /** Its paint: its copies' tint unless they're given one, where the colour map's alpha says ('alpha'), or on its paint material ('paint'). */
  tint?: number;
  tintMask?: 'alpha' | 'paint';
}

/** A car ready to place: its entry, and each part's model (a wheel's flat one besides). */
export interface VehicleModel extends VehicleEntry {
  name: string;
  models: Record<string, PropModel>;
  /** Each wheel's model with its tyre let down. */
  flats: Record<string, PropModel>;
}

/** How far a let-down tyre's rim sinks toward the road (m), and how much its squashed bottom bulges out sideways. */
const FLAT = 0.08;
const BULGE = 0.14;

/** Load the cars (public/models/cars served at `base`; default 'models/cars/'): name → model. */
export async function loadVehicles(options: { base?: string; only?: string[] } = {}): Promise<Record<string, VehicleModel>> {
  const base = options.base ?? 'models/cars/';
  const r = await fetch(`${base}index.json`);
  if (!r.ok) throw new Error(`loadVehicles: ${base}index.json: ${r.status}`);
  const index = (await r.json()) as Record<string, VehicleEntry>;
  const loader = new GLTFLoader();
  const out: Record<string, VehicleModel> = {};
  // The cars share their insides' textures (the same files): each once, on the GPU too
  const shared = new Map<string, THREE.Texture>();
  await Promise.all(
    Object.entries(index)
      .filter(([name]) => !options.only || options.only.includes(name))
      .map(async ([name, entry]) => {
        const gltf = await loader.loadAsync(base + entry.file);
        share(gltf, base, shared);
        // (The loader takes the dots out of node names: 'door.fl' is 'doorfl')
        out[name] = vehicleModel(name, entry, (part) => gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(part)) ?? null);
      }),
  );
  return out;
}

/** The maps a car's materials have. */
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'clearcoatMap', 'clearcoatRoughnessMap'] as const;

/** Each texture of `gltf` the first loaded of its image (by its file), another car's if it had it. */
function share(gltf: { scene: THREE.Object3D; parser: { json: { textures?: Array<{ source?: number }>; images?: Array<{ uri?: string }> }; associations: Map<object, { textures?: number }> } }, base: string, shared: Map<string, THREE.Texture>): void {
  const { json, associations } = gltf.parser;
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as unknown as Array<Record<string, THREE.Texture | null>>) {
      for (const key of MAPS) {
        const t = m[key];
        const i = t ? associations.get(t)?.textures : undefined;
        const uri = i !== undefined ? json.images?.[json.textures?.[i]?.source ?? -1]?.uri : undefined;
        if (!t || !uri) continue;
        const k = `${base}${uri}#${t.colorSpace}`;
        const first = shared.get(k);
        if (!first) shared.set(k, t);
        else if (first !== t) {
          m[key] = first;
          t.dispose();
        }
      }
    }
  });
}

/** A car's model from its entry and its parts' looks (each part's node, its origin at the part's pivot). */
export function vehicleModel(name: string, entry: VehicleEntry, look: (part: string) => THREE.Object3D | null): VehicleModel {
  const models: Record<string, PropModel> = {};
  const flats: Record<string, PropModel> = {};
  for (const p of entry.parts) {
    const object = look(p.name);
    if (!object) throw new Error(`vehicleModel: ${name} has no part ${p.name}`);
    const model: PropModel = { name: `${name}.${p.name}`, object, collider: p.collider ?? p.colliders![0], colliders: p.colliders, mass: p.mass, tint: entry.tint, tintMask: entry.tintMask, hullVertices: p.role === 'wheel' ? 24 : undefined };
    models[p.name] = model;
    // Let down: the bottom of its hull up to the sunken rim's, its tyre squashed flat there
    if (p.role === 'wheel' && p.collider) {
      const r = p.radius ?? 0.33;
      flats[p.name] = { ...model, name: `${model.name}.flat`, object: flattened(object, r), collider: p.collider.map(([x, y, z]) => [x, Math.max(y, -(r - FLAT)), z]) };
    }
  }
  return { ...entry, name, models, flats };
}

/**
 * A wheel's look with its tyre let down: what's under where the rim now sinks to pressed flat onto
 * the road, and the tyre bulging out sideways (along its axle, x) the more the nearer the road.
 */
function flattened(object: THREE.Object3D, radius: number): THREE.Object3D {
  const copy = object.clone(true);
  copy.updateWorldMatrix(true, true);
  const root = copy.matrixWorld.clone().invert();
  const floor = -(radius - FLAT);
  const v = new THREE.Vector3();
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    const toRoot = root.clone().multiply(mesh.matrixWorld);
    const back = toRoot.clone().invert();
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toRoot);
      if (v.y >= 0) continue;
      const low = Math.min(1, -v.y / radius);
      v.x *= 1 + BULGE * low * low;
      v.y = Math.max(v.y, floor);
      v.applyMatrix4(back);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    // (Its normals kept: the squashed foot is in its own shadow on the road)
    mesh.geometry = g;
  });
  return copy;
}

/** The materials a car is made of, by default (give them to the Destruction under these names, or name your own in addVehicle). */
export const vehiclePresets = {
  /** Painted sheet steel: the body and its panels. It bends before it tears. */
  carbody: (o: MaterialOptions = {}): BreakableMaterial => presets.metal({ strength: 4e4, plastic: { yieldStress: 1e4, bend: 1.3 }, ...o }),
  /** Tempered glass: a round and it's gone, to small cubes. */
  carglass: (o: MaterialOptions = {}): BreakableMaterial => presets.glass({ fragmentSize: 0.07, minSize: 0.03, maxPieces: 20, strength: 1e3, ...o }),
  /** Tyres on their wheels. */
  tyre: (o: MaterialOptions = {}): BreakableMaterial => material({ density: 1.2, strength: 5e4, impact: 300, friction: 1.1, fragmentSize: 0.3, minSize: 0.2, maxPieces: 3, rubbleLife: Infinity, ...o }),
  /** A bumper's plastic cover: it cracks and hangs. */
  bumper: (o: MaterialOptions = {}): BreakableMaterial => presets.metal({ density: 1, strength: 2e4, impact: 60, plastic: { yieldStress: 4e3, bend: 1.6 }, ...o }),
};

export interface VehicleOptions {
  position: V3;
  rotation?: Q;
  /** Its paint (where its tint mask says; default the model's). */
  tint?: THREE.ColorRepresentation;
  /** The Destruction's materials its parts are made of (defaults: vehiclePresets' names). */
  materials?: { body?: string; glass?: string; wheel?: string; bumper?: string };
}

/** What the world hears of a car (each optional). */
export interface VehicleHooks {
  /** A latch went: a door, the hood or the trunk lid swings open (`at`: where it is). */
  latch?: (vehicle: Vehicle, part: string, at: V3) => void;
  /** A part came off it altogether. */
  torn?: (vehicle: Vehicle, part: string, at: V3) => void;
  /** A tyre went (a round, or a blast). */
  tyre?: (vehicle: Vehicle, wheel: string, at: V3) => void;
  /** A round holed its tank (`holes`: how many now). */
  tank?: (vehicle: Vehicle, at: V3, holes: number) => void;
}

/**
 * Bond areas (m²; what they carry scales with them): a wheel on its hub, a door's, the hood's and
 * the trunk's latch, a bumper's clips, trim's bolts.
 */
const BONDS: Record<Exclude<VehiclePartRole, 'body'>, number> = { wheel: 0.02, door: 0.004, hood: 0.004, trunk: 0.004, bumper: 0.003, trim: 0.002 };
/** How hard a pull (the solver's force) tears a swinging door, hood or trunk lid off its hinge. */
const HINGE_BREAK = 30;
/** Rounds into a door, the hood or the trunk lid before its latch goes (at random between). */
const LATCH_ROUNDS: [number, number] = [5, 9];
/**
 * A round that struck a part of the car went through a pane on its way if one lies across it this
 * far back from where it struck (m), or this far on: a door with its window frame, or with a
 * mirror, is one hull round its glass, and so is the cabin, near enough.
 */
const BEFORE = 1.2;
const PAST = 0.3;
/** A round passing this near the tank's middle (m), on through the panel it struck (up to THROUGH beyond it), holes it. */
const TANK_REACH = 0.35;
const THROUGH = 2;
/** A blast tears off the parts within this share of its radius, and springs the latches within this. */
const TEAR = 0.9;
const SPRING = 1.8;
/** How far from its place on the body (m) a part whose latch has gone is still taken to hang there (else it's off). */
const ON = 0.35;
/** The black of a burnt-out car. */
const CHARRED = 0x1c1a19;
/**
 * The collision groups its pieces are in, one a car, in turn (cars placed in a row get different
 * ones; cars eight apart share one, and pass through each other): a car's hulls overlap (its body's
 * is solid where its cabin is, its doors and wheels lie in it), so its pieces don't collide with
 * each other, only with the rest of the world, other cars too.
 */
const GROUPS = Array.from({ length: 8 }, (_, i) => 1 << (20 + i));
let nextGroup = 0;

const owners = new WeakMap<Piece, Vehicle>();

/** The car a piece is part of (its body, a part, a pane), if it is one. */
export function vehicleOf(piece: Piece | null | undefined): Vehicle | undefined {
  return piece ? owners.get(piece) : undefined;
}

/** Place a car: its body, its parts bonded to it, its panes welded in, all at rest. */
export function addVehicle(d: Destruction, model: VehicleModel, options: VehicleOptions, hooks: VehicleHooks = {}): Vehicle {
  return new Vehicle(d, model, options, hooks);
}

export class Vehicle {
  readonly model: VehicleModel;
  readonly body: Piece;
  /** Its parts still on it or not (gone ones taken out), by name; and its panes, unbroken. */
  readonly parts = new Map<string, Piece>();
  readonly panes = new Map<string, Piece>();
  /** Latches that have gone, tyres let down, parts off it altogether. */
  readonly open = new Set<string>();
  readonly flat = new Set<string>();
  readonly off = new Set<string>();
  /** Rounds its tank has taken; burnt out. */
  holes = 0;
  burnt = false;
  private readonly d: Destruction;
  private readonly hooks: VehicleHooks;
  private readonly materials: Required<NonNullable<VehicleOptions['materials']>>;
  private readonly tint: THREE.ColorRepresentation | undefined;
  /** A part's other hulls, welded to it (the body's cabin): which part they are. */
  private readonly hulls = new Map<Piece, string>();
  /** Each piece's model frame in its body's (a prop's body sits at its hull's centre of mass). */
  private readonly offsets = new Map<Piece, { position: V3; rotation: Q }>();
  private readonly entries = new Map<string, VehiclePartEntry>();
  /** Rounds each part has taken, and how many its latch holds for. */
  private readonly rounds = new Map<string, number>();
  private readonly holds = new Map<string, number>();
  private readonly unlisten: () => void;
  /** Its collision group (GROUPS). */
  private readonly group: number;

  constructor(d: Destruction, model: VehicleModel, options: VehicleOptions, hooks: VehicleHooks = {}) {
    this.d = d;
    this.model = model;
    this.hooks = hooks;
    this.tint = options.tint;
    this.materials = { body: 'carbody', glass: 'carglass', wheel: 'tyre', bumper: 'bumper', ...options.materials };
    this.group = GROUPS[nextGroup++ % GROUPS.length];
    const frame = { position: options.position, rotation: options.rotation ?? ([0, 0, 0, 1] as Q) };
    let body: Piece | null = null;
    for (const entry of model.parts) {
      this.entries.set(entry.name, entry);
      const piece = this.place(entry.name, model.models[entry.name], frame);
      if (entry.role === 'body') body = piece;
    }
    if (!body) throw new Error(`Vehicle: ${model.name} has no body`);
    this.body = body;
    for (const [name, p] of this.parts) if (p !== body) d.bond(body, p, BONDS[this.entries.get(name)!.role as Exclude<VehiclePartRole, 'body'>], this.at(name, frame));
    // The panes, welded into what they're set in: they go only by breaking
    for (const g of model.glass) {
      const host = this.parts.get(g.on) ?? body;
      const pane = d.addConvex({ material: this.materials.glass, points: g.points, position: frame.position, rotation: frame.rotation, rest: true });
      if (!pane) continue;
      d.bond(host, pane, WELD);
      this.panes.set(g.name, pane);
      owners.set(pane, this);
      this.own(pane);
    }
    for (const name of this.parts.keys()) this.holds.set(name, LATCH_ROUNDS[0] + Math.floor(Math.random() * (LATCH_ROUNDS[1] - LATCH_ROUNDS[0] + 1)));
    // A latch pulled apart (the car thrown, landing hard): the part swings on its hinge, if it's still there
    this.unlisten = d.on('bondBreak', ({ bond }) => this.parted(bond));
  }

  /** Which of its parts or panes `piece` is (null: not this car's). */
  partOf(piece: Piece | null | undefined): string | null {
    if (!piece) return null;
    const hull = this.hulls.get(piece);
    if (hull) return hull;
    for (const [name, p] of this.parts) if (p === piece) return name;
    for (const [name, p] of this.panes) if (p === piece) return name;
    return null;
  }

  /** The car's frame now (where its body is). */
  frame(): { position: V3; rotation: Q } {
    return this.frameOf(this.body);
  }

  /** Where a point of the car's frame is now (the tank, a door's hinge). */
  toWorld(p: V3): V3 {
    const f = this.frame();
    return toWorld(f.position, f.rotation, p);
  }

  /** The middle of the car now. */
  get center(): V3 {
    return this.toWorld([0, 0.7, 0]);
  }

  /**
   * A round struck it (`piece`: what of it; `at`, `direction`: where, which way): a tyre goes; a
   * door, the hood or the trunk lid takes a few before its latch springs; near the tank, it's holed.
   */
  shot(hit: { piece: Piece | null; at: V3; direction: V3 }): void {
    const name = this.partOf(hit.piece);
    if (!name || name.startsWith('glass.')) return;
    // Through a pane on its way in: the glass goes
    const dir = normalize(hit.direction);
    const through = this.paneBefore(hit.at, dir);
    if (through) this.d.shootPiece(through.pane, through.at, dir);
    if (this.burnt) return;
    const entry = this.entries.get(name)!;
    if (entry.role === 'wheel') this.letDown(name, hit.at);
    else if ((entry.role === 'door' || entry.role === 'hood' || entry.role === 'trunk') && !this.open.has(name)) {
      const n = (this.rounds.get(name) ?? 0) + 1;
      this.rounds.set(name, n);
      if (n >= this.holds.get(name)!) this.unlatch(name, scale(normalize(hit.direction), 0.6));
    }
    // Sheet steel doesn't stop it: on its way through the car, past the tank?
    const tank = this.toWorld(this.model.fuel);
    const t = Math.max(0, Math.min(THROUGH, dot(sub(tank, hit.at), dir)));
    if (distance(add(hit.at, scale(dir, t)), tank) < TANK_REACH) {
      this.holes++;
      this.hooks.tank?.(this, hit.at, this.holes);
    }
  }

  /**
   * A blast at `at` of `radius` (after the Destruction's own: the car is thrown already): what's
   * nearest it is torn off, the latches further off spring, the tyres in its heart go.
   */
  blast(at: V3, radius: number): void {
    for (const [name, p] of [...this.parts]) {
      if (p === this.body || this.off.has(name)) continue;
      const entry = this.entries.get(name)!;
      const r = distance(p.pose.position, at);
      const away = scale(normalize(sub(p.pose.position, at)), 4 * Math.max(0, 1 - r / (radius * SPRING)));
      if (r < radius * TEAR && entry.role !== 'wheel') this.tear(name, add(away, [0, 2, 0]));
      else if (r < radius * SPRING && (entry.role === 'door' || entry.role === 'hood' || entry.role === 'trunk')) this.unlatch(name, away);
      else if (r < radius * TEAR && entry.role === 'wheel') this.letDown(name, p.pose.position);
    }
  }

  /** The pane a round along `dir` that struck the car at `at` went through first, and where (null: none). */
  private paneBefore(at: V3, dir: V3): { pane: Piece; at: V3 } | null {
    const from = sub(at, scale(dir, BEFORE));
    let best: { pane: Piece; t: number } | null = null;
    for (const p of this.panes.values()) {
      if (p.state === 'gone') continue;
      const h = raycastConvex(p.convex, from, dir, BEFORE + PAST);
      if (h && (!best || h.t < best.t)) best = { pane: p, t: h.t };
    }
    return best && { pane: best.pane, at: add(from, scale(dir, best.t)) };
  }

  /** Burnt out: every piece of it black (the world's fire did it). */
  burn(): void {
    this.burnt = true;
    for (const p of [...this.parts.values(), ...this.panes.values()]) if (p.state !== 'gone') this.d.retint(p, CHARRED);
  }

  /** Stop hearing the Destruction (the car's gone). */
  dispose(): void {
    this.unlisten();
  }

  /**
   * A latch springs: the part swings open on its hinge, until it's torn off. It swings out (a car's
   * pieces pass through each other: one pushed in would swing through the cabin): a door away from
   * the car's middle, faster by as much of `velocity` (a blast's push, a round's) as goes that way;
   * the hood and the trunk lid up.
   */
  unlatch(name: string, velocity: V3 = [0, 0, 0]): void {
    const p = this.parts.get(name);
    const entry = this.entries.get(name);
    if (!p || !entry?.axis || this.open.has(name) || this.off.has(name) || p.state === 'gone') return;
    this.open.add(name);
    for (const b of [...p.bonds]) if (b.other(p) === this.body) this.d.unbond(b);
    const f = this.frame();
    this.d.hinge(p, toWorld(f.position, f.rotation, entry.pivot), rotate(f.rotation, entry.axis), { to: this.body, breakForce: HINGE_BREAK });
    const out = entry.role === 'door' ? sub(p.pose.position, this.center) : rotate(f.rotation, [0, 1, 0]);
    if (entry.role === 'door') out[1] = 0;
    const way = normalize(out);
    this.d.push(p, scale(way, 1.2 + Math.max(0, dot(velocity, way))));
    this.hooks.latch?.(this, name, p.pose.position);
  }

  /** A part torn off the car altogether, flying at `velocity`. */
  tear(name: string, velocity: V3 = [0, 0, 0]): void {
    const p = this.parts.get(name);
    if (!p || this.off.has(name) || p.state === 'gone') return;
    this.off.add(name);
    this.open.add(name);
    for (const b of [...p.bonds]) if (b.other(p) === this.body) this.d.unbond(b);
    if (p.state === 'rubble') this.d.loosen(p, velocity);
    else this.d.push(p, velocity);
    this.hooks.torn?.(this, name, p.pose.position);
  }

  /** A tyre goes: the wheel is made again on its flat tyre, and the car settles onto its rim. */
  letDown(name: string, at: V3): void {
    const p = this.parts.get(name);
    const flat = this.model.flats[name];
    if (!p || !flat || this.flat.has(name) || this.off.has(name) || p.state === 'gone') return;
    this.flat.add(name);
    const onCar = [...p.bonds].some((b) => b.other(p) === this.body);
    const frame = this.frameOf(p);
    // A wheel going by (the car thrown, or it on its own) goes on as it went
    const moving = p.state === 'loose' ? { velocity: [...p.body.velocity] as V3, spin: [...p.body.angularVelocity] as V3 } : undefined;
    this.d.removePiece(p);
    this.parts.delete(name);
    const wheel = this.place(name, flat, frame, moving);
    if (onCar) this.d.bond(this.body, wheel, BONDS.wheel, toWorld(frame.position, frame.rotation, [0, 0, 0]));
    // What's at rest settles onto it (the car wakes, and comes to rest down on that corner)
    if (!moving) this.d.push(this.body, [0, -0.05, 0]);
    this.hooks.tyre?.(this, name, at);
  }

  /** A part's prop placed in `frame` (the car's, or the part's own), drawn in the car's paint; at rest, or `moving`. */
  private place(name: string, model: PropModel, frame: { position: V3; rotation: Q }, moving?: { velocity: V3; spin: V3 }): Piece {
    const entry = this.entries.get(name)!;
    const own = model === this.model.models[name] ? toWorld(frame.position, frame.rotation, entry.pivot) : frame.position;
    const material = entry.role === 'wheel' ? this.materials.wheel : entry.role === 'bumper' || entry.role === 'trim' ? this.materials.bumper : this.materials.body;
    const piece = this.d.addProp({ model, material, position: own, rotation: frame.rotation, tint: this.tint, ...(moving && { loose: true, ...moving }) });
    if (!piece) throw new Error(`Vehicle: no room for ${this.model.name}'s ${name}`);
    this.offsets.set(piece, { position: toLocal(piece.pose.position, piece.pose.rotation, own), rotation: multiply(conjugate(piece.pose.rotation), frame.rotation) });
    this.parts.set(name, piece);
    owners.set(piece, this);
    // It and its welded hulls (the body's cabin)
    this.own(piece);
    for (const b of piece.bonds) {
      const q = b.other(piece);
      if (b.area < WELD || q.prop !== model) continue;
      this.own(q);
      this.hulls.set(q, name);
      owners.set(q, this);
    }
    return piece;
  }

  /** One of its pieces: in the car's collision group, colliding with everything but the car. */
  private own(p: Piece): void {
    p.body.setCollisionGroups(this.group, ~this.group >>> 0);
  }

  /** A part's own frame now (its origin at its pivot), or the car's for the body. */
  private frameOf(p: Piece): { position: V3; rotation: Q } {
    const o = this.offsets.get(p)!;
    return { position: toWorld(p.pose.position, p.pose.rotation, o.position), rotation: multiply(p.pose.rotation, o.rotation) };
  }

  /** Where a part's bond to the body is: on its hinge for what swings, its middle for the rest (the car's frame given). */
  private at(name: string, frame: { position: V3; rotation: Q }): V3 {
    return toWorld(frame.position, frame.rotation, this.entries.get(name)!.pivot);
  }

  /** A bond broken by the Destruction (pulled apart): a latched part still on its hinge swings; one away from its place is off. */
  private parted(bond: Bond): void {
    if (bond.a !== this.body && bond.b !== this.body) return;
    const p = bond.other(this.body);
    const name = this.partOf(p);
    if (!name || name.startsWith('glass.') || this.off.has(name)) return;
    const entry = this.entries.get(name)!;
    if (entry.axis && entry.role !== 'wheel' && !this.open.has(name) && distance(this.toWorld(entry.pivot), this.frameOf(p).position) < ON) this.unlatch(name);
    else {
      this.off.add(name);
      this.open.add(name);
      this.hooks.torn?.(this, name, p.pose.position);
    }
  }
}
