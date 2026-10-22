// Destruction: breakable structures over a three-avbd World.
//
// A structure is convex pieces bonded where they touch face to face. Pieces stand as fixed bodies
// (which cost the solver next to nothing) while what holds them up still stands: something they
// are bonded to, all the way down to the ground or to a static piece. A blast cuts the pieces it
// reaches into Voronoi cells, packed small around it: the cells at its heart turn to dust, those
// within its reach are thrown loose, and the rest stay in the structure, bonded to each other and
// to what the piece was bonded to. Then whatever no longer reaches the ground through its bonds
// falls: each such section comes loose whole, its bonds made joints that break when it lands
// (three-avbd's joint fracture, on the GPU), turning over the edge of what it still rests on if
// its centre of mass is out past it. Loose pieces that come to rest on something that holds them
// up (their centre of mass over what pushes them up: the ground, standing pieces, rubble; not
// neighbours they're jammed between) freeze into rubble, fixed again until a blast reaches them or
// what they rest on goes; small rubble shrinks away after a while, and past a budget (maxPieces)
// the rest of the rubble too, what's least to be seen first.

import * as THREE from 'three/webgpu';
import type { Body, HullShape, Joint, World } from 'three-avbd';
import { BlastPass } from './blast.ts';
import { bulletPush, bulletsToBreak } from './bullets.ts';
import { contactPatch, FACING, TOUCH } from './contact.ts';
import { bounds, boxConvex, type Convex, hullConvex, raycastConvex, signedDistance, transform, vertices, volumeCentroid } from './convex.ts';
import { hullShape } from './hull-shape.ts';
import { type Allocation, type DrawFace, drawFaces, FragmentMesh, frameBox, jitterFrame, type TextureFrame } from './fragment-mesh.ts';
import { type Cell, type Grain, impactSeeds, uniformSeeds, voronoi } from './fracture.ts';
import { type Ground, type GroundOptions, layGround } from './ground.ts';
import { PropMesh } from './prop-mesh.ts';
import type { BreakableMaterial } from './materials.ts';
import { overhang, reachToward, type Touch, touches } from './support.ts';
import { add, type Box3, boxDistance, boxesOverlap, conjugate, cross, distance, dot, length, lerp, multiply, normalize, type Q, quatFromAxisAngle, random, rayBox, rotate, scale, sub, toLocal, toWorld, type V3 } from './math.ts';

export type PieceState = 'fixed' | 'loose' | 'rubble' | 'gone';

/** The cells (m) the scenery's shapes are looked up by, seen from above (what a piece stands on). */
const SCENERY_CELL = 8;

/** A blast wakes what's dormant within this many of its radii (Destruction.addDormant). */
const DORMANT_REACH = 1.25;
/** The cells (m, seen from above) what's dormant is found in by what's let go under it. */
const DORMANT_CELL = 16;

/** A prop that breaks (PropModel.shards) breaks within this share of a blast's radius of it. */
const PROP_BREAK = 0.85;

/** A pose: where a body's frame is. */
export interface Pose {
  position: V3;
  rotation: Q;
}

/** A bond between two pieces of a structure: the face they share. */
export class Bond {
  readonly a: Piece;
  readonly b: Piece;
  /** The shared face's area (m²). */
  readonly area: number;
  /** The shared face's centre (world, as the pieces stood). */
  readonly center: V3;
  /** The shared face's normal, from a toward b. */
  readonly normal: V3;
  /** While the pieces fall together, the joint holding them. */
  joint: Joint | null = null;
  /** The weight it carried at the last stress pass, as a share of what it can (1: at its limit). */
  load = 0;
  /** What it can carry, as a multiple of its material's (Destruction.reinforce raises it). */
  strength = 1;
  /**
   * The weight it carried as built (Destruction.reinforce): its extra strength is for that load.
   * Asked to carry more once supports are lost, it falls back toward its material's own.
   */
  builtLoad = 0;
  /** @internal The weight it carried at the last stress pass. */
  force = 0;
  /** @internal Where its joint holds each piece (in their frames), kept while they rest as rubble. */
  anchors: [V3, V3] | null = null;
  /** @internal How b was turned in a's frame as they stood (its joint holds them so). */
  turn: Q | null = null;
  constructor(a: Piece, b: Piece, area: number, center: V3, normal: V3) {
    this.a = a;
    this.b = b;
    this.area = area;
    this.center = center;
    this.normal = normal;
  }
  other(p: Piece): Piece {
    return p === this.a ? this.b : this.a;
  }
}

/** One convex piece: a body in the world, drawn by its material's FragmentMesh. */
export class Piece {
  private current!: PieceState;
  /** Standing ('fixed'), 'loose', 'rubble' or 'gone'; its material can read it (pieceState). */
  get state(): PieceState {
    return this.current;
  }
  set state(s: PieceState) {
    this.current = s;
    if (this.draw) FragmentMesh.setState(this.body, s);
  }
  /** Bonds to the pieces it's joined to. */
  readonly bonds = new Set<Bond>();
  /** Where its body stands: exact while fixed or rubble; as of the last readback while loose. */
  pose: Pose;
  /** Seconds it has been still (loose), or since it settled (rubble). */
  still = 0;
  /** @internal While rubble: what it rests on, or leans or is wedged against (it wakes when one of them goes). */
  under: Piece[] = [];
  /** @internal The rubble resting on it. */
  carried: Set<Piece> | null = null;
  /** @internal Where it was when it last slowed down (a piece creeping on isn't still). */
  stoppedAt: V3 | null = null;
  /** @internal Seconds it has stayed within DRIFT of `driftFrom` (loose): creeping or jittering, it has nearly stopped. */
  drift = 0;
  driftFrom: V3 | null = null;
  /** @internal When to look again at whether something holds it up. */
  holdAt = 0;
  /** @internal Whether it stands on the ground (Destruction.onGround; null: not looked at yet). */
  grounded: boolean | null = null;
  /** The breakable ground it was laid as (addGround's slabs, and the cells cut from them where they stood); null otherwise. */
  ground: Ground | null = null;
  /** @internal How far out past what carries it its weight bore as built (reinforce(); -1: not built so). */
  builtOverhang = -1;
  /** @internal The weighing's: bonds from the ground, the weight it bears, and where (its sums × x, z). */
  depth = -1;
  weight = 0;
  bearsX = 0;
  bearsZ = 0;
  /** @internal */
  draw: Allocation | null = null;
  /** @internal Its convex in the world, while it stands (cached). */
  private placed: Convex | null = null;
  private box: Box3 | null = null;
  private cornerList: V3[] | null = null;
  private reach = -1;

  readonly id: number;
  readonly materialName: string;
  readonly material: BreakableMaterial;
  /** Its shape in its body's frame. */
  readonly local: Convex;
  readonly volume: number;
  readonly body: Body;
  /** Never breaks or moves: holds up what's bonded to it (a foundation, an unbreakable neighbour). */
  readonly isStatic: boolean;
  /** Holds up what's bonded to it as the ground does, needing nothing under it, but breaks as any piece (PieceOptions.anchor). */
  anchor = false;
  /** Its texture's frame in the body's frame (so a map stays put on the piece as it moves), with its box and smoothing. */
  readonly texture: TextureFrame;
  /** Its colour over its material's (PieceOptions.tint; Destruction.retint). */
  tint: V3;
  /** Its density (its material's, unless it's a prop of a given mass). */
  readonly density: number;
  /** The model it's drawn as, if it's a prop (Destruction.addProp). */
  readonly prop: PropModel | null;

  /** @internal Made by Destruction. */
  constructor(id: number, materialName: string, material: BreakableMaterial, local: Convex, volume: number, body: Body, pose: Pose, state: PieceState, isStatic: boolean, texture: TextureFrame, tint: V3, density = material.density, prop: PropModel | null = null) {
    this.id = id;
    this.density = density;
    this.prop = prop;
    this.materialName = materialName;
    this.material = material;
    this.local = local;
    this.volume = volume;
    this.body = body;
    this.pose = pose;
    this.state = state;
    this.isStatic = isStatic;
    this.texture = texture;
    this.tint = tint;
  }

  /** The cube root of its volume (m). */
  get size(): number {
    return Math.cbrt(this.volume);
  }

  get mass(): number {
    return this.volume * this.density;
  }

  /** Its convex where it stands now (fixed or rubble; a loose piece's is as of the last readback). */
  get convex(): Convex {
    return (this.placed ??= transform(this.local, this.pose.position, this.pose.rotation));
  }

  get bounds(): Box3 {
    return (this.box ??= bounds(this.convex));
  }

  /** Its convex's corners where it stands now, each once. */
  get corners(): V3[] {
    return (this.cornerList ??= vertices(this.convex));
  }

  /** How far its farthest corner is from its body's centre (m). */
  get radius(): number {
    if (this.reach < 0) for (const f of this.local.faces) for (const p of f.pts) this.reach = Math.max(this.reach, length(p));
    return this.reach;
  }

  /**
   * Its texture frame where it is now (world), with its box and smoothing: a piece made again from
   * this one (its parts, its cells) given it as PieceOptions.textureFrame keeps its look as it was.
   */
  get textureFrame(): TextureFrame {
    const { position, rotation } = this.pose;
    return { ...this.texture, position: toWorld(position, rotation, this.texture.position), rotation: multiply(rotation, this.texture.rotation) };
  }

  /** @internal It moved: drop the cached world shape. */
  moved(pose: Pose): void {
    this.pose = pose;
    this.placed = null;
    this.box = null;
    this.cornerList = null;
  }
}

/** A model to place as a prop: a car, a hydrant, a crate. */
export interface PropModel {
  /** Its look (a GLB's scene, say), in its own frame. */
  object: THREE.Object3D;
  /** Points (its frame) whose convex hull it collides as. */
  collider: V3[];
  /**
   * Or the convex parts it collides as (points each, its frame), welded into one: a forklift's body
   * and forks, a rocking chair's seat and runners. Each part is a body of its own (the model drawn
   * on the first), held to the first by joints that never break; they move, rest and wake as one.
   */
  colliders?: V3[][];
  /** Most corners each of its hulls keeps (default Destruction's maxHullVertices; up to 32): more for round props that roll. */
  hullVertices?: number;
  /** Its mass (the solver's units: a 1 m cube of density 1 weighs 1). */
  mass: number;
  name?: string;
  /**
   * Where a copy's tint applies: 'alpha', as much as its colour map's alpha says (process-props.py's
   * `paint`); 'paint', on its materials named paint (a modelled car's). Default: everywhere.
   */
  tintMask?: 'alpha' | 'paint';
  /** The tint of a copy addProp gives none (its paint's colour, with a tint mask). Default white. */
  tint?: THREE.ColorRepresentation;
  /**
   * The pieces it breaks into (scripts/assets/shatter-props.py: the cells of its mesh, their cut
   * faces filled), each a prop of its own in its frame. Without them it never breaks: it's thrown,
   * tumbles and takes marks. With them a blast's heart or enough rounds (Destruction.breakProp)
   * swap it for them, flying apart.
   */
  shards?: PropModel[];
  /** Rounds of power 1 it takes before it breaks (default: as a piece of its material would, half its size). */
  rounds?: number;
  /** A piece of a prop that broke: rubble at rest that the budget clears, as any piece's. */
  debris?: boolean;
}

export interface PropOptions {
  model: PropModel;
  /** A key of the materials given to the Destruction (friction, sounds; its density is ignored). */
  material: string;
  position?: V3;
  rotation?: Q;
  /** Starts moving (default: at rest, until a blast or a strike wakes it). */
  loose?: boolean;
  /** Moving loose: at this velocity (m/s), turning at `spin` (rad/s). Default still. */
  velocity?: V3;
  spin?: V3;
  /** Colour multiplying this copy's (where its model's tint mask lets it: PropModel.tintMask). */
  tint?: THREE.ColorRepresentation;
}

/**
 * Something that breaks, standing as scenery until something reaches it (Destruction.addDormant, awaken): a
 * tower down the street, a house out of town, a ship in the bay. Drawn by its stand-in (a mesh, an
 * instance) and solid as its stand-in's fixed bodies until then; a blast or a round reaching it makes
 * it its pieces, and goes on into them.
 */
export interface DormantOptions {
  /** The box (world) it stands in: a blast reaching it, or a round entering it, wakes it. */
  bounds: Box3;
  /** Make its pieces, as build() makes a world's (addBox, addConvex...): called once, as it wakes. */
  build: (d: Destruction) => void;
  /** Its stand-in goes: an instance hidden, a mesh taken out of the scene. */
  hide?: () => void;
  /** The fixed bodies standing in for it: taken out of the world as it wakes. */
  bodies?: Body[];
  /** Woken with it (after it): what stands on it (a tower's storeys over these). */
  with?: Dormant[];
  /** Woken by blasts only: rounds strike its stand-in as scenery (a stretch of ground: each round would lay it). */
  blastOnly?: boolean;
  name?: string;
}

export class Dormant {
  readonly options: DormantOptions;
  /** Made into its pieces. */
  woken = false;

  constructor(options: DormantOptions) {
    this.options = options;
  }

  get bounds(): Box3 {
    return this.options.bounds;
  }
}

export interface PieceOptions {
  /** A key of the materials given to the Destruction. */
  material: string;
  /** The frame the shape is given in (default: the world's). */
  position?: V3;
  rotation?: Q;
  /** Never breaks or moves (foundations, unbreakable neighbours): holds up what's bonded to it. */
  static?: boolean;
  /**
   * Holds up what's bonded to it as the ground does, needing nothing under it (a platform's slabs
   * over the hollow its steps hide), but breaks as any piece: what it breaks into stands or falls
   * as pieces do.
   */
  anchor?: boolean;
  /** Colour multiplying the material's (per piece: one brick wall a little redder than the next). */
  tint?: THREE.ColorRepresentation;
  /**
   * The texture's frame (world; default: the piece's own frame), to line maps up across pieces. One
   * with a box (a piece's textureFrame, to make a piece again from it) is taken as it is: not
   * jittered (BreakableMaterial.uvJitter), its box what pieceFrame measures from, its smoothing kept.
   */
  textureFrame?: TextureFrame;
  /**
   * Shade faces meeting at less than this angle (radians) as one smooth surface (default 0: flat,
   * or the textureFrame's): a drum or a tank's shell rounds, its rims stay sharp. Its cells keep
   * it; broken faces stay flat.
   */
  smooth?: number;
  /** Starts loose (a prop standing on the structure, not part of it). */
  loose?: boolean;
  /**
   * Starts at rest, as rubble or a prop does: not part of what stands (nothing weighs on it, it
   * holds nothing up), on what's under it, or joined to what it's bonded to (Destruction.bond: a
   * car's window on its body), and wakes with that. It bonds to nothing by itself.
   */
  rest?: boolean;
  /**
   * Bond to the pieces it touches (default true). Or how loosely: faces up to `gap` apart (m) and
   * turned up to `angle` (rad) from facing each other bond too (a dome's pieces, tilted voussoirs);
   * its cells keep that. Default: Destruction's bondTolerance.
   */
  bond?: boolean | BondTolerance;
}

/** How far apart (m) and how far from facing each other (rad) two faces may be and still bond. */
export interface BondTolerance {
  /** Default 0.002. */
  gap?: number;
  /** Default 0.045 (about 2.6°). */
  angle?: number;
}

export interface DestructionOptions {
  world: World;
  /**
   * Where the material meshes go (each is added once its first piece is). Without one (or with a
   * world made without a renderer) nothing is drawn: the structures still stand and break.
   */
  scene?: THREE.Object3D | null;
  materials: Record<string, BreakableMaterial>;
  /** The ground's height: pieces resting on it are held up by it (null: no ground). Default 0. */
  ground?: number | null;
  /** Vertices each material's mesh can hold (default 400k). */
  capacity?: number;
  /**
   * Most pieces loose at once: past it the smallest are cleared (default 2500), but not props, nor
   * what hangs on a hinge (Destruction.hinge).
   */
  maxLoose?: number;
  /**
   * Most pieces in all (default Infinity): a budget for long sessions. Past it, rubble at rest
   * dissolves, a share of what's over at a time, each piece shrinking away into what it lies on:
   * what's out of the viewer's view before anything in it, and of each, what looks smallest from
   * them first (its size over its distance). What stands, props, and anything moving or hanging
   * never go, nor rubble with other rubble lying on it from above (that goes first), so the count
   * may stay over it while they're what there is.
   */
  maxPieces?: number;
  /** Seconds between readbacks of the loose pieces (default 0.1). */
  readInterval?: number;
  /** Seed for the fracture patterns. */
  seed?: number;
  /** Shadows on the material meshes (default true). */
  shadows?: boolean;
  /** Seconds between rounds of a collapse giving way (default 0.12). */
  cascade?: number;
  /**
   * Most corners a piece collides with (default 12; three-avbd's limit is 32): pieces with more
   * collide as a hull of that many, a little inside the piece drawn. Collision costs a pair edges
   * × edges, in one GPU thread, so a step waits on its most complex pair.
   */
  maxHullVertices?: number;
  /** Falling pieces heavier than this (density × volume) break what they strike hard enough (default 0.6). */
  heavy?: number;
  /** Most impacts broken per readback (default 6). */
  maxImpacts?: number;
  /**
   * Loose pieces heavier than this (density × volume) report what they strike as 'impact' events,
   * while something listens for them (default 0.02: a chunk of a few bricks). Reporting costs the
   * solver a little per piece, so pieces lighter than this land unheard.
   */
  audible?: number;
  /**
   * A big falling piece breaks when it lands with this change of speed or more (m/s: the impulse
   * of the contact over its mass; default 3). Infinity: falling pieces never break by themselves.
   * A material's `landing` says otherwise for its pieces.
   */
  shatterSpeed?: number;
  /**
   * The fastest a loose piece goes (m/s; default 40): blasts and breaks throw nothing faster, and
   * the world slows down what goes faster (it sets World.maxSpeed: a contact resolved hard can
   * fling a small piece at hundreds of m/s). Infinity: no limit.
   */
  maxSpeed?: number;
  /** How loosely pieces' faces bond (each piece may say otherwise: PieceOptions.bond). Default: 2 mm apart, 2.6° from facing. */
  bondTolerance?: BondTolerance;
  /**
   * Milliseconds of breaking a frame (default 4), shared by every blast, hit and bullet from one
   * update() to the next: they break what they can in that time and the rest over the next frames,
   * nearest first, so a big one (or many at once) doesn't stall a frame. Infinity: at once.
   */
  frameBudget?: number;
  /** Loose pieces falling below this height are taken out of the world (default: 50 m under the ground). */
  killBelow?: number;
  /**
   * Rolling resistance of loose pieces and props, a coefficient (default 0.02): on what it rests,
   * a piece's turning is slowed by a torque of this times the push it rests with times its
   * smallest half width, so a dropped baluster or drum rolls a little way and stops. Nothing in
   * the air. 0: they roll on.
   */
  rolling?: number;
  /**
   * Loose pieces further than this (m) from the world's centre (x 0, z 0, seen from above), or as
   * high above the ground, are taken out of the world (default 1000): what slides off the world or
   * is flung far doesn't keep the solver busy on its way to killBelow.
   */
  killBeyond?: number;
  /**
   * A bond asked to carry more than it can passes on to what's under it only what it holds (default
   * false: all of it). Then a support overloaded only by what's breaking off over it stands that
   * round, and gives way at the next only if what's left still overloads it: a rocket holes a roof
   * rather than bringing it down bay by bay. By default what fails drags down what it hung on, in
   * one round (a balcony whose posts went comes down whole; with this it may hang on as a shelf).
   */
  passHeldOnly?: boolean;
}

export interface ExplosionOptions {
  at: V3;
  /** Metres: pieces within it come loose; at its heart small pieces turn to dust. */
  radius: number;
  /** Throw (m/s at the centre, for a light piece). Default 12. */
  speed?: number;
  /** Spin (rad/s). Default 10. */
  spin?: number;
  /** Most new pieces this blast may make (default 600). */
  budget?: number;
  /** Cut the loose pieces it reaches too, as they fly (default false: they're only thrown). A rocket into a falling section. */
  loose?: boolean;
}

export interface DustEvent {
  at: V3;
  volume: number;
  material: string;
}

/** A piece thrown loose but too small to be a body (BreakableMaterial.minBodySize): draw it as particles. */
export interface DebrisEvent {
  at: V3;
  velocity: V3;
  volume: number;
  material: string;
}

/** A loose piece striking something: the ground, rubble, what still stands, another loose piece. */
export interface ImpactEvent {
  at: V3;
  /** The piece that struck (of two loose ones, the lighter: its speed changed the more). */
  piece: Piece;
  /** What it struck (null: the ground, or a body that isn't a piece). */
  other: Piece | null;
  /** How hard: the contact's impulse (mass × m/s). */
  impulse: number;
  /** The change of speed it caused the piece (m/s). */
  speed: number;
  /** The solver step it happened in, to spread what one readback brings back out in time. */
  step: number;
}

/**
 * A falling section (two or more pieces still bonded) or a heavy piece (Destruction.heavy) striking
 * the ground or the structure for the first time since it came loose: once for the whole, however
 * many of its pieces touch down (a container's boom, a wall slab's thud). Striking: moving into it
 * at 2 m/s or more; what it rested on as it was let go, and settling or sliding, don't count.
 */
export interface LandedEvent {
  /** Where (its touches' centre, weighted by how hard each struck). */
  at: V3;
  pieces: Piece[];
  /** Their mass together (density × volume). */
  mass: number;
  /**
   * How fast it struck (m/s): its pieces' speed as of the readback before (weighted by their mass;
   * up to a tenth of a second before, so a little short of it). One that struck before a readback
   * since it was let go: the change of speed its touches gave it, if more.
   */
  speed: number;
  /** The material of most of its mass. */
  material: string;
}

/**
 * A piece changing state: let go or thrown whole ('fixed' to 'loose'), come to rest ('loose' to
 * 'rubble'), woken ('rubble' to 'loose'), or gone (broken into cells, turned to dust, cleared).
 */
export interface StateEvent {
  piece: Piece;
  from: PieceState;
  to: PieceState;
}

/** A piece hung on a hinge (Destruction.hinge). */
export interface Hinge {
  readonly piece: Piece;
  /** It still holds: not broken, not removed, and what it hangs from still there. */
  readonly holding: boolean;
  /** Let the piece go. */
  remove(): void;
}

export interface ExplosionResult {
  /** Pieces it broke (gone now, replaced by their cells). */
  broken: number;
  /** Pieces it made. */
  made: Piece[];
  /** Pieces it threw loose, and the volume turned to dust. */
  loose: Piece[];
  dust: number;
  /**
   * Pieces that fell because what held them up went, once it had all been broken (with those of
   * other blasts done by then; the cascade after is in 'collapse' events).
   */
  collapsed: Piece[];
  /** Whether every piece it reached has been broken yet (see Destruction.frameBudget). */
  done: boolean;
}

/** A blast under way: the pieces it still has to break, nearest first. */
interface Job {
  o: ExplosionOptions;
  queue: Piece[];
  budget: number;
  result: ExplosionResult;
  /** The loose pieces it reached, cut as they fly. */
  loose: Set<Piece>;
  /** What it throws out of a breakable ground, held until all the ground it reached is broken (eject). */
  ejecta?: Array<{ piece: Piece; velocity: V3; spin: V3 }>;
  /** A bullet's: where it struck, and the face's normal there. The ground it reaches it bites (bite()). */
  bite?: { at: V3; normal: V3 };
}

/**
 * A section or heavy piece touching down since the last readback: its pieces, its touches' impulse
 * and where (weighted by it), and whether it had been read since it was let go.
 */
interface Touchdown {
  pieces: Piece[];
  impulse: number;
  weight: number;
  at: V3;
  seen: boolean;
}

/** The loose pieces by the grid cell their centre is in, and those reaching further than a cell from it (rest()). */
interface LooseCells {
  cells: Map<string, Piece[]>;
  big: Piece[];
  /** How far the others reach from their centre, and REST_GAP more. */
  reach: number;
}

/**
 * The loose pieces at rest as of the last readback, lowest first, while rest() has some left to look
 * at: how far it has got, those it has looked at (with their sections), what hangs, and the loose
 * pieces by grid cell (once needed).
 */
interface AtRest {
  order: Piece[];
  resting: Set<Piece>;
  next: number;
  seen: Set<Piece>;
  hanging: Set<Piece>;
  cells: LooseCells | null;
}

export interface RayHit {
  piece: Piece;
  point: V3;
  normal: V3;
  distance: number;
}

/** What a bullet struck (Destruction.shoot). */
export interface ShotHit extends RayHit {
  /** The piece's material. */
  material: string;
  /** It gave way: it breaks where it was struck (at once, or over the next frames within the breaking budget). */
  broke: boolean;
  /** How much of what it can take it has taken, 0–1 (1: it broke; 0: it never breaks, a prop or a static piece). */
  damage: number;
}

type Events = {
  dust: DustEvent;
  debris: DebrisEvent;
  collapse: { pieces: Piece[]; volume: number; center: V3 };
  fracture: { piece: Piece; pieces: Piece[]; at: V3 };
  /** Something dormant made into its pieces (its stand-in's fixed bodies gone from the world). */
  wake: { dormant: Dormant; pieces: Piece[] };
  bondBreak: { bond: Bond };
  impact: ImpactEvent;
  state: StateEvent;
  landed: LandedEvent;
};

const GRID = 2;
const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
/** Touches this close hold a piece up (m): resting pieces sink a little into what's under them. */
const REST_GAP = 0.03;
/** A touch holds a piece up when it pushes it up this much or more (its normal within ~70° of up). */
const UP = 0.35;
/** A slow piece that moves on further than this (m) is creeping, not still. */
const CREEP = 0.03;
/** A centre of mass this little out past what holds it up (m; and as much again per metre of its size) still rests. */
const BALANCE = 0.03;
/** Friction at the edge a leaning piece stands on: what it leans on must be 1/LEAN times its overhang above it. */
const LEAN = 0.6;
/** Seconds at rest after which a piece wedged among rubble, not quite over what holds it, stays there. */
const SETTLE = 2.5;
/** A prop's parts are welded by a bond of this area (m²): far stronger than anything pulls on it. */
export const WELD = 1e6;
/** A section or heavy piece moving into something slower than this (m/s) hasn't landed on it: it settles, slides or tips. */
const LAND = 2;
/** A section let go turns over the edge of what it rests on as if it had tipped this far already (rad). */
const TIP = 0.05;
/** The collision group of a jammed piece dropping clear of what it was jammed against. */
const JAMMED = 1 << 30;
/** Seconds a chunk thrown out of a breakable ground passes through the crater's sides (eject). */
const EJECT = 0.25;
/** A loose piece that stays within this (m) of where it was for HALT seconds has stopped, however it creeps or jitters. */
const DRIFT = 0.1;
const HALT = 6;
/** A joint of a section at rest bent further than this (rad) from as it stood is in tension: it gives way. */
const BEND = 0.07;
/** Nothing at all within this (m) under a piece's centre of mass (not the ground, the scenery, nor any piece): it's over a gap. */
const HOLLOW = 1;
/** A section's joint takes this (m) times its strength in energy when it lands: struck harder, it breaks. */
const TOUGH = 0.001;
/** Milliseconds a frame of looking at what has come to rest (rest()), and about what each piece of a section costs. */
const REST_MS = 2;
const PIECE_MS = 0.02;
/**
 * A bullet's bite out of a breakable ground (bite()): its cells, the biggest thrown whole as a chunk
 * where it's at least `chunk` times the bite's radius in size, to land about `throw` times the
 * radius away (the rest are spray, in at most `sprays` parts each); the seeds round it, `out` times
 * its radius away. A cell of what's left of the slab stands where it's at least `stand` times the
 * radius in size, and as thick and as wide across the ground as `thin` times it; one lying all
 * within `near` times the radius of the bite must also be as wide as `sliver` times its own length.
 * Else it's spray too.
 */
const BITE = { cells: 5, chunk: 1, throw: 4, sprays: 4, out: 1.6, near: 2, stand: 0.8, thin: 0.35, sliver: 0.25 };
/**
 * The piece budget (maxPieces): while over it, every `every` s a `share` of what's over starts to
 * dissolve (at least `least`, and no more than `most` dissolving at once), of the rubble at rest
 * `settled` s or more.
 */
const BUDGET = { every: 0.25, share: 0.1, least: 2, most: 32, settled: 3 };
/** Seconds a piece takes to shrink away (dissolve()). */
const DISSOLVE = 1.2;

/** Two unit vectors across unit `n`, at right angles to it and to each other, turned `angle` about it. */
function across(n: V3, angle = 0): [V3, V3] {
  const a = normalize(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const b = cross(n, a);
  const u = add(scale(a, Math.cos(angle)), scale(b, Math.sin(angle)));
  return [u, cross(n, u)];
}

/**
 * How a cell of a breakable ground lies: how wide it is across the ground (seen from above) and how
 * long, and how thick it is. Wide and thick are twice how deep its centre lies, from its nearest
 * side and from its nearest face of all (a wedge's centre lies near its long sides: narrow for its
 * length; a plate's near its top and bottom); long is its bounds' diagonal.
 */
function plan(c: Convex, centre: V3): { wide: number; long: number; thick: number } {
  let side = Infinity;
  let any = Infinity;
  for (const f of c.faces) {
    const depth = f.d - dot(f.n, centre);
    any = Math.min(any, depth);
    if (Math.abs(f.n[1]) < 0.7) side = Math.min(side, depth);
  }
  const b = bounds(c);
  return { wide: 2 * side, long: Math.hypot(b.max[0] - b.min[0], b.max[2] - b.min[2]), thick: 2 * any };
}

/** x with m·x = b, for the 3×3 matrix of rows m (zero if it has no inverse). */
function solve(m: [V3, V3, V3], b: V3): V3 {
  const [c0, c1, c2] = [cross(m[1], m[2]), cross(m[2], m[0]), cross(m[0], m[1])];
  const det = dot(m[0], c0);
  if (Math.abs(det) < 1e-12) return [0, 0, 0];
  return scale(add(add(scale(c0, b[0]), scale(c1, b[1])), scale(c2, b[2])), 1 / det);
}

export class Destruction {
  readonly world: World;
  readonly scene: THREE.Object3D | null;
  readonly materials: Record<string, BreakableMaterial>;
  readonly ground: number | null;
  /** The breakable grounds laid (addGround): within each's area the ground is its bed. */
  readonly grounds: Ground[] = [];
  readonly maxLoose: number;
  /** Most pieces in all (DestructionOptions.maxPieces; a world may set it in build()). */
  maxPieces: number;
  /**
   * Where the player looks from: past maxPieces, what's farthest from it and out of its view goes
   * first. Default: the first camera in the scene, once there's one.
   */
  viewer: THREE.Camera | null = null;
  readonly readInterval: number;
  private readonly capacity: number;
  private readonly shadows: boolean;
  private readonly meshes = new Map<string, FragmentMesh>();
  /** Per prop model: its hull, as a convex and as the solver's shape, and its mesh. */
  private readonly props = new Map<PropModel, { convex: Convex; shape: HullShape; density: number; mesh: PropMesh | null; parts: Array<{ convex: Convex; shape: HullShape }> }>();
  /** The GPU push for loose pieces (none headless, without a device that computes). */
  private readonly blast: BlastPass | null;
  private readonly rand: () => number;
  private readonly grid = new Map<string, Set<Piece>>();
  private readonly gridCells = new Map<Piece, string[]>();
  private readonly pieces = new Set<Piece>();
  private readonly loose = new Set<Piece>();
  /** The rubble (what's at rest, props too), kept as it changes: what the budget and the clearing look at. */
  private readonly rubble = new Set<Piece>();
  /** Pieces shrinking away (dissolve()): since when, their faces as drawn, and the point they shrink to (body frame). */
  private readonly dissolving = new Map<Piece, { since: number; faces: DrawFace[] | null; foot: V3 }>();
  /** When the budget is next looked at. */
  private budgetAt = 0;
  private readonly jointBonds = new Map<Joint, Bond>();
  private readonly byBody = new Map<Body, Piece>();
  /** Hits from falling pieces seen at the last readback, to break what they struck. */
  private readonly impacts: Array<{ at: V3; impulse: number; struck: Piece }> = [];
  /** Falling pieces that landed hard enough to break, and where. */
  private readonly landings: Array<{ piece: Piece; at: V3; impulse: number }> = [];
  private readonly listeners: { [K in keyof Events]: Set<(e: Events[K]) => void> } = { dust: new Set(), debris: new Set(), collapse: new Set(), fracture: new Set(), wake: new Set(), bondBreak: new Set(), impact: new Set(), state: new Set(), landed: new Set() };
  /** Sections and heavy pieces touching down since the last readback, each piece's whole's tally ('landed'). */
  private readonly touching = new Map<Piece, Touchdown>();
  /**
   * Loose pieces' velocities at the last readback, while something listens for 'landed': whether a
   * touch at the next is a strike, and how fast. None until a readback since it was let go.
   */
  private readonly velocities = new WeakMap<Piece, V3>();
  /** Pieces whose section has landed since they came loose. */
  private readonly landed = new WeakSet<Piece>();
  /** Pieces of a falling section that have struck something since they came loose. */
  private readonly struck = new WeakSet<Piece>();
  /** Those striking for the first time since the last readback: the way into what each struck, and how fast (crack()). */
  private readonly cracking = new Map<Piece, { into: V3; speed: number }>();
  /** When a loose piece's pose was where it was: the time its readback was taken, or it was let go. */
  private readonly posed = new WeakMap<Piece, number>();
  /** What goes when a piece goes (removePiece): a prop's other parts, a hinge's hold on the world. */
  private readonly attached = new WeakMap<Piece, Array<() => void>>();
  /**
   * The hinges a piece hangs on, and what each hangs from (null: the world): it never comes to rest
   * while one holds it to what stands, or to what hangs from that (hanging()).
   */
  private readonly hinges = new WeakMap<Piece, Array<{ hinge: Hinge; from: Piece | null }>>();
  /** The pieces put on hinges (still there). */
  private readonly hinged = new Set<Piece>();
  /** Pieces that bond more loosely than bondTolerance (PieceOptions.bond), and their cells. */
  private readonly tolerances = new WeakMap<Piece, { gap: number; angle: number }>();
  readonly bondTolerance: { gap: number; angle: number };
  /** The widest gap any piece bonds across (bondTolerance's or a piece's): how far to look for neighbours. */
  private widestGap: number;
  /** The furthest any material breaks, as a share of a blast's radius. */
  private readonly maxReach: number;
  /** When the structure is next weighed (after a change; -1: it stands as it is). */
  private weighAt = 0;
  /** Seconds between rounds of giving way, so a collapse cascades rather than drops all at once. */
  readonly cascade: number;
  readonly heavy: number;
  readonly audible: number;
  readonly maxImpacts: number;
  readonly shatterSpeed: number;
  readonly maxSpeed: number;
  /** Rolling resistance (DestructionOptions.rolling). */
  readonly rolling: number;
  frameBudget: number;
  readonly maxHullVertices: number;
  /** Loose pieces below this height are taken out of the world (DestructionOptions.killBelow; a world may set it in build()). */
  killBelow: number;
  /** Loose pieces this far from the world's centre, or as high above the ground, are taken out (DestructionOptions.killBeyond). */
  killBeyond: number;
  /** A bond giving way passes on only what it holds (DestructionOptions.passHeldOnly). */
  readonly passHeldOnly: boolean;
  private readonly jobs: Job[] = [];
  /** The bullets each piece has taken (shoot): it breaks once they pass what it can take. */
  private readonly damage = new WeakMap<Piece, number>();
  /** Milliseconds of breaking done since the last update (frameBudget is for all of it). */
  private spent = 0;
  /** How long the last pass over the structure at the end of blasts took (ms). */
  private settleMs = 0;
  /** What the last readback found at rest, while rest() has some left to look at. */
  private atRestNow: AtRest | null = null;
  /** reinforce()'s margin: a bond's extra strength is gone once it carries that many times its as-built load. */
  private margin = 1.5;
  /** reinforce() is weighing what's built, to remember it. */
  private recording = false;
  /** While recording, only these pieces' overhangs as built are taken (a dormant's, waking: the rest keep theirs). */
  private recordFor: Set<Piece> | null = null;
  private readonly dormants: Dormant[] = [];
  /** What's dormant by where it stands seen from above (DORMANT_CELL m cells): what's let go finds what rested on it there. */
  private readonly dormantCells = new Map<string, Dormant[]>();
  /** Where fixed pieces gave way since the last update: what's dormant on them wakes. */
  private readonly unheld = new Set<Box3>();
  /** reinforce() is at work: every bond passes on all its weight (it's strengthened for that). */
  private reinforcing = false;
  /** The weighing's: the bonds a piece stands on (tips()). */
  private readonly stands: Bond[] = [];
  /** Fixed bodies that aren't pieces (the ground, steps, a quay), as convexes: what rests on them is held up. */
  private sceneryShapes: Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }> | null = null;
  private sceneryGrid: { shapes: Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }>; cells: Map<string, Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }>>; big: Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }> } | null = null;
  /**
   * Jammed pieces dropping clear, each to its jam: the pieces jammed together (a section, a prop's
   * parts), their own collision groups, what they pass through, and until when at most.
   */
  private readonly jams = new Map<Piece, { pieces: Piece[]; groups: number[]; through: Piece[]; until: number }>();
  /** Standing pieces that jammed pieces pass through: by how many, and what they collided with before. */
  private readonly passed = new Map<Piece, { count: number; mask: number }>();
  private nextId = 1;
  private time = 0;
  private lastRead = 0;
  private reading: Promise<void> | null = null;

  constructor(options: DestructionOptions) {
    this.world = options.world;
    this.scene = options.world.bodyAttribute ? (options.scene ?? null) : null;
    this.materials = options.materials;
    this.ground = options.ground === undefined ? 0 : options.ground;
    this.capacity = options.capacity ?? 400_000;
    this.maxLoose = options.maxLoose ?? 2500;
    this.maxPieces = options.maxPieces ?? Infinity;
    this.readInterval = options.readInterval ?? 0.1;
    this.shadows = options.shadows ?? true;
    this.cascade = options.cascade ?? 0.12;
    this.heavy = options.heavy ?? 0.6;
    this.audible = options.audible ?? 0.02;
    this.maxImpacts = options.maxImpacts ?? 6;
    this.shatterSpeed = options.shatterSpeed ?? 3;
    this.maxSpeed = options.maxSpeed ?? 40;
    this.world.maxSpeed = this.maxSpeed;
    this.bondTolerance = { gap: options.bondTolerance?.gap ?? TOUCH, angle: options.bondTolerance?.angle ?? FACING };
    this.widestGap = this.bondTolerance.gap;
    this.frameBudget = options.frameBudget ?? 4;
    this.killBelow = options.killBelow ?? (this.ground ?? 0) - 50;
    this.rolling = options.rolling ?? 0.02;
    this.killBeyond = options.killBeyond ?? 1000;
    this.passHeldOnly = options.passHeldOnly ?? false;
    this.maxHullVertices = options.maxHullVertices ?? 12;
    this.rand = random(options.seed ?? 1234);
    this.maxReach = Math.max(1, ...Object.values(this.materials).map((m) => m.reach ?? 1));
    this.blast = typeof this.world.device?.createComputePipeline === 'function' ? new BlastPass(this.world) : null;
    // A heavy falling piece striking what still stands breaks it where it struck; one landing hard
    // enough breaks itself; a section or a heavy piece touching down says so ('landed')
    this.world.onContact((e) => {
      if (e.type !== 'begin') return;
      const a = this.byBody.get(e.a) ?? null;
      const b = this.byBody.get(e.b) ?? null;
      let heard: Piece | null = null;
      // The normal is from b toward a: `into` is the way into what the moving one struck
      for (const [moving, struck, into] of [
        [a, b, -1],
        [b, a, 1],
      ] as const) {
        if (moving?.state !== 'loose') continue;
        const mass = moving.mass;
        const m = moving.material;
        const speed = e.impulse / mass;
        if (!heard || mass < heard.mass) heard = moving;
        if (struck?.state !== 'loose') this.touchdown(moving, e.point as V3, e.impulse, scale(e.normal as V3, into));
        // Landing hard breaks it (what it hit may be the ground, not a piece): any piece of a
        // material that says how hard, else big heavy ones
        const breaks = m.landing !== undefined ? speed > m.landing && moving.size > m.minSize * 1.5 : mass > this.heavy && moving.size > m.minSize * 2.5 && speed > this.shatterSpeed;
        if (breaks) this.landings.push({ piece: moving, at: e.point as V3, impulse: e.impulse });
        if (mass <= this.heavy) continue;
        if (struck?.state === 'fixed' && !struck.isStatic && e.impulse > struck.material.impact) this.impacts.push({ at: e.point as V3, impulse: e.impulse, struck });
      }
      if (heard && this.listeners.impact.size) {
        const other = heard === a ? b : a;
        this.emit('impact', { at: e.point as V3, piece: heard, other, impulse: e.impulse, speed: e.impulse / heard.mass, step: e.step });
      }
    });
    this.world.onBreak((joint) => {
      const bond = this.jointBonds.get(joint);
      if (!bond) return;
      this.jointBonds.delete(joint);
      bond.joint = null;
      this.unbond(bond);
      this.emit('bondBreak', { bond });
    });
  }

  // --- Building ------------------------------------------------------------------------------

  /** A box of full widths `size`, centred at `position` (turned by `rotation`). */
  addBox(options: PieceOptions & { size: V3 }): Piece | null {
    const pose: Pose = { position: options.position ?? [0, 0, 0], rotation: options.rotation ?? [0, 0, 0, 1] };
    return this.addPiece(boxConvex(options.size), pose, options, options.textureFrame ?? pose);
  }

  /** The convex hull of points (given in the frame of `position` and `rotation`). */
  addConvex(options: PieceOptions & { points: V3[] }): Piece | null {
    const frame: Pose = { position: options.position ?? [0, 0, 0], rotation: options.rotation ?? [0, 0, 0, 1] };
    const c = hullConvex(options.points);
    if (!c) return null;
    return this.addPiece(transform(c, frame.position, frame.rotation), null, options, options.textureFrame ?? frame);
  }

  /**
   * A breakable ground (ground.ts): slabs of `material` over an optional layer `under`, laid over
   * `area` down from `top` onto the world's fixed bed (its ground body, moved down to `bed`). A blast
   * leaves a crater, throwing the chunks up and out to land round it; each slab is held up by what's
   * under it, never by the slabs beside it. What stands on a slab (built before or after) bonds to it.
   */
  addGround(options: GroundOptions): Ground {
    const ground = layGround(this, options);
    this.grounds.push(ground);
    return ground;
  }

  /** The ground's height at (x, z): a breakable ground's bed within its area, else `ground` (null: none). */
  groundAt(x: number, z: number): number | null {
    for (const g of this.grounds) if (g.contains(x, z)) return g.bed;
    return this.ground;
  }

  /**
   * A prop: `model` drawn on a body of its collider's hull, at rest (fixed, like settled rubble)
   * until a blast or a strike throws it. Props never break: they're thrown, tumble and land whole.
   */
  addProp(options: PropOptions): Piece | null {
    const { model } = options;
    if (!this.materials[options.material]) throw new Error(`Destruction: no material '${options.material}'`);
    let look = this.props.get(model);
    if (!look) {
      // Its hulls (one, or its parts'): the model is drawn on the first
      const parts = (model.colliders ?? [model.collider]).map((points) => {
        const convex = hullConvex(points);
        const shape = convex && hullShape(convex, model.hullVertices ?? this.maxHullVertices);
        if (!convex || !shape) throw new Error(`Destruction: prop ${model.name ?? ''} has a part with no volume`);
        return { convex, shape };
      });
      const [{ convex, shape }] = parts;
      let mesh: PropMesh | null = null;
      if (this.scene) {
        // The model's frame to its body's (the hull's centre of mass, on its principal axes)
        const toBody = new THREE.Matrix4().compose(new THREE.Vector3(...shape.center), new THREE.Quaternion(...shape.rotation), new THREE.Vector3(1, 1, 1)).invert();
        mesh = new PropMesh(this.world, model.object, toBody, { shadows: this.shadows, tintMask: model.tintMask });
        mesh.name = `breakable:prop:${model.name ?? ''}`;
        this.scene.add(mesh);
      }
      const volume = parts.reduce((sum, p) => sum + volumeCentroid(p.convex).volume, 0);
      look = { convex, shape, density: model.mass / volume, mesh, parts: parts.slice(1) };
      this.props.set(model, look);
    }
    const frame: Pose = { position: options.position ?? [0, 0, 0], rotation: options.rotation ?? [0, 0, 0, 1] };
    const tint = new THREE.Color(options.tint ?? model.tint ?? 0xffffff);
    const state = options.loose ? 'loose' : 'rubble';
    const [velocity, spin] = options.loose ? [options.velocity, options.spin] : [];
    const piece = this.create(look.convex, null, options.material, frame, [tint.r, tint.g, tint.b], state, false, velocity, spin, { model, frame });
    if (!piece) return null;
    // Its other parts, welded to it: they move, rest and wake with it, and go when it goes
    const parts = [piece];
    for (const part of look.parts) {
      const p = this.create(part.convex, null, options.material, frame, [tint.r, tint.g, tint.b], state, false, velocity, spin, { model, frame, part: part.shape });
      if (!p) continue;
      this.bond(piece, p, WELD);
      parts.push(p);
    }
    if (parts.length > 1) for (const p of parts) this.attached.set(p, [...(this.attached.get(p) ?? []), () => parts.forEach((q) => this.removePiece(q))]);
    // At rest on what's under it, it wakes when that goes (reinforce() looks again, once all is built)
    if (state === 'rubble') {
      const { under } = this.support(parts);
      for (const p of parts) this.link(p, under.get(p)!);
    }
    return piece;
  }

  /** Something that breaks, standing as scenery until a blast or a round reaches it (DormantOptions). */
  addDormant(options: DormantOptions): Dormant {
    const dormant = new Dormant(options);
    this.dormants.push(dormant);
    const { min, max } = dormant.bounds;
    for (let i = Math.floor(min[0] / DORMANT_CELL); i <= Math.floor(max[0] / DORMANT_CELL); i++)
      for (let k = Math.floor(min[2] / DORMANT_CELL); k <= Math.floor(max[2] / DORMANT_CELL); k++) {
        const key = `${i},${k}`;
        const list = this.dormantCells.get(key);
        if (list) list.push(dormant);
        else this.dormantCells.set(key, [dormant]);
      }
    return dormant;
  }

  /**
   * A dormant thing made into its pieces now: its stand-in goes (its fixed bodies out of the world),
   * its pieces are built and strengthened to stand as they're built (as reinforce() does, for them
   * alone), and what rested on its stand-in rests on them. The pieces made.
   */
  awaken(dormant: Dormant): Piece[] {
    if (dormant.woken) return [];
    dormant.woken = true;
    const first = this.nextId;
    for (const b of dormant.options.bodies ?? []) if (b.alive) b.remove();
    dormant.options.hide?.();
    // What stood on its stand-in looks again at what it stands on (its pieces, once they're made)
    const top = dormant.bounds.max[1];
    for (const p of this.pieces) if (p.grounded && Math.abs(p.bounds.min[1] - top) < 0.03 && boxesOverlap(p.bounds, dormant.bounds, 0.01)) p.grounded = null;
    dormant.options.build(this);
    // (Its stand-in has gone from the scenery, and what it's built on may be scenery its build put
    // in the world: a patch of a hill)
    this.refreshScenery();
    const made = [...this.pieces].filter((p) => p.id >= first);
    this.reinforceSome(made);
    this.emit('wake', { dormant, pieces: made });
    for (const other of dormant.options.with ?? []) made.push(...this.awaken(other));
    return made;
  }

  /**
   * Wake what's dormant along a ray from `at` (all but the blastOnly), nearest first, within `range`
   * or as far as the first piece it meets: each woken, the ray is cast again into its pieces, and
   * goes on to the next only if it passes through them (a gap, a doorway). What it meets, as
   * raycast(). A projectile's flight calls it each step, so it meets what stood as scenery.
   */
  wakeAlong(at: V3, direction: V3, range: number): RayHit | null {
    const dir = normalize(direction);
    let hit = this.raycast(at, dir, range);
    if (!this.dormants.length) return hit;
    for (let n = 0; n < 8; n++) {
      const asleep = this.dormantIn(null, { at, dir, range: hit?.distance ?? range })[0];
      if (!asleep) break;
      this.awaken(asleep);
      hit = this.raycast(at, dir, range);
    }
    return hit;
  }

  /** The dormant things a box reaches, and those a ray enters within `range` (nearest first). */
  private dormantIn(box: Box3 | null, ray?: { at: V3; dir: V3; range: number }): Dormant[] {
    const out: Array<{ d: Dormant; t: number }> = [];
    for (const d of this.dormants) {
      if (d.woken) continue;
      if (box && boxesOverlap(box, d.bounds, 0)) out.push({ d, t: 0 });
      else if (ray && !d.options.blastOnly) {
        const t = rayBox(ray.at, ray.dir, d.bounds);
        if (t !== null && t <= ray.range) out.push({ d, t });
      }
    }
    return out.sort((a, b) => a.t - b.t).map((o) => o.d);
  }

  /** reinforce() for pieces just made (a dormant thing's): their bonds strengthened, their overhangs as built taken. */
  private reinforceSome(made: Piece[]): void {
    if (!made.length) return;
    const set = new Set(made);
    for (const p of made) p.builtOverhang = -1;
    // What they're joined to, all of it: loads go no further, so the rest isn't weighed again (a
    // shrub woken among 8,000 pieces took 60 ms weighing them all seven times)
    const joined = new Set(made.filter((p) => p.state === 'fixed'));
    const stack = [...joined];
    while (stack.length) {
      const p = stack.pop()!;
      for (const b of p.bonds) {
        const q = b.other(p);
        if (q.state === 'fixed' && !joined.has(q)) {
          joined.add(q);
          stack.push(q);
        }
      }
    }
    this.reinforcing = true;
    for (let round = 0; round < 6; round++) {
      this.weigh(joined);
      let changed = 0;
      for (const p of made)
        for (const b of p.bonds) {
          // (Each bond once: by its first piece, or by the made one when the other is older)
          if (b.a !== p && set.has(b.a)) continue;
          if (b.load * this.margin <= 1) continue;
          b.strength *= b.load * this.margin;
          changed++;
        }
      if (!changed) break;
    }
    this.recording = true;
    this.recordFor = set;
    this.weigh(joined);
    this.recording = this.reinforcing = false;
    this.recordFor = null;
    for (const p of made) for (const b of p.bonds) b.builtLoad = b.force;
    // What rested on its stand-in rests on its pieces now
    const box = made.reduce((acc, p) => ({ min: [0, 1, 2].map((k) => Math.min(acc.min[k], p.bounds.min[k])) as V3, max: [0, 1, 2].map((k) => Math.max(acc.max[k], p.bounds.max[k])) as V3 }), { min: [Infinity, Infinity, Infinity] as V3, max: [-Infinity, -Infinity, -Infinity] as V3 });
    for (const p of this.rubble)
      if (!set.has(p) && boxesOverlap(p.bounds, box, 0.5)) {
        this.unlink(p);
        this.link(p, this.support([p]).under.get(p)!);
      }
  }

  /**
   * A piece from a convex: with `pose`, `c` is in that body frame (a box at its centre); else it's
   * in the world and the body sits at its centre of mass on its principal axes.
   */
  private addPiece(c: Convex, pose: Pose | null, options: PieceOptions, textureWorld: TextureFrame): Piece | null {
    const material = this.materials[options.material];
    if (!material) throw new Error(`Destruction: no material '${options.material}'`);
    const tint = new THREE.Color(options.tint ?? 0xffffff);
    let frame: TextureFrame = { ...textureWorld, smooth: options.smooth ?? textureWorld.smooth };
    // A frame with its box is a piece's, already placed (and jittered once)
    if (material.uvJitter && !textureWorld.box) frame = jitterFrame(frame, material.uvScale, material.uvJitter, this.rand);
    const piece = this.create(c, pose, options.material, frame, [tint.r, tint.g, tint.b], options.loose ? 'loose' : options.rest ? 'rubble' : 'fixed', options.static ?? false);
    if (!piece) return null;
    piece.anchor = options.anchor ?? false;
    if (piece.state === 'rubble') {
      this.link(piece, this.support([piece]).under.get(piece)!);
      return piece;
    }
    if (typeof options.bond === 'object') {
      const tolerance = { gap: options.bond.gap ?? this.bondTolerance.gap, angle: options.bond.angle ?? this.bondTolerance.angle };
      this.tolerances.set(piece, tolerance);
      this.widestGap = Math.max(this.widestGap, tolerance.gap);
    }
    if (piece.state === 'fixed' && options.bond !== false) {
      // As far as any piece bonds across: a neighbour may bond more loosely than this one (tryBond takes the looser)
      for (const other of this.near(piece.bounds, Math.max(TOUCH, this.widestGap))) {
        if (other === piece || other.state !== 'fixed') continue;
        this.tryBond(piece, other);
      }
    }
    return piece;
  }

  /**
   * Bond two standing pieces that don't touch face to face (a bracket bolted on, a stair's foot on
   * its landing): `area` m² of bond (what it carries scales with it), at `at` (default: midway
   * between the nearest points of their bounds), where the joint goes if they fall together. Two
   * loose pieces are held by that joint at once, as they are now.
   */
  bond(a: Piece, b: Piece, area = 0.02, at?: V3): Bond {
    const ca = volumeCentroid(a.convex).centroid;
    const cb = volumeCentroid(b.convex).centroid;
    const clampTo = (p: V3, box: Box3): V3 => [0, 1, 2].map((k) => Math.min(box.max[k], Math.max(box.min[k], p[k]))) as V3;
    const center = at ?? scale(add(clampTo(cb, a.bounds), clampTo(ca, b.bounds)), 0.5);
    const bond = new Bond(a, b, area, center, normalize(sub(cb, ca)));
    a.bonds.add(bond);
    b.bonds.add(bond);
    if (a.state === 'loose' && b.state === 'loose') this.join(bond);
    return bond;
  }

  /**
   * Hang a piece on a hinge (a sign from its bracket, a batwing door, a bell): it comes loose and
   * swings about `axis` through `anchor` (world), held to `to` (a piece: the hinge goes where it
   * goes, and with it) or to the world, until a pull of `breakForce` (N; default: never) tears it.
   * Two ball joints on the axis, as far apart as the piece reaches along it, make the hinge.
   */
  hinge(piece: Piece, anchor: V3, axis: V3, options: { to?: Piece; breakForce?: number } = {}): Hinge {
    this.loosen(piece);
    const a = normalize(axis);
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of piece.corners) {
      const t = dot(sub(p, anchor), a);
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    const half = Math.max((hi - lo) / 2, 0.05);
    // Held to a piece, or to a fixed body at the anchor that collides with nothing
    const hold = options.to ?? null;
    const holder = hold?.body ?? this.world.addBox({ size: [0.01, 0.01, 0.01], position: anchor, fixed: true, group: 0, collidesWith: 0 });
    if (!holder) throw new Error('Destruction.hinge: the world is full');
    const at: Pose = hold?.pose ?? { position: anchor, rotation: [0, 0, 0, 1] };
    const joints = [(lo + hi) / 2 - half, (lo + hi) / 2 + half].map((t) => {
      const p = add(anchor, scale(a, t));
      return this.world.addJoint(holder, piece.body, {
        type: 'ball',
        anchorA: toLocal(at.position, at.rotation, p),
        anchorB: toLocal(piece.pose.position, piece.pose.rotation, p),
        ...(options.breakForce !== undefined ? { breakForce: options.breakForce, breakOnPull: true } : {}),
      });
    });
    let removed = false;
    const remove = () => {
      removed = true;
      for (const j of joints) j.remove();
      if (!hold && holder.alive) holder.remove();
    };
    if (!hold) this.attached.set(piece, [...(this.attached.get(piece) ?? []), remove]);
    const hinge: Hinge = {
      piece,
      get holding() {
        // Not removed or torn, and neither the piece nor what it hangs from gone (their joints go with them)
        return !removed && !joints.some((j) => j.broken) && piece.state !== 'gone' && (!hold || hold.state !== 'gone');
      },
      remove,
    };
    // While it holds it to what stands (or hangs), the piece swings: it never freezes as rubble (afterRead)
    this.hinges.set(piece, [...(this.hinges.get(piece) ?? []), { hinge, from: hold }]);
    this.hinged.add(piece);
    return hinge;
  }

  /**
   * What hangs: the pieces on a hinge that still holds them to the world, to a piece that stands or
   * to one that hangs itself (a cable's links, a lantern on the last), and what they're joined to (a
   * sign's lettering). They swing and never come to rest, and the loose cap leaves them.
   */
  private hanging(): Set<Piece> {
    const out = new Set<Piece>();
    // Round after round while more is found: a chain's links in any order
    for (let more = true; more; ) {
      more = false;
      for (const p of this.hinged) {
        if (p.state !== 'loose' || out.has(p) || !this.hinges.get(p)!.some(({ hinge, from }) => hinge.holding && (!from || from.state === 'fixed' || out.has(from)))) continue;
        for (const q of this.groupOf(p, 'loose')) out.add(q);
        more = true;
      }
    }
    return out;
  }

  /** How far apart and how far from facing each other a piece's faces may be and still bond. */
  private toleranceOf(piece: Piece): { gap: number; angle: number } {
    return this.tolerances.get(piece) ?? this.bondTolerance;
  }

  /** Bond two standing pieces if they touch face to face (within the looser of their tolerances). */
  private tryBond(a: Piece, b: Piece): Bond | null {
    const [ta, tb] = [this.toleranceOf(a), this.toleranceOf(b)];
    const gap = Math.max(ta.gap, tb.gap);
    if (!boxesOverlap(a.bounds, b.bounds, gap)) return null;
    const patch = contactPatch(a.convex, b.convex, gap, Math.max(ta.angle, tb.angle));
    if (!patch || patch.area < 1e-5) return null;
    // A breakable ground's pieces bond to what's over and under them, never to anything else beside them
    if (a.ground !== b.ground && Math.abs(patch.normal[1]) < 0.7) return null;
    const bond = new Bond(a, b, patch.area, patch.center, patch.normal);
    a.bonds.add(bond);
    b.bonds.add(bond);
    return bond;
  }

  /** Make a piece's body, drawing and bookkeeping. `pose` null: the body goes on the principal axes. */
  private create(c: Convex, pose: Pose | null, materialName: string, textureWorld: TextureFrame, tint: V3, state: PieceState, isStatic: boolean, velocity?: V3, spin?: V3, prop?: { model: PropModel; frame: Pose; part?: HullShape }): Piece | null {
    const material = this.materials[materialName];
    const { volume } = volumeCentroid(c);
    if (!(volume > 1e-7)) return null;
    const look = prop ? this.props.get(prop.model)! : null;
    const density = look?.density ?? material.density;
    const fixed = state !== 'loose';
    let body: Body | null;
    let local: Convex;
    let at: Pose;
    if (pose) {
      // A box in its own frame
      const b = bounds(c);
      const size: V3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
      body = this.world.addBox({ size, position: pose.position, rotation: pose.rotation, density, friction: material.friction, rolling: this.rolling, fixed, velocity, angularVelocity: spin });
      local = c;
      at = pose;
    } else {
      // `c` is in the world, or in a prop's frame (its hull made once, for every copy)
      const shape = prop?.part ?? look?.shape ?? hullShape(c, this.maxHullVertices);
      if (!shape) return null;
      const f = prop?.frame ?? { position: [0, 0, 0] as V3, rotation: [0, 0, 0, 1] as Q };
      at = { position: toWorld(f.position, f.rotation, shape.center as V3), rotation: multiply(f.rotation, shape.rotation as Q) };
      body = this.world.addHull({ shape, position: f.position, rotation: f.rotation, density, friction: material.friction, rolling: this.rolling, fixed, velocity, angularVelocity: spin });
      // Its faces in the body's frame
      const inShape = { position: shape.center as V3, rotation: shape.rotation as Q };
      const inv = conjugate(inShape.rotation);
      local = {
        faces: c.faces.map((face) => {
          const pts = face.pts.map((p) => toLocal(inShape.position, inShape.rotation, p));
          const n = rotate(inv, face.n);
          return { pts, n, d: dot(n, pts[0]), inner: face.inner };
        }),
      };
    }
    if (!body) return null;
    // Its texture frame in its body's, with its box as built (a cell keeps its piece's)
    const texture: TextureFrame = { position: toLocal(at.position, at.rotation, textureWorld.position), rotation: multiply(conjugate(at.rotation), textureWorld.rotation), smooth: textureWorld.smooth };
    texture.box = textureWorld.box ?? frameBox(local.faces, texture);
    const piece = new Piece(this.nextId++, materialName, material, local, volume, body, at, state, isStatic, texture, tint, density, prop?.model ?? null);
    if (look) {
      // A prop is drawn on its first part
      if (!prop?.part) look.mesh?.show(body.index, tint);
    } else if (this.scene) piece.draw = this.meshFor(materialName).insert(body.index, drawFaces(local.faces, texture, material.uvScale), tint, texture, state);
    this.pieces.add(piece);
    this.byBody.set(body, piece);
    if (state === 'loose') {
      this.watch(piece);
      this.loose.add(piece);
    } else this.index(piece);
    if (state === 'rubble') this.rubble.add(piece);
    return piece;
  }

  private meshFor(name: string): FragmentMesh {
    let mesh = this.meshes.get(name);
    if (!mesh) {
      const m = this.materials[name];
      mesh = new FragmentMesh(this.world, m.surface, m, this.capacity);
      mesh.castShadow = mesh.receiveShadow = this.shadows;
      mesh.name = `breakable:${name}`;
      this.meshes.set(name, mesh);
      this.scene!.add(mesh);
    }
    return mesh;
  }

  // --- The spatial index (standing pieces: fixed and rubble) --------------------------------

  private index(piece: Piece): void {
    const b = piece.bounds;
    const keys: string[] = [];
    for (let x = Math.floor(b.min[0] / GRID); x <= Math.floor(b.max[0] / GRID); x++)
      for (let y = Math.floor(b.min[1] / GRID); y <= Math.floor(b.max[1] / GRID); y++)
        for (let z = Math.floor(b.min[2] / GRID); z <= Math.floor(b.max[2] / GRID); z++) {
          const k = cellKey(x, y, z);
          let set = this.grid.get(k);
          if (!set) this.grid.set(k, (set = new Set()));
          set.add(piece);
          keys.push(k);
        }
    this.gridCells.set(piece, keys);
  }

  private unindex(piece: Piece): void {
    for (const k of this.gridCells.get(piece) ?? []) {
      const set = this.grid.get(k);
      set?.delete(piece);
      if (set && !set.size) this.grid.delete(k);
    }
    this.gridCells.delete(piece);
  }

  /** Standing pieces whose bounds come within `margin` of the box. */
  private near(b: Box3, margin = 0): Set<Piece> {
    const out = new Set<Piece>();
    for (let x = Math.floor((b.min[0] - margin) / GRID); x <= Math.floor((b.max[0] + margin) / GRID); x++)
      for (let y = Math.floor((b.min[1] - margin) / GRID); y <= Math.floor((b.max[1] + margin) / GRID); y++)
        for (let z = Math.floor((b.min[2] - margin) / GRID); z <= Math.floor((b.max[2] + margin) / GRID); z++)
          for (const p of this.grid.get(cellKey(x, y, z)) ?? []) if (boxesOverlap(p.bounds, b, margin)) out.add(p);
    return out;
  }

  // --- Breaking ------------------------------------------------------------------------------

  /**
   * A blast: breaks what it reaches, throws the near pieces, and brings down what loses its support.
   * The nearest pieces break first, within what's left of this frame's `frameBudget` ms (shared by
   * every blast and hit), the rest over the next frames (the result fills in as they do: `done`
   * says when it has).
   */
  explode(o: ExplosionOptions): ExplosionResult {
    const R = o.radius;
    // What's dormant within its radius wakes first, to be broken as the rest is (not as far as its
    // pressure carries to glass: a tower's windows are drawn, its walls are what breaks)
    const reach = R * DORMANT_REACH;
    for (const d of this.dormantIn({ min: [o.at[0] - reach, o.at[1] - reach, o.at[2] - reach], max: [o.at[0] + reach, o.at[1] + reach, o.at[2] + reach] })) this.awaken(d);
    const result: ExplosionResult = { broken: 0, made: [], loose: [], dust: 0, collapsed: [], done: false };
    // What's moving already is pushed on the GPU, and sections it reaches part of go with it whole
    const speed = o.speed ?? 12;
    this.blast?.run(o.at, R * 1.6, speed * 0.8, speed * 0.25, o.spin ?? 10, this.maxSpeed);
    this.carry(o.at, R * 1.6, speed * 0.8, speed * 0.25);

    const far = R * this.maxReach;
    const box: Box3 = { min: [o.at[0] - far, o.at[1] - far, o.at[2] - far], max: [o.at[0] + far, o.at[1] + far, o.at[2] + far] };
    // Loose pieces it reaches are cut too, if asked: where they are now, as near as can be told
    const flying = new Map<Piece, Convex>();
    if (o.loose)
      for (const p of this.loose) {
        if (p.prop) continue;
        const now = this.now(p);
        if (distance(now.position, o.at) < far + p.radius) flying.set(p, transform(p.local, now.position, now.rotation));
      }
    const queue = [...this.near(box), ...flying.keys()]
      .map((p) => ({ p, d: signedDistance(flying.get(p) ?? p.convex, o.at) }))
      .filter(({ p, d }) => !p.isStatic && d < R * (p.material.reach ?? 1))
      .sort((a, b) => a.d - b.d)
      .map(({ p }) => p);
    this.jobs.push({ o, queue, budget: o.budget ?? 600, result, loose: new Set(flying.keys()) });
    this.work();
    return result;
  }

  /** Break what the blasts under way still have to, in what's left of this frame's budget. */
  private work(): void {
    const start = performance.now();
    const deadline = start + this.frameBudget - this.spent;
    let broke = false;
    let finished = 0;
    for (const job of this.jobs) {
      while (job.queue.length && performance.now() < deadline) {
        this.breakPiece(job, job.queue.shift()!);
        broke = true;
        // All the ground it reached broken (it goes nearest first, before far panes): its chunks go
        if (job.ejecta?.length && !job.queue.some((p) => p.ground && p.state === 'fixed')) this.eject(job);
      }
      if (job.queue.length) break;
      this.eject(job);
      finished++;
    }
    // Those all broken: what falls, in one pass over the structure for them all, once a frame has
    // the time it took last (or has done nothing else: it may never have that much)
    if (finished && ((!broke && !this.spent) || performance.now() + this.settleMs <= deadline)) {
      const t = performance.now();
      const collapsed = this.settle();
      this.settleMs = performance.now() - t;
      for (const job of this.jobs.splice(0, finished)) {
        job.result.collapsed = collapsed;
        job.result.done = true;
      }
      this.weighAt = this.time + this.cascade * 0.5;
    }
    this.spent += performance.now() - start;
  }

  /**
   * Throw what a blast broke out of a breakable ground, all at once now that all the ground it
   * reached is broken (a chunk thrown as its slab broke struck the next slab, not broken yet, and
   * fell back in), each passing through the crater's sides on its way out for a moment (EJECT): one
   * thrown from its edge was stopped dead against them and lay where it had been.
   */
  private eject(job: Job): void {
    const thrown: Piece[] = [];
    for (const { piece, velocity, spin } of job.ejecta?.splice(0) ?? []) {
      if (piece.state !== 'fixed') continue;
      this.loosen(piece, velocity, spin);
      job.result.loose.push(piece);
      thrown.push(piece);
    }
    if (!thrown.length) return;
    const { at, radius } = job.o;
    const box: Box3 = { min: [at[0] - radius - 1, at[1] - radius - 1, at[2] - radius - 1], max: [at[0] + radius + 1, at[1] + radius + 1, at[2] + radius + 1] };
    const sides = [...this.near(box)].filter((s) => s.state === 'fixed' && s.ground);
    for (const p of thrown) this.unjam([p], sides, EJECT);
  }

  /**
   * The GPU's push on loose pieces (BlastPass) reaches only those within its radius: the rest of a
   * section they're joined to gets its share of it at once, as a rigid body would, rather than
   * through joints that would tear first. Raised to it, as BlastPass raises those it reaches, not
   * added to: what's going that way already keeps its speed.
   */
  private carry(at: V3, radius: number, speed: number, lift: number): void {
    if (!this.blast) return;
    const seen = new Set<Piece>();
    for (const p of this.loose) {
      if (seen.has(p) || !p.bonds.size || distance(this.now(p).position, at) > radius) continue;
      const section = this.groupOf(p, 'loose');
      for (const q of section) seen.add(q);
      // Where each is now (as BlastPass sees them), and how it throws those in reach
      const where = new Map(section.map((q) => [q, this.now(q).position]));
      const kicks = new Map<Piece, V3>();
      for (const q of section) {
        const d = sub(where.get(q)!, at);
        const r = length(d);
        if (r > radius) continue;
        const f = (1 - r / radius) / Math.pow(Math.max(q.mass, 0.05), 0.33);
        kicks.set(q, scale(add(scale(normalize(add(d, [0, 0.15 * radius, 0])), speed), [0, lift, 0]), f));
      }
      const { velocities } = this.rigid(section, kicks, (q) => where.get(q)!);
      for (const q of section) {
        if (kicks.has(q)) continue;
        const share = velocities.get(q)!;
        const s = length(share);
        const short = s - dot(q.body.velocity as V3, scale(share, 1 / Math.max(s, 1e-9)));
        if (s > 1e-6 && short > 0) q.body.applyImpulse(scale(share, (short / s) * q.mass));
      }
    }
  }

  /** What a blast does to one piece it reached: cut it and throw its cells, or throw it whole. */
  private breakPiece(job: Job, piece: Piece): void {
    const { o, result } = job;
    const R = o.radius;
    const reach = R * (piece.material.reach ?? 1);
    if (piece.state === 'rubble') {
      this.throwRubble(piece, o, result);
      return;
    }
    if (piece.state === 'loose' && job.loose.has(piece)) {
      this.cutLoose(job, piece);
      return;
    }
    // Gone, or thrown loose, since the blast went off
    if (piece.state !== 'fixed') return;
    const m = piece.material;
    if (!(piece.size > m.minSize * 1.5 && job.budget > 0)) {
      this.fate(piece, { ...o, radius: reach }, result, job);
      return;
    }
    // A bullet bites into the ground
    if (job.bite && piece.ground && this.bite(job, piece)) return;
    // Cut it, its cells packed around the nearest point to the blast
    const at = this.inside(piece, o.at);
    const seeds = this.blastSeeds(piece, at, R, job.budget);
    // Cells too small to be bodies go as particles, without ever being made: thrown within its
    // reach, falling where they were beyond it (unless the material keeps them standing)
    const cells = this.split(piece, this.cellsOf(piece, seeds), (cell) => {
      const d = distance(cell.centroid, o.at);
      const size = Math.cbrt(cell.volume);
      if (size >= m.minBodySize || (d >= reach && m.keepSmall)) return false;
      result.dust += cell.volume;
      if (d < reach * 0.5 && size <= m.dustSize) this.emit('dust', { at: cell.centroid, volume: cell.volume, material: piece.materialName });
      else this.emit('debris', { at: cell.centroid, velocity: this.kick(cell.centroid, cell.volume * m.density, o.at, reach, o.speed ?? 12, piece.ground) ?? [0, 0, 0], volume: cell.volume, material: piece.materialName });
      return true;
    });
    if (!cells) {
      this.fate(piece, { ...o, radius: reach }, result, job);
      return;
    }
    const made = cells.map((c) => c.piece);
    job.budget -= made.length;
    result.broken++;
    result.made.push(...made);
    for (const cell of made) this.fate(cell, { ...o, radius: reach }, result, job);
    this.emit('fracture', { piece, pieces: made, at });
  }

  /**
   * A bullet's bite out of a breakable ground: what's within its reach of where it struck goes, a
   * chunk thrown up out of the hole and the rest as spray (dust at its heart), and the rest of the
   * piece stands round the hole in a few blocky cells, cut by seeds a little further out than that
   * all round it, so the cuts between them run straight out from the hole, down its sides and
   * across under it. Of the rest, what's small or thin goes as spray too, and so does what lies all
   * within the bite's reach and is narrow for its length (it would stand as wedges and slivers, each
   * cut again by the next round): under sustained fire the bites run together into a ragged
   * pothole. False when it can't be cut.
   */
  private bite(job: Job, piece: Piece): boolean {
    const { o, result } = job;
    const m = piece.material;
    const { at, normal } = job.bite!;
    const r = o.radius * (m.reach ?? 1);
    const inside = (p: V3) => signedDistance(piece.convex, p) < -1e-4;
    // Its own cells, packed round where it struck (just in from the face)
    const c = this.inside(piece, sub(at, scale(normal, Math.min(0.05, r * 0.2))));
    const seeds: V3[] = [c];
    for (let tries = 0; seeds.length < BITE.cells && tries < BITE.cells * 20; tries++) {
      const p = add(c, scale(this.direction(), r * 0.6 * Math.cbrt(this.rand())));
      if (inside(p)) seeds.push(p);
    }
    const bitten = new Set(seeds);
    // What's left stands round it, cut by seeds as far out again as the bite reaches, above it,
    // below it and four ways across the ground, turned at random: the bite is about a cube. The
    // ground's way, not the face's: struck on a pit's side, or bitten across a seam, the cuts still
    // run down through the layer and across under it, not along it as plates. Those out past the
    // piece's edge cut it too (what's between the bite and the edge there is theirs)
    const [u, v] = across([0, 1, 0], this.rand() * 2 * Math.PI);
    for (const w of [[0, 1, 0], [0, -1, 0], u, scale(u, -1), v, scale(v, -1)] as V3[]) seeds.push(add(c, scale(normalize(add(w, scale(this.direction(), 0.2))), BITE.out * r * (0.85 + 0.3 * this.rand()))));
    const cells = this.cellsOf(piece, seeds);
    // Of the bite, the biggest is thrown whole, if it's big; of the rest, the blocky ones stand, and
    // those reaching out past the bite however long they are (a strip of the slab beside the hole)
    const chunk = cells.filter((cell) => bitten.has(cell.seed) && Math.cbrt(cell.volume) >= Math.max(r * BITE.chunk, m.minBodySize)).sort((a, b) => b.volume - a.volume)[0];
    const standing = new Set(
      cells.filter((cell) => {
        if (bitten.has(cell.seed) || Math.cbrt(cell.volume) < Math.max(r * BITE.stand, m.keepSmall ? 0 : m.minBodySize)) return false;
        const { wide, long, thick } = plan(cell.convex, cell.centroid);
        if (thick < r * BITE.thin || wide < r * BITE.thin) return false;
        return wide >= long * BITE.sliver || vertices(cell.convex).some((q) => distance(q, c) > r * BITE.near);
      }),
    );
    // The rest goes as spray (dust at its heart), never made: a spray for each bit of it the size of
    // the least that stands, spread through it
    const bit = (r * BITE.stand) ** 3;
    const spray = (cell: Cell) => {
      result.dust += cell.volume;
      if (bitten.has(cell.seed) && distance(cell.centroid, at) < r * 0.5 && Math.cbrt(cell.volume) <= m.dustSize) {
        this.emit('dust', { at: cell.centroid, volume: cell.volume, material: piece.materialName });
        return;
      }
      const corners = vertices(cell.convex);
      const n = Math.min(BITE.sprays, Math.ceil(cell.volume / bit));
      for (let k = 0; k < n; k++) {
        const p = n === 1 ? cell.centroid : lerp(cell.centroid, corners[Math.floor(((k + 0.5) * corners.length) / n)], 0.5);
        this.emit('debris', { at: p, velocity: this.thrown(p, (cell.volume / n) * m.density, o, piece.ground), volume: cell.volume / n, material: piece.materialName });
      }
    };
    const made = this.split(piece, cells, (cell) => {
      if (cell === chunk || standing.has(cell)) return false;
      spray(cell);
      return true;
    });
    if (!made) return false;
    const pieces = made.map((x) => x.piece);
    job.budget -= pieces.length;
    result.broken++;
    result.made.push(...pieces);
    // What goes is thrown up out of the hole, once all the ground the bullet reached is broken
    for (const { cell, piece: p } of made) if (!standing.has(cell)) (job.ejecta ??= []).push({ piece: p, velocity: this.outOfHole(p, at, o.at, r), spin: this.randomSpin(o.spin ?? 10) });
    this.emit('fracture', { piece, pieces, at });
    return true;
  }

  /** How a blast throws what it breaks off, however far out: at the least, as at the edge of its reach. */
  private thrown(p: V3, mass: number, o: ExplosionOptions, ground: Ground | null): V3 {
    return this.kick(p, mass, o.at, Math.max(o.radius, distance(p, o.at) + 1e-3), o.speed ?? 12, ground)!;
  }

  /**
   * How a bullet's bite throws its chunk (bite()): up, fast enough that its foot rises a quarter of
   * a metre over its ground's top from as deep as it lies, and out to one side of the way the bullet
   * went (from `from`), to land about BITE.throw times the bite's radius `r` away: clear of the
   * hole, which grows on along the line of fire, and of the line of fire itself, where the next
   * rounds would cut it up.
   */
  private outOfHole(chunk: Piece, at: V3, from: V3, r: number): V3 {
    const g = Math.hypot(...this.world.gravity);
    const up = Math.sqrt(2 * g * Math.max(0.25, chunk.ground!.top - chunk.bounds.min[1] + 0.25));
    const on = Math.hypot(at[0] - from[0], at[2] - from[2]) > 1e-3 ? Math.atan2(at[2] - from[2], at[0] - from[0]) : this.rand() * 2 * Math.PI;
    const turn = on + (this.rand() < 0.5 ? -1 : 1) * (Math.PI / 2 + (this.rand() - 0.5));
    // Landing a quarter of a metre down from the top of its flight
    const out = (BITE.throw * r * (0.75 + 0.5 * this.rand())) / (up / g + Math.sqrt(0.5 / g));
    return this.capped([Math.cos(turn) * out, up, Math.sin(turn) * out]);
  }

  /** A piece's Voronoi cells for `seeds` (none for fewer than two). */
  private cellsOf(piece: Piece, seeds: V3[]): Cell[] {
    return seeds.length < 2 ? [] : voronoi(piece.convex, seeds, 1e-6, this.grainOf(piece));
  }

  /** A direction at random, every way alike. */
  private direction(): V3 {
    const z = 2 * this.rand() - 1;
    const a = 2 * Math.PI * this.rand();
    const s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a), z];
  }

  /** Where a blast of radius `R` cuts a piece: seeds packed around `at` (in it), or even shards (glass), at most `budget`. */
  private blastSeeds(piece: Piece, at: V3, R: number, budget: number): V3[] {
    const m = piece.material;
    const count = m.shatter ? m.maxPieces : Math.min(m.maxPieces, budget, Math.max(4, Math.round((piece.size / m.fragmentSize) ** 2 * 1.2)));
    return m.shatter ? uniformSeeds(piece.convex, count, this.rand) : impactSeeds(piece.convex, { at, count, spread: Math.max(m.fragmentSize, R * 0.3), rand: this.rand });
  }

  /**
   * A blast reaching a loose piece cuts it as it flies: its cells go on with its motion and the
   * blast's throw. One too small to cut flies on whole (the GPU's push has thrown it).
   */
  private cutLoose(job: Job, piece: Piece): void {
    const { o, result } = job;
    const m = piece.material;
    if (!(piece.size > m.minSize * 1.5 && job.budget > 0)) return;
    // Cut where it is now (its readback's pose is up to a tenth of a second and more old, metres back for debris)
    piece.moved(this.now(piece));
    this.posed.set(piece, this.time);
    const reach = o.radius * (m.reach ?? 1);
    const at = this.inside(piece, o.at);
    const cells = this.shatterLoose(piece, at, this.blastSeeds(piece, at, o.radius, job.budget), (cell) => this.kick(cell.centroid, cell.volume * piece.density, o.at, reach, o.speed ?? 12));
    if (!cells) return;
    job.budget -= cells.length;
    result.broken++;
    result.made.push(...cells);
    result.loose.push(...cells);
  }

  /**
   * Where a loose piece is now, as near as can be told: where it was when last known (its last
   * readback, or when it was let go since), carried on by its velocity and spin then.
   */
  private now(piece: Piece): Pose {
    const dt = Math.min(this.time - (this.posed.get(piece) ?? this.time), 0.5);
    const { position, rotation } = piece.pose;
    const v = piece.body.velocity as V3;
    const w = piece.body.angularVelocity as V3;
    const turn = length(w) * dt;
    return { position: add(position, scale(v, dt)), rotation: turn > 1e-6 ? multiply(quatFromAxisAngle(w, turn), rotation) : rotation };
  }

  /** A small hit (a bullet, a hammer): a blast of a small radius and little throw. */
  hit(at: V3, radius = 0.35, speed = 4): ExplosionResult {
    return this.explode({ at, radius, speed, spin: 4, budget: 60 });
  }

  /**
   * A bullet from `at` along `direction`: what it strikes first within `range` m (a standing
   * piece, rubble, a prop, or one moving, where it is now), or null. Loose pieces, rubble and props
   * are pushed along its way (bulletPush: a crate skitters, a car doesn't move). Each bullet adds
   * `power` to what the piece has taken, and once that passes what its material and size can take
   * (bulletsToBreak, in rounds of power 1: glass at the first, a brick in a few, a concrete block in
   * dozens, steel in hundreds) it breaks where it was struck, as a small blast of it alone would,
   * within the breaking budget. A heavier round (power over 1) blows out a wider hole: the blast's
   * radius, throw and cells grow by the cube root of the power, and the standing pieces within half
   * its radius break with it. Into a breakable ground it bites (the layer it struck, as far as the
   * blast reaches into it): what's in reach goes as spray and a chunk, and what's left stands in a
   * few blocky cells, so sustained fire digs a pothole. Until it gives way nothing is cut: the demo
   * chips it.
   */
  shoot(at: V3, direction: V3, power = 1, range = 500): ShotHit | null {
    const dir = normalize(direction);
    // Something dormant in the way first: it wakes, and the round goes on into its pieces
    let hit = this.wakeAlong(at, dir, range);
    // What's moving, where it is now (its readback carried on): its bounding sphere, then its shape
    for (const p of this.loose) {
      const now = this.now(p);
      const c = sub(now.position, at);
      const t = dot(c, dir);
      const r = p.radius;
      if (t < -r || t > (hit?.distance ?? range) + r || dot(c, c) - t * t > r * r) continue;
      const h = raycastConvex(transform(p.local, now.position, now.rotation), at, dir, hit?.distance ?? range);
      if (h && h.t < (hit?.distance ?? Infinity)) hit = { piece: p, distance: h.t, normal: h.n, point: add(at, scale(dir, h.t)) };
    }
    if (!hit) return null;
    return this.strikeAt(hit, dir, power);
  }

  /**
   * A round of `power` striking `piece` at `at`, on its way along `direction`, as shoot's does once
   * it has found what it strikes (whatever else is in the way): glass a hull round it hides (a car's
   * window in its door's), struck all the same.
   */
  shootPiece(piece: Piece, at: V3, direction: V3, power = 1): ShotHit {
    const dir = normalize(direction);
    return this.strikeAt({ piece, point: at, normal: scale(dir, -1), distance: 0 }, dir, power);
  }

  private strikeAt(hit: RayHit, dir: V3, power: number): ShotHit {
    const { piece } = hit;
    const shot: ShotHit = { ...hit, material: piece.materialName, broke: false, damage: 0 };
    if (piece.state !== 'fixed') {
      // Raised to its push along the bullet's way, not added to: a piece held in the line of fire
      // isn't sped up round after round (a roof sheet juggled across town)
      const along = piece.state === 'loose' ? Math.max(0, dot(piece.body.velocity as V3, dir)) : 0;
      const v = bulletPush(piece.mass, power) - along;
      if (v > 0.08) this.push(piece, scale(dir, v));
    }
    if (piece.isStatic) return shot;
    if (piece.prop) {
      // A prop that breaks takes its rounds, then flies apart from where the last struck
      if (!piece.prop.shards?.length) return shot;
      const limit = this.propRounds(piece);
      const taken = (this.damage.get(piece) ?? 0) + power;
      this.damage.set(piece, taken);
      shot.damage = Math.min(1, taken / limit);
      if (taken < limit) return shot;
      this.damage.delete(piece);
      shot.broke = this.breakProp(piece, hit.point, { along: scale(dir, 1.5 * Math.cbrt(Math.max(1, power))) }).length > 0;
      return shot;
    }
    const limit = bulletsToBreak(piece.material, piece.size);
    const taken = (this.damage.get(piece) ?? 0) + power;
    this.damage.set(piece, taken);
    shot.damage = Math.min(1, taken / limit);
    if (taken < limit) return shot;
    // It gives way: cut around where it was struck, from just in front (its cells go on the bullet's
    // way); rubble wakes to be cut as it moves. A heavier round (power over 1) cuts a wider hole,
    // throws its cells harder, and breaks the standing pieces right around it too, as a small blast.
    // One too small to cut comes loose whole, from behind its middle (struck off it, it was out of
    // its own blast's reach and stood)
    if (piece.state === 'rubble') this.wake(piece);
    const k = Math.cbrt(Math.max(1, power));
    const radius = k * Math.min(0.4, Math.max(0.15, piece.size * 0.8));
    const whole = piece.state === 'fixed' && !(piece.size > piece.material.minSize * 1.5);
    const from = whole ? sub(volumeCentroid(piece.convex).centroid, scale(dir, radius * 0.5)) : sub(hit.point, scale(dir, 0.08));
    const o: ExplosionOptions = { at: from, radius, speed: 3 * k, spin: 4, budget: Math.round(12 * k) };
    const queue = [piece];
    if (k > 1) {
      // (Into a breakable ground, the layer it struck, as far as its bite reaches: the layer under is
      // bitten by the rounds after)
      const r = o.radius * Math.max(0.5, piece.ground ? (piece.material.reach ?? 1) : 0);
      const box: Box3 = { min: [o.at[0] - r, o.at[1] - r, o.at[2] - r], max: [o.at[0] + r, o.at[1] + r, o.at[2] + r] };
      for (const p of this.near(box)) if (p !== piece && p.state === 'fixed' && !p.isStatic && !p.prop && !(piece.ground && p.ground && p.materialName !== piece.materialName) && signedDistance(p.convex, o.at) < r) queue.push(p);
    }
    const result: ExplosionResult = { broken: 0, made: [], loose: [], dust: 0, collapsed: [], done: false };
    this.jobs.push({ o, queue, budget: o.budget!, result, loose: new Set(piece.state === 'loose' ? [piece] : []), bite: { at: hit.point, normal: hit.normal } });
    this.damage.delete(piece);
    this.work();
    shot.broke = true;
    return shot;
  }

  /** A point inside the piece, as near `p` as is easy to find (p itself when it's inside). */
  private inside(piece: Piece, p: V3): V3 {
    const c = piece.convex;
    if (signedDistance(c, p) < -1e-3) return p;
    const centre = volumeCentroid(c).centroid;
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      if (signedDistance(c, lerp(p, centre, mid)) < -1e-3) hi = mid;
      else lo = mid;
    }
    return lerp(p, centre, Math.min(1, hi + 0.02));
  }

  /** What a blast does to a standing piece: dust at its heart, loose within its reach, else it stays. */
  private fate(piece: Piece, o: ExplosionOptions, result: ExplosionResult, job?: Job): void {
    if (piece.state !== 'fixed') return;
    const centre = volumeCentroid(piece.convex).centroid;
    const d = distance(centre, o.at);
    const m = piece.material;
    if (d < o.radius * 0.5 && piece.size <= m.dustSize) {
      result.dust += piece.volume;
      this.emit('dust', { at: centre, volume: piece.volume, material: piece.materialName });
      this.removePiece(piece);
      return;
    }
    if (d < o.radius) {
      const kick = this.kick(centre, piece.mass, o.at, o.radius, o.speed ?? 12, piece.ground) ?? [0, 0, 0];
      // Too small to be worth a body: thrown as particles (shards of glass, chips of brick)
      if (piece.size < m.minBodySize) {
        result.dust += piece.volume;
        this.emit('debris', { at: centre, velocity: kick, volume: piece.volume, material: piece.materialName });
        this.removePiece(piece);
        return;
      }
      // Out of a breakable ground: once all the ground the blast reached is broken (a bullet's, out
      // of its hole as its bite's chunk is)
      if (job && piece.ground) (job.ejecta ??= []).push({ piece, velocity: job.bite ? this.outOfHole(piece, job.bite.at, o.at, o.radius) : kick, spin: this.randomSpin(o.spin ?? 10) });
      else {
        this.loosen(piece, kick, this.randomSpin(o.spin ?? 10));
        result.loose.push(piece);
      }
    }
  }

  /**
   * The throw a blast gives a piece of `mass` at `p` (null: out of reach); one it breaks out of a
   * breakable `ground` goes out of the crater (rubble, wreckage or a car lying in one, as anywhere).
   */
  private kick(p: V3, mass: number, at: V3, radius: number, speed: number, ground: Ground | null = null): V3 | null {
    const d = sub(p, at);
    const r = length(d);
    if (r > radius) return null;
    const f = ((1 - r / radius) * 0.7 + 0.3) / Math.pow(Math.max(mass, 0.05), 0.25);
    const dir = ground ? this.outOfCrater(d, radius) : normalize([d[0] + (this.rand() - 0.5) * 0.3 * radius, d[1] + 0.2 * radius, d[2] + (this.rand() - 0.5) * 0.3 * radius]);
    return scale(dir, Math.min(speed * f * (ground?.toss ?? 1), this.maxSpeed));
  }

  /**
   * The way a blast throws what it breaks out of a breakable ground (`d`: from the blast to it): the
   * ground under it doesn't give, so up and out of the crater, away from its middle, steeper from
   * there (about 65°) than from its edge (40°), so it lands round the rim rather than back in.
   */
  private outOfCrater(d: V3, radius: number): V3 {
    const out = Math.hypot(d[0], d[2]);
    const turn = (out > 1e-3 ? Math.atan2(d[2], d[0]) : this.rand() * 2 * Math.PI) + (this.rand() - 0.5) * 0.6;
    const rise = 1.15 - 0.45 * Math.min(1, out / radius) + (this.rand() - 0.5) * 0.3;
    return [Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise)];
  }

  /** A velocity no faster than maxSpeed. */
  private capped(v: V3): V3 {
    const s = length(v);
    return s > this.maxSpeed ? scale(v, this.maxSpeed / s) : v;
  }

  private randomSpin(rate: number): V3 {
    return [(this.rand() - 0.5) * rate, (this.rand() - 0.5) * rate, (this.rand() - 0.5) * rate];
  }

  /**
   * Cut a standing piece into its Voronoi `cells` (cellsOf): the cells stand in its place, bonded to
   * each other and to what it was bonded to; each piece made, with its cell. Null (and nothing
   * changes) when it can't be cut.
   */
  private split(piece: Piece, cells: Cell[], skip?: (cell: Cell) => boolean): Array<{ cell: Cell; piece: Piece }> | null {
    if (cells.length < 2) return null;
    const textureWorld = piece.textureFrame;
    const neighbours = [...piece.bonds].map((b) => b.other(piece));
    this.removePiece(piece);
    const made: Array<{ cell: Cell; piece: Piece }> = [];
    for (const cell of cells) {
      // Cells the caller takes care of otherwise (thrown as particles) never become bodies
      if (skip?.(cell)) continue;
      const p = this.create(cell.convex, null, piece.materialName, textureWorld, piece.tint, 'fixed', false);
      if (!p) continue;
      p.ground = piece.ground;
      p.body.setCollisionGroups(piece.body.group, piece.body.collidesWith);
      // Cells bond as loosely as their piece did (to the neighbours it bonded to)
      const tolerance = this.tolerances.get(piece);
      if (tolerance) this.tolerances.set(p, tolerance);
      made.push({ cell, piece: p });
    }
    // Bonds among the cells, and to the piece's old neighbours that still stand
    for (let i = 0; i < made.length; i++) {
      for (let j = i + 1; j < made.length; j++) this.tryBond(made[i].piece, made[j].piece);
      for (const n of neighbours) if (n.state === 'fixed') this.tryBond(made[i].piece, n);
    }
    return made;
  }

  /**
   * Let a piece go whole, moving at `velocity` (m/s) and turning at `spin` (rad/s): a standing one
   * is cut from what it's bonded to (what it held is weighed again at the next update), rubble from
   * what it rests joined to, which wakes (a prop's part goes with its other parts). Static pieces
   * never go.
   */
  loosen(piece: Piece, velocity: V3 = [0, 0, 0], spin: V3 = [0, 0, 0]): void {
    if ((piece.state !== 'fixed' && piece.state !== 'rubble') || piece.isStatic) return;
    const parted: Piece[] = [];
    for (const bond of [...piece.bonds])
      if (bond.area < WELD) {
        parted.push(bond.other(piece));
        this.unbond(bond);
      }
    if (piece.state === 'rubble') {
      this.wake(piece);
      // What it rested joined to rested as one with it: it looks again at what holds it
      for (const q of parted) this.wake(q);
    } else {
      this.unindex(piece);
      this.become(piece, 'loose');
      piece.still = 0;
      piece.body.setFixed(false);
      this.watch(piece);
      this.loose.add(piece);
      this.wakeCarried(piece);
    }
    piece.body.set({ position: piece.pose.position, rotation: piece.pose.rotation, velocity, angularVelocity: spin });
  }

  /**
   * Let standing pieces go together as one section (a box off its stack, a wall off its building):
   * their bonds to each other become joints that break when it lands, their bonds to the rest are
   * cut, and it moves at `velocity` (m/s), turning at `spin` (rad/s) about its centre of mass.
   * What it held is weighed again at the next update.
   */
  release(pieces: Piece[], velocity: V3 = [0, 0, 0], spin: V3 = [0, 0, 0]): void {
    const section = pieces.filter((p) => p.state === 'fixed' && !p.isStatic);
    if (!section.length) return;
    this.drop(section);
    const { center } = this.centerOf(section);
    for (const p of section) p.body.set({ velocity: add(velocity, cross(spin, sub(p.pose.position, center))), angularVelocity: spin });
    this.reweigh();
  }

  /** Rounds of power 1 a prop takes before it breaks (PropModel.rounds). */
  private propRounds(piece: Piece): number {
    return piece.prop?.rounds ?? Math.max(1, Math.min(60, bulletsToBreak(piece.material, piece.size * 0.5)));
  }

  /** Where a prop's model frame is now (its first part's body sits at its hull's centre, on its axes). */
  propFrame(piece: Piece): Pose {
    const look = piece.prop && this.props.get(piece.prop);
    const pose = piece.state === 'loose' ? this.now(piece) : piece.pose;
    if (!look) return pose;
    const rotation = multiply(pose.rotation, conjugate(look.shape.rotation as Q));
    return { position: sub(pose.position, rotate(rotation, look.shape.center as V3)), rotation };
  }

  /**
   * A prop broken: swapped for the pieces it breaks into (PropModel.shards), where it was, each moving
   * as that point of it moved, and thrown: by `blast` as its cells would be, or pushed `along` (a
   * round's way) and apart from `at`. Its pieces are props too (they don't break again), and rubble
   * the budget clears once at rest. Returns them (none: it doesn't break).
   */
  breakProp(piece: Piece, at: V3, push: { blast?: ExplosionOptions; along?: V3 } = {}): Piece[] {
    const model = piece.prop;
    if (!model?.shards?.length || piece.state === 'gone') return [];
    const frame = this.propFrame(piece);
    const v = (piece.state === 'loose' ? piece.body.velocity : [0, 0, 0]) as V3;
    const w = (piece.state === 'loose' ? piece.body.angularVelocity : [0, 0, 0]) as V3;
    const tint = piece.tint;
    const material = piece.materialName;
    // It goes (its welded parts with it)
    this.removePiece(piece);
    const made: Piece[] = [];
    for (const shard of model.shards) {
      shard.debris = true;
      const p = this.addProp({ model: shard, material, position: frame.position, rotation: frame.rotation, tint: new THREE.Color(tint[0], tint[1], tint[2]), loose: true, velocity: v, spin: w });
      if (!p) continue;
      const centre = p.pose.position;
      // Moving as that point of the prop moved, and thrown
      let velocity = add(v, cross(w, sub(centre, frame.position)));
      if (push.blast) {
        const o = push.blast;
        velocity = add(velocity, this.kick(centre, p.mass, o.at, o.radius * 1.3, o.speed ?? 12) ?? scale(normalize(sub(centre, o.at)), 1.5));
      } else {
        const out = sub(centre, at);
        velocity = add(velocity, add(push.along ?? [0, 0, 0], scale(normalize(add(out, [0, 0.05, 0])), 1.2 + this.rand() * 1.3)));
      }
      p.body.set({ velocity: this.capped(velocity), angularVelocity: add(w, this.randomSpin(push.blast ? (push.blast.spin ?? 10) * 0.5 : 4)) });
      made.push(p);
    }
    this.emit('fracture', { piece, pieces: made, at });
    return made;
  }

  /** Tint a piece anew (a car burnt black): a prop's copy, or a piece's faces (the cells it breaks into keep it). */
  retint(piece: Piece, tint: THREE.ColorRepresentation): void {
    const c = new THREE.Color(tint);
    piece.tint = [c.r, c.g, c.b];
    if (piece.prop) this.props.get(piece.prop)?.mesh?.retint(piece.body.index, piece.tint);
    else if (piece.draw) {
      const mesh = this.meshes.get(piece.materialName)!;
      mesh.release(piece.draw);
      piece.draw = mesh.insert(piece.body.index, drawFaces(piece.local.faces, piece.texture, piece.material.uvScale), piece.tint, piece.texture, piece.state);
    }
  }

  /**
   * Push a piece that's free to move: loose, rubble or a prop at rest (which wakes, with what it
   * rests joined to). `velocity` (m/s) is added to its own, shared with a section it's joined to as
   * a rigid body would share it. Standing pieces aren't pushed (loosen lets one go): false.
   */
  push(piece: Piece, velocity: V3): boolean {
    if (piece.state === 'rubble') {
      const group = this.wake(piece);
      const { velocities, spin } = this.rigid(group, new Map([[piece, velocity]]));
      for (const q of group) q.body.set({ velocity: velocities.get(q)!, angularVelocity: spin });
      return true;
    }
    if (piece.state !== 'loose') return false;
    // A section's pieces as they are now (their poses are a readback old)
    const section = this.groupOf(piece, 'loose');
    const where = new Map(section.map((q) => [q, this.now(q).position]));
    const { velocities } = this.rigid(section, new Map([[piece, velocity]]), (q) => where.get(q)!);
    for (const q of section) q.body.applyImpulse(scale(velocities.get(q)!, q.mass));
    return true;
  }

  /** Weigh the structure again at the next update (after changing it from outside: bonds cut or weakened). */
  reweigh(): void {
    this.weighAt = this.weighAt < 0 ? this.time : Math.min(this.weighAt, this.time);
  }

  /** The loose pieces (moving, or come to rest and not yet frozen): read only. */
  get loosePieces(): ReadonlySet<Piece> {
    return this.loose;
  }

  /** A piece's state changes, and 'state' listeners hear of it. */
  private become(piece: Piece, to: PieceState): void {
    const from = piece.state;
    piece.state = to;
    // What's dormant standing on it wakes, once this update is done with the structure (a tower's
    // storeys over a section that's coming down)
    if (from === 'fixed' && this.dormants.length) this.unheld.add(piece.bounds);
    if (to === 'rubble') this.rubble.add(piece);
    else this.rubble.delete(piece);
    if (to === 'gone') this.dissolving.delete(piece);
    // Woken while dissolving, it's moving: it stays, drawn whole again
    const going = to === 'loose' && this.dissolving.get(piece);
    if (going) {
      this.dissolving.delete(piece);
      if (going.faces && piece.draw) {
        const mesh = this.meshes.get(piece.materialName)!;
        mesh.release(piece.draw);
        piece.draw = mesh.insert(piece.body.index, going.faces, piece.tint, piece.texture, to);
      }
    }
    if (this.listeners.state.size) this.emit('state', { piece, from, to });
  }

  /**
   * Wake rubble: it moves again, with the rubble it rests joined to (their joints made again), and
   * so does whatever rests on any of them. Returns the pieces it woke (not those resting on them).
   */
  private wake(piece: Piece): Piece[] {
    if (piece.state !== 'rubble') return [];
    const group = this.groupOf(piece, 'rubble');
    for (const p of group) {
      this.unlink(p);
      this.unindex(p);
      this.become(p, 'loose');
      p.still = 0;
      p.holdAt = 0;
      p.body.setFixed(false);
      this.watch(p);
      this.loose.add(p);
    }
    const members = new Set(group);
    for (const p of group) for (const b of p.bonds) if (b.a === p && members.has(b.b)) this.join(b);
    for (const p of group) this.wakeCarried(p);
    return group;
  }

  /** What rests on a piece that's going (or moving) wakes. */
  private wakeCarried(piece: Piece): void {
    const carried = piece.carried;
    piece.carried = null;
    for (const r of carried ?? []) this.wake(r);
  }

  /** Rubble rests on these pieces: it wakes when one goes. */
  private link(piece: Piece, under: Piece[]): void {
    piece.under = under;
    for (const s of under) (s.carried ??= new Set()).add(piece);
  }

  private unlink(piece: Piece): void {
    for (const s of piece.under) s.carried?.delete(piece);
    piece.under = [];
  }

  /** A piece and those joined to it by bonds, all in `state` (loose: a falling section; rubble: one come to rest). */
  private groupOf(piece: Piece, state: PieceState): Piece[] {
    const group = [piece];
    const seen = new Set(group);
    for (let i = 0; i < group.length; i++)
      for (const b of group[i].bonds) {
        const q = b.other(group[i]);
        if (q.state === state && !seen.has(q)) {
          seen.add(q);
          group.push(q);
        }
      }
    return group;
  }

  /** Pieces' mass and centre of mass (each where `at` says: default, its pose). */
  private centerOf(pieces: Piece[], at = (p: Piece) => p.pose.position): { mass: number; center: V3 } {
    let mass = 0;
    let center: V3 = [0, 0, 0];
    for (const p of pieces) {
      mass += p.mass;
      center = add(center, scale(at(p), p.mass));
    }
    return { mass, center: scale(center, 1 / Math.max(mass, 1e-9)) };
  }

  /**
   * How pieces move as one rigid body when some of them are pushed (`kicks`: m/s each; those of
   * pieces not in it are left out): each one's velocity (the whole's, and its turning about the
   * centre of mass), and the whole's spin. Each piece is where `at` says (default: its pose).
   */
  private rigid(group: Piece[], kicks: Map<Piece, V3>, at = (p: Piece) => p.pose.position): { velocities: Map<Piece, V3>; spin: V3 } {
    const { mass, center } = this.centerOf(group, at);
    let momentum: V3 = [0, 0, 0];
    let turning: V3 = [0, 0, 0];
    for (const p of group) {
      const k = kicks.get(p);
      if (!k) continue;
      momentum = add(momentum, scale(k, p.mass));
      turning = add(turning, cross(sub(at(p), center), scale(k, p.mass)));
    }
    // Its inertia about the centre of mass: each piece as a point there, and its own (as a cube's)
    const rows: [V3, V3, V3] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const p of group) {
      const r = sub(at(p), center);
      const diagonal = dot(r, r) + (p.size * p.size) / 6;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rows[i][j] += p.mass * ((i === j ? diagonal : 0) - r[i] * r[j]);
    }
    const spin = solve(rows, turning);
    const v = scale(momentum, 1 / mass);
    const velocities = new Map<Piece, V3>();
    for (const p of group) velocities.set(p, add(v, cross(spin, sub(at(p), center))));
    return { velocities, spin };
  }

  /**
   * A piece coming loose reports its contacts if it's heavy enough to break what it strikes, can
   * break on landing (its material's `landing`), is to be heard, or is part of a section (which
   * cracks where it lands, and says so). It hasn't landed yet.
   */
  private watch(piece: Piece): void {
    this.landed.delete(piece);
    this.struck.delete(piece);
    // Let go here and now: how it moves is known from the next readback
    this.velocities.delete(piece);
    this.posed.set(piece, this.time);
    const mass = piece.mass;
    const m = piece.material;
    const heard = this.listeners.impact.size > 0 && mass > (m.audible ?? this.audible);
    const lands = piece.bonds.size > 0;
    const breaks = m.landing !== undefined && piece.size > m.minSize * 1.5;
    const report = mass > this.heavy || heard || lands || breaks;
    if (piece.body.reportContacts !== report) piece.body.reportContacts = report;
  }

  /**
   * A loose piece touched the ground or the structure (`into`: the way into what it touched). It
   * strikes when it was moving into it at LAND m/s or more at the readback before; before a
   * readback since it was let go, when the touch is away from where it was let go and stopped it
   * that fast (what it touched there, it rested on or was bonded to: the solver's first steps push
   * hard on those, to part what overlaps). Settling or sliding isn't striking. A falling section's
   * piece striking for the first time since it came loose cracks its joints (crack()). The first
   * strike of a whole section (its pieces still bonded, all of it moving into what it struck: one
   * piece turning over an edge clips it, the section hasn't landed) or of a heavy piece starts its
   * 'landed' (sent at the end of the readback, every touch of it summed).
   */
  private touchdown(piece: Piece, at: V3, impulse: number, into: V3): void {
    // Not read since it was let go (its pose still where it was let go): how fast a touch away from there stopped it
    const stopped = (mass: number) => (boxDistance(piece.bounds, at) > REST_GAP ? impulse / mass : 0);
    if (piece.bonds.size && !piece.prop && !this.struck.has(piece)) {
      const v = this.velocities.get(piece);
      const speed = v ? dot(v, into) : stopped(piece.mass);
      if (speed >= LAND) {
        this.struck.add(piece);
        this.cracking.set(piece, { into, speed });
      }
    }
    if (!this.listeners.landed.size) return;
    let tally = this.touching.get(piece);
    if (!tally) {
      if (this.landed.has(piece)) return;
      const pieces = this.groupOf(piece, 'loose');
      if (pieces.length < 2 && piece.mass <= this.heavy) return;
      let mass = 0;
      let momentum: V3 | null = null;
      for (const p of pieces) {
        mass += p.mass;
        const v = this.velocities.get(p);
        if (v) momentum = add(momentum ?? [0, 0, 0], scale(v, p.mass));
      }
      const strike = momentum ? dot(momentum, into) / mass : stopped(mass);
      if (strike < LAND) return;
      tally = { pieces, impulse: 0, weight: 0, at: [0, 0, 0], seen: momentum !== null };
      for (const p of pieces) {
        this.landed.add(p);
        this.touching.set(p, tally);
      }
    }
    // Where: its touches weighted by how hard each struck (alike when none pushed yet)
    tally.impulse += impulse;
    tally.weight += impulse + 1e-9;
    tally.at = add(tally.at, scale(at, impulse + 1e-9));
  }

  /** Cut a bond (and its joint, if the pieces fall together): standing, what it held is weighed again at the next update. */
  unbond(bond: Bond): void {
    if (!bond.a.bonds.delete(bond)) return;
    bond.b.bonds.delete(bond);
    this.unjoin(bond);
    if (bond.a.state === 'fixed' && bond.b.state === 'fixed') this.reweigh();
  }

  /** Hold two loose pieces together as they are now, by a joint that breaks as their bond's strength says. */
  private join(bond: Bond): void {
    if (bond.joint) return;
    const { a, b: c } = bond;
    // Where the bond's face was as they stood, and how they were turned (kept from then on)
    bond.anchors ??= [toLocal(a.pose.position, a.pose.rotation, bond.center), toLocal(c.pose.position, c.pose.rotation, bond.center)];
    bond.turn ??= multiply(conjugate(a.pose.rotation), c.pose.rotation);
    const strength = Math.min(a.material.strength, c.material.strength) * bond.area;
    // Two pieces of a metal: the joint bends under load, and tears once bent too far
    const plastic = a.material.plastic && c.material.plastic ? a.material.plastic : null;
    const joint = this.world.addJoint(a.body, c.body, {
      anchorA: bond.anchors[0],
      anchorB: bond.anchors[1],
      rest: multiply(conjugate(a.pose.rotation), c.pose.rotation),
      breakForce: strength,
      breakOnPull: true,
      ...(plastic ? { yieldForce: Math.min(plastic.yieldStress * bond.area, strength * 0.5), breakBend: plastic.bend } : {}),
    });
    bond.joint = joint;
    this.jointBonds.set(joint, bond);
  }

  /** A joint goes, its bond stays (the pieces have come to rest together). */
  private unjoin(bond: Bond): void {
    if (!bond.joint) return;
    this.jointBonds.delete(bond.joint);
    bond.joint.remove();
    bond.joint = null;
  }

  /**
   * Take a piece out of the world (what it held up is weighed again at the next update; what
   * rested on it, or rested joined to it, wakes).
   */
  removePiece(piece: Piece): void {
    if (piece.state === 'gone') return;
    if (piece.state === 'fixed' && this.weighAt < 0) this.weighAt = this.time;
    const parted = piece.state === 'rubble' ? [...piece.bonds].map((b) => b.other(piece)) : [];
    for (const bond of [...piece.bonds]) this.unbond(bond);
    this.unlink(piece);
    this.wakeCarried(piece);
    if (piece.state === 'loose') this.loose.delete(piece);
    else this.unindex(piece);
    this.hinged.delete(piece);
    this.become(piece, 'gone');
    piece.body.remove();
    if (piece.draw) this.meshes.get(piece.materialName)!.release(piece.draw);
    piece.draw = null;
    if (piece.prop) this.props.get(piece.prop)?.mesh?.hide(piece.body.index);
    this.pieces.delete(piece);
    this.byBody.delete(piece.body);
    // What goes with it: its prop's other parts, its hinge's hold
    for (const go of this.attached.get(piece) ?? []) go();
    // What rested joined to it rested as one with it: it looks again at what holds it
    for (const q of parted) this.wake(q);
  }

  /**
   * Whether a standing piece rests on the ground (a face of it lies on the ground, facing down; in a
   * breakable ground's area, or at its edge, on its bed): found once, as it never moves while it stands.
   */
  private onGround(piece: Piece): boolean {
    if (piece.grounded === null) {
      piece.grounded = piece.convex.faces.some((f) => {
        if (f.n[1] >= -0.99) return false;
        // (The ground under the face's middle: one standing at a breakable ground's edge stands beside it)
        let x = 0;
        let z = 0;
        for (const p of f.pts) [x, z] = [x + p[0] / f.pts.length, z + p[2] / f.pts.length];
        const g = this.groundAt(x, z);
        if (g !== null && Math.abs(-f.d - g) < 0.02) return true;
        // Or on a breakable ground's bed, reaching its area (a curb standing on the bed beside it)
        if (this.grounds.some((ground) => Math.abs(-f.d - ground.bed) < 0.02 && f.pts.some((p) => ground.contains(p[0], p[2], TOUCH)))) return true;
        // Or on the scenery: the top of a fixed body in the world that isn't a piece (a quay's wall
        // under its coping, a tower's storeys still standing as scenery under these)
        return this.sceneryUnder(x, z).some((s) => s.body.alive && Math.abs(-f.d - s.bounds.max[1]) < 0.02 && x >= s.bounds.min[0] && x <= s.bounds.max[0] && z >= s.bounds.min[2] && z <= s.bounds.max[2]);
      });
    }
    return piece.grounded;
  }

  /**
   * Bring down what no longer stands: every fixed piece that doesn't reach the ground or a static
   * piece through bonds to fixed pieces falls, each connected section whole, its bonds made joints.
   */
  settle(): Piece[] {
    const supported = new Set<Piece>();
    const queue: Piece[] = [];
    for (const p of this.pieces) {
      if (p.state !== 'fixed') continue;
      if (p.isStatic || p.anchor || this.onGround(p)) {
        supported.add(p);
        queue.push(p);
      }
    }
    while (queue.length) {
      const p = queue.pop()!;
      for (const b of p.bonds) {
        const q = b.other(p);
        if (q.state === 'fixed' && !supported.has(q)) {
          supported.add(q);
          queue.push(q);
        }
      }
    }
    const sections: Piece[][] = [];
    const seen = new Set<Piece>();
    for (const p of this.pieces) {
      if (p.state !== 'fixed' || supported.has(p) || seen.has(p)) continue;
      // The section it's part of
      const section: Piece[] = [];
      const stack = [p];
      seen.add(p);
      while (stack.length) {
        const q = stack.pop()!;
        section.push(q);
        for (const b of q.bonds) {
          const r = b.other(q);
          if (r.state === 'fixed' && !seen.has(r)) {
            seen.add(r);
            stack.push(r);
          }
        }
      }
      sections.push(section);
    }
    // How each turns, from what it rests on before any of them moves
    const turns = sections.map((s) => this.tipping(s));
    sections.forEach((s, i) => this.drop(s, turns[i]));
    return sections.flat();
  }

  /**
   * Weigh the structure: every standing piece's weight goes toward the ground along its bonds (to
   * its neighbours fewer bonds from the ground, shared by what each bond can carry), adding to
   * theirs. Each bond's `load` is set to the share of what it can carry that it carries; the bonds
   * asked to carry more than they can come back. A bond reinforce() strengthened has that strength
   * for its load as built: asked to carry more (supports lost elsewhere), it falls back toward its
   * material's own, all of the way at reinforce()'s margin times its load as built. `within`: those
   * pieces alone (whole groups of joined pieces: the rest keep what they were last weighed as).
   */
  weigh(within?: ReadonlySet<Piece>): Bond[] {
    const g = Math.hypot(...this.world.gravity);
    // Breadth first from what holds everything up: the ground, static pieces and anchors (of
    // `within` alone, if given: whole groups of joined pieces, as no load leaves one)
    const order: Piece[] = [];
    for (const p of within ?? this.pieces) {
      p.depth = -1;
      if (p.state === 'fixed' && (p.isStatic || p.anchor || this.onGround(p))) {
        p.depth = 0;
        order.push(p);
      }
    }
    for (let i = 0; i < order.length; i++) {
      const p = order[i];
      for (const b of p.bonds) {
        const q = b.other(p);
        if (q.state === 'fixed' && q.depth < 0) {
          q.depth = p.depth + 1;
          order.push(q);
        }
      }
    }
    // From the farthest in: each passes its weight, and what it carries, on toward the ground; and
    // where in plan that weight bears (what a bond passes down bears at the bond)
    for (const p of order) {
      const w = p.mass * g;
      p.weight = w;
      p.bearsX = p.pose.position[0] * w;
      p.bearsZ = p.pose.position[2] * w;
    }
    const over: Bond[] = [];
    // Each bond toward the ground, what it can carry, and whether that's as pulled (its material's own)
    const down: Array<[Bond, number, boolean]> = [];
    for (let i = order.length - 1; i >= 0; i--) {
      const p = order[i];
      const d = p.depth;
      if (d === 0) continue;
      down.length = 0;
      for (const b of p.bonds) {
        const q = b.other(p);
        if (q.state !== 'fixed' || q.depth < 0 || q.depth >= d) continue;
        down.push([b, this.bondCapacity(b, p, q), false]);
      }
      const w = p.weight;
      const center: V3 = [p.bearsX / w, 0, p.bearsZ / w];
      // Its weight has moved off what carries it since it was built: it tips over the edge, held
      // only as levers (each bond holds less the further the weight is from it), and those it's
      // pressed onto only as their material holds pulled (reinforce() strengthened them for
      // pressing: not that, but a bond weakened from outside stays weak)
      const tips = this.tips(p, center);
      let total = 0;
      for (const e of down) {
        if (tips) {
          const [b] = e;
          const lever = Math.min(1, Math.sqrt(b.area) / Math.max(1e-6, Math.hypot(b.center[0] - center[0], b.center[2] - center[2])));
          const pulled = this.pressed(b, p);
          e[1] = (pulled ? Math.min(p.material.support, b.other(p).material.support) * b.area * Math.min(1, b.strength) : e[1]) * lever;
          e[2] = pulled;
        }
        total += e[1];
      }
      for (const [b, c, pulled] of down) {
        const q = b.other(p);
        const force = total > 0 ? (w * c) / total : w / down.length;
        const holds = c > 0 ? (pulled ? c : this.holding(b, c, force)) : 0;
        b.force = force;
        b.load = holds > 0 ? force / holds : Infinity;
        if (b.load > 1) over.push(b);
        // All of it goes on down (what fails drags down what it hung on, in the same round); or,
        // passHeldOnly, no more than the bond holds, so what's under it isn't overloaded by what's
        // about to come off it (as built, all of it: reinforce() strengthens for that)
        const passed = this.passHeldOnly && !this.reinforcing ? Math.min(force, holds) : force;
        q.weight += passed;
        q.bearsX += b.center[0] * passed;
        q.bearsZ += b.center[2] * passed;
      }
    }
    return over;
  }

  /** Whether a bond presses `from` onto the piece under it. */
  private pressed(b: Bond, from: Piece): boolean {
    const n = b.normal;
    return Math.abs(n[1]) > 0.7 && (b.a === from ? n[1] < 0 : n[1] > 0);
  }

  /**
   * Whether a standing piece can carry `p` (as weighed): it reaches the ground through its bonds,
   * and not only through p (one hanging from p carries none of it).
   */
  private carries(q: Piece, p: Piece): boolean {
    if (q.depth < 0) return false;
    if (q.depth <= p.depth) return true;
    for (const b of q.bonds) {
      const r = b.other(q);
      if (r !== p && r.depth >= 0 && r.depth < q.depth) return true;
    }
    return false;
  }

  /**
   * Whether a standing piece has tipped: the weight it bears (at `center`, in plan) is further out
   * past what it stands on than it was as built (by 0.12 m, or 18% of its width). What it stands
   * on: the faces it's pressed onto, of pieces that carry it (carries()), however far each is from
   * the ground in bonds; for a piece pressed onto none, the faces of its bonds to pieces that carry
   * it (at its sides). As built, anything goes (a jetty, a cornice): what was built was built to
   * stand. Pieces made since (a blast's cells) don't.
   */
  private tips(p: Piece, center: V3): boolean {
    if (!this.recording && !(p.builtOverhang >= 0)) return false;
    const faces = this.stands;
    faces.length = 0;
    for (const b of p.bonds) if (this.pressed(b, p) && this.carries(b.other(p), p)) faces.push(b);
    if (!faces.length) for (const b of p.bonds) if (this.carries(b.other(p), p)) faces.push(b);
    if (!faces.length) return false;
    const b = p.bounds;
    const allowed = this.recording ? 0 : p.builtOverhang + Math.max(0.12, 0.18 * Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]));
    // The faces, seen from above, as squares of their area. Within that of one of them, it's
    // within that of them all (most pieces: no need for their outline)
    let near = Infinity;
    for (const f of faces) {
      const h = Math.sqrt(f.area) / 2;
      near = Math.min(near, Math.hypot(Math.max(0, Math.abs(center[0] - f.center[0]) - h), Math.max(0, Math.abs(center[2] - f.center[2]) - h)));
    }
    let out = near;
    if (near > allowed && faces.length > 1) {
      const corners: V3[] = [];
      for (const f of faces) {
        const h = Math.sqrt(f.area) / 2;
        const [x, , z] = f.center;
        corners.push([x - h, 0, z - h], [x + h, 0, z - h], [x - h, 0, z + h], [x + h, 0, z + h]);
      }
      out = Math.max(0, overhang(center, corners).distance);
    }
    if (this.recording && (!this.recordFor || this.recordFor.has(p))) p.builtOverhang = out;
    return out > allowed && !this.recording;
  }

  /**
   * What a bond can carry now (`c`: with all its strength), its extra strength fading past its load
   * as built, all of it gone at margin times that. So it gives way before: one strengthened many
   * times over at about 1 + (margin - 1)² / (2·margin - 1) times its load as built (1.125 at the
   * default 1.5), one strengthened a little nearer margin times.
   */
  private holding(b: Bond, c: number, force: number): number {
    if (b.strength <= 1 || b.builtLoad <= 0 || force <= b.builtLoad) return c;
    const keep = Math.max(0, Math.min(1, (this.margin * b.builtLoad - force) / ((this.margin - 1) * b.builtLoad)));
    return (c * (1 + (b.strength - 1) * keep)) / b.strength;
  }

  /** What a bond can carry from `from` to `to`: pressed (to is under from) far more than sideways or hanging. */
  private bondCapacity(b: Bond, from: Piece, to: Piece): number {
    const support = Math.min(from.material.support, to.material.support);
    const k = this.pressed(b, from) ? Math.min(from.material.compression ?? 40, to.material.compression ?? 40) : 1;
    return Math.max(support * b.area * k * b.strength, 1e-9);
  }

  /**
   * Make what stands now stand as built: weigh it, and strengthen every bond carrying more than
   * 1/`margin` of what it can until it carries that (a building is made to carry its own weight;
   * a roof with a water tank on it has the beams for it). Call once, after building. Damage then
   * sends the weight along other bonds, which aren't strengthened, so what's undermined still
   * comes down; and a strengthened bond asked to carry more than it did as built loses its extra
   * strength (all of it at `margin` times that), so a building that has lost much of what carried
   * it comes down too. A bond strengthened many times over gives way at about 1 + (margin - 1)² /
   * (2·margin - 1) times its load as built (1.125 at the default margin), not at margin times.
   * Returns how many bonds were strengthened.
   */
  reinforce(margin = 1.5): number {
    this.margin = margin;
    for (const p of this.pieces) {
      p.builtOverhang = -1;
      for (const b of p.bonds) b.builtLoad = 0;
    }
    let n = 0;
    this.reinforcing = true;
    // Strengthening one bond changes how the weight shares out: a few rounds settle it
    for (let round = 0; round < 6; round++) {
      this.weigh();
      let changed = 0;
      for (const p of this.pieces)
        for (const b of p.bonds) {
          if (b.a !== p || b.load * margin <= 1) continue;
          b.strength *= b.load * margin;
          changed++;
        }
      n += changed;
      if (!changed) break;
    }
    // What each bond carries as built (its extra strength is for that), and how far out over what
    // it stands on each piece's weight bears as built
    this.recording = true;
    this.weigh();
    this.recording = this.reinforcing = false;
    for (const p of this.pieces) for (const b of p.bonds) if (b.a === p) b.builtLoad = b.force;
    // Props (and anything at rest) rest on what's built now; the scenery is all there too
    this.sceneryShapes = null;
    for (const p of this.pieces)
      if (p.state === 'rubble') {
        this.unlink(p);
        this.link(p, this.support([p]).under.get(p)!);
      }
    // Nothing gives way at the next update: it's been weighed
    this.weighAt = -1;
    this.settle();
    return n;
  }

  /** One round of giving way: the bonds carrying too much break, and what they held falls. How many broke. */
  private giveWay(): number {
    const over = this.weigh();
    for (const b of over) {
      this.unbond(b);
      this.emit('bondBreak', { bond: b });
    }
    // Settle even when nothing broke: pieces added standing on nothing fall at the first weighing
    this.settle();
    return over.length;
  }

  /**
   * A section comes loose whole: its pieces move, held together by joints that break on landing,
   * and turning over the edge of what it rests on as `turn` says (tipping()).
   */
  private drop(section: Piece[], turn: { pivot: V3; spin: V3 } | null = null): void {
    const inSection = new Set(section);
    const bonds = new Set<Bond>();
    for (const p of section) for (const b of p.bonds) if (inSection.has(b.other(p))) bonds.add(b);
    let volume = 0;
    let center: V3 = [0, 0, 0];
    for (const p of section) {
      volume += p.volume;
      center = [center[0] + p.pose.position[0] * p.volume, center[1] + p.pose.position[1] * p.volume, center[2] + p.pose.position[2] * p.volume];
    }
    center = scale(center, 1 / Math.max(volume, 1e-9));
    for (const p of section) this.loosenKeepingBonds(p, inSection);
    for (const b of bonds) this.join(b);
    if (turn) for (const p of section) p.body.set({ velocity: cross(turn.spin, sub(p.pose.position, turn.pivot)), angularVelocity: turn.spin });
    this.emit('collapse', { pieces: section, volume, center });
  }

  /**
   * How a standing section about to come loose turns over the edge of what it rests on: with its
   * centre of mass out past that edge, as fast as if it had tipped a little already (TIP); or, if
   * it's slender (a tower) and its centre of mass is out of the middle third of what it stands on
   * toward an edge, over that edge, just fast enough to go over: a base that can't pull back puts
   * ever more of the weight on that edge, and it crushes. Null when it stands square on what holds
   * it, or rests on nothing (it drops straight).
   */
  private tipping(section: Piece[]): { pivot: V3; spin: V3 } | null {
    const { points } = this.support(section);
    if (!points.length) return null;
    const { mass, center } = this.centerOf(section);
    const g = Math.hypot(...this.world.gravity);
    const o = overhang(center, points);
    let edge = o.edge;
    // The way it goes over: out from the edge toward its centre of mass
    let out = normalize([center[0] - edge[0], 0, center[2] - edge[1]]);
    let energy = mass * g * o.distance * TIP;
    if (o.distance <= BALANCE) {
      const mid = points.reduce((m: [number, number], q): [number, number] => [m[0] + q[0] / points.length, m[1] + q[2] / points.length], [0, 0]);
      const off: [number, number] = [center[0] - mid[0], center[2] - mid[1]];
      const e = Math.hypot(off[0], off[1]);
      const reach = reachToward(points, mid, off);
      const top = Math.max(...section.map((p) => p.bounds.max[1]));
      if (!(reach > 0) || e < reach / 3 || top - this.edgeHeight(points, mid) < 2 * reach) return null;
      out = [off[0] / e, 0, off[1] / e];
      edge = [mid[0] + out[0] * reach, mid[1] + out[2] * reach];
      // Raising its centre of mass over the edge, and a little more
      const h = center[1] - this.edgeHeight(points, edge);
      energy = 1.3 * mass * g * (Math.hypot(h, reach - e) - h);
    }
    const pivot: V3 = [edge[0], this.edgeHeight(points, edge), edge[1]];
    // About up × out: the side it goes over to goes down
    const axis = cross([0, 1, 0], out);
    let inertia = 0;
    for (const p of section) {
      const r = sub(p.pose.position, pivot);
      const along = dot(r, axis);
      inertia += p.mass * (dot(r, r) - along * along + (p.size * p.size) / 6);
    }
    const rate = Math.min(1.5, Math.sqrt((2 * energy) / Math.max(inertia, 1e-9)));
    return { pivot, spin: scale(axis, rate) };
  }

  private loosenKeepingBonds(piece: Piece, keep: Set<Piece>): void {
    for (const bond of [...piece.bonds]) if (!keep.has(bond.other(piece))) this.unbond(bond);
    this.unindex(piece);
    this.become(piece, 'loose');
    piece.still = 0;
    piece.body.setFixed(false);
    // Heavy pieces of a falling section say what they strike (impacts break it)
    this.watch(piece);
    this.loose.add(piece);
    this.wakeCarried(piece);
  }

  // --- Queries -------------------------------------------------------------------------------

  /** The first standing piece along a ray (exact, on the CPU: no waiting for the GPU). */
  raycast(origin: V3, direction: V3, maxDistance = 500): RayHit | null {
    const dir = normalize(direction);
    let best: RayHit | null = null;
    const tested = new Set<Piece>();
    const step = GRID * 0.5;
    for (let t = 0; t <= maxDistance + step; t += step) {
      if (best && best.distance < t - GRID * 2) break;
      const p: V3 = [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
      const set = this.grid.get(cellKey(Math.floor(p[0] / GRID), Math.floor(p[1] / GRID), Math.floor(p[2] / GRID)));
      if (!set) continue;
      for (const piece of set) {
        if (tested.has(piece)) continue;
        tested.add(piece);
        const h = raycastConvex(piece.convex, origin, dir, maxDistance);
        if (h && (!best || h.t < best.distance)) best = { piece, distance: h.t, normal: h.n, point: [origin[0] + dir[0] * h.t, origin[1] + dir[1] * h.t, origin[2] + dir[2] * h.t] };
      }
    }
    return best;
  }

  /**
   * How many pieces there are: in all, loose (moving, or at rest and not yet frozen; not those
   * hanging at rest on a hinge: still, or swaying within a few centimetres), hanging on a hinge
   * (swinging or not), standing (fixed or rubble), and the joints holding falling sections
   * together; and the vertices drawn.
   */
  get stats(): { pieces: number; loose: number; hanging: number; standing: number; joints: number; vertices: number } {
    let vertices = 0;
    for (const m of this.meshes.values()) vertices += m.stats.used;
    const hanging = this.hanging();
    let still = 0;
    for (const p of hanging) if (this.atRest(p)) still++;
    return { pieces: this.pieces.size, loose: this.loose.size - still, hanging: hanging.size, standing: this.pieces.size - this.loose.size, joints: this.jointBonds.size, vertices };
  }

  /**
   * Make the mesh of each material that has none yet, with a piece in it out of the way under the
   * world, so a frame drawn now makes its shaders: a material that only scenery waking into pieces
   * uses would make them at its first wake, a frame of a quarter to half a second. Returns what
   * takes those pieces out again, once that frame is drawn.
   */
  warm(): () => void {
    const made: Piece[] = [];
    for (const name of Object.keys(this.materials)) {
      if (this.meshes.has(name)) continue;
      const p = this.addBox({ material: name, size: [0.05, 0.05, 0.05], position: [made.length, -1000, 0], static: true, bond: false });
      if (p) made.push(p);
    }
    return () => {
      for (const p of made) this.removePiece(p);
    };
  }

  /** Every piece in the world (a copy). */
  all(): Piece[] {
    return [...this.pieces];
  }

  // --- Each frame ----------------------------------------------------------------------------

  /** Keep the loose pieces' poses fresh, freeze those at rest, shrink old small rubble away (and rubble past maxPieces). Call each frame. */
  update(dt: number): void {
    this.time += dt;
    if (this.unheld.size) {
      const boxes = [...this.unheld];
      this.unheld.clear();
      const near = new Set<Dormant>();
      for (const b of boxes)
        for (let i = Math.floor(b.min[0] / DORMANT_CELL); i <= Math.floor(b.max[0] / DORMANT_CELL); i++)
          for (let k = Math.floor(b.min[2] / DORMANT_CELL); k <= Math.floor(b.max[2] / DORMANT_CELL); k++) for (const d of this.dormantCells.get(`${i},${k}`) ?? []) if (!d.woken) near.add(d);
      for (const d of near)
        if (!d.woken && boxes.some((b) => Math.abs(b.max[1] - d.bounds.min[1]) < 0.05 && b.min[0] < d.bounds.max[0] && b.max[0] > d.bounds.min[0] && b.min[2] < d.bounds.max[2] && b.max[2] > d.bounds.min[2])) this.awaken(d);
    }
    // Blasts under way go on breaking, in what's left of this frame's budget (those fired since the
    // last update have had theirs); what's fired from now on draws on the next frame's
    this.work();
    this.spent = 0;
    for (const m of this.meshes.values()) m.flush();
    // A changed structure is weighed, round after round while bonds keep giving way
    if (this.weighAt >= 0 && this.time >= this.weighAt && !this.jobs.length) {
      this.weighAt = this.giveWay() ? this.time + this.cascade : -1;
    }
    for (const p of this.rubble) p.still += dt;
    if (this.loose.size && !this.reading && this.time - this.lastRead >= this.readInterval) {
      const since = this.time - this.lastRead;
      this.lastRead = this.time;
      const list = [...this.loose];
      this.reading = this.world
        .read(list.map((p) => p.body))
        .then(() => this.afterRead(list, Math.min(since, 0.5)))
        .finally(() => (this.reading = null));
    }
    // What came to rest is looked at a few each frame, until the next readback
    if (this.atRestNow) this.rest(this.atRestNow);
    // Small rubble goes after a while, shrinking away (not from under other rubble, nor out of
    // rubble that came to rest joined: that would stir the pile; nor what a hinge holds, which may
    // hang in the air)
    for (const p of this.rubble) {
      if (p.size < p.material.dustSize * 2 && p.still > p.material.rubbleLife && !p.prop && !p.carried?.size && !p.bonds.size && !this.hinges.get(p)?.some(({ hinge }) => hinge.holding)) this.dissolve(p);
    }
    // Past the budget, a share of what's over, now and then
    if (this.pieces.size - this.dissolving.size > this.maxPieces && this.time >= this.budgetAt) {
      this.budgetAt = this.time + BUDGET.every;
      this.trim();
    }
    if (this.dissolving.size) this.shrink();
    // Too many loose: the smallest go first, but not props (a car, a crate) nor what hangs (a sign)
    if (this.loose.size > this.maxLoose) {
      const hanging = this.hanging();
      const extra = [...this.loose]
        .filter((p) => !p.prop && !hanging.has(p))
        .sort((a, b) => a.volume - b.volume)
        .slice(0, this.loose.size - this.maxLoose);
      for (const p of extra) this.removePiece(p);
    }
  }

  /**
   * Past maxPieces: start dissolving a share of what's over (it comes down over a few seconds, and
   * not many go at once), from the rubble at rest a while: what's out of the viewer's view before
   * anything in it, and of each what looks smallest from them first, its size over its distance.
   * Rubble that came to rest joined goes together, or not at all; never from under other rubble
   * lying on it from above (its centre higher: that goes first). What only leans on it rests on as
   * it lies once it's gone (shrink()).
   */
  private trim(): void {
    const over = this.pieces.size - this.dissolving.size - this.maxPieces;
    const n = Math.min(over, Math.max(BUDGET.least, Math.ceil(over * BUDGET.share)), BUDGET.most - this.dissolving.size);
    if (n <= 0) return;
    const viewer = (this.viewer ??= (this.scene?.getObjectByProperty('isCamera', true) as THREE.Camera | undefined) ?? null);
    const eye = viewer && new THREE.Vector3().setFromMatrixPosition(viewer.matrixWorld);
    const view = viewer && new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(viewer.projectionMatrix, viewer.matrixWorldInverse));
    const sphere = new THREE.Sphere();
    const seen = new Set<Piece>();
    const units: Array<{ pieces: Piece[]; inView: boolean; looks: number }> = [];
    for (const p of this.rubble) {
      if (seen.has(p)) continue;
      const group = p.bonds.size ? this.groupOf(p, 'rubble') : [p];
      for (const q of group) seen.add(q);
      const members = new Set(group);
      const free = (q: Piece) => [...(q.carried ?? [])].every((r) => members.has(r) || r.pose.position[1] <= q.pose.position[1]);
      if (!group.every((q) => (!q.prop || q.prop.debris) && !this.hinged.has(q) && !this.dissolving.has(q) && q.still >= BUDGET.settled && free(q))) continue;
      const size = Math.cbrt(group.reduce((v, q) => v + q.volume, 0));
      sphere.center.set(...this.centerOf(group).center);
      sphere.radius = size;
      units.push({ pieces: group, inView: !!view?.intersectsSphere(sphere), looks: size / Math.max(1, eye ? eye.distanceTo(sphere.center) : 1) });
    }
    units.sort((a, b) => Number(a.inView) - Number(b.inView) || a.looks - b.looks);
    let started = 0;
    for (const { pieces } of units) {
      if (started >= n) break;
      // Joined, they'd wake each other as each goes: they part, and go together
      for (const q of pieces) for (const b of [...q.bonds]) this.unbond(b);
      for (const q of pieces) this.dissolve(q);
      started += pieces.length;
    }
  }

  /**
   * A piece starts to go (the budget's, or small rubble cleared): it shrinks away over DISSOLVE
   * seconds into the point under its centre at its lowest, so it sinks into what it lies on rather
   * than popping out of sight, and is taken out once it's gone.
   */
  private dissolve(p: Piece): void {
    if (this.dissolving.has(p)) return;
    const [x, , z] = p.pose.position;
    const foot = toLocal(p.pose.position, p.pose.rotation, [x, p.bounds.min[1], z]);
    this.dissolving.set(p, { since: this.time, faces: p.draw ? drawFaces(p.local.faces, p.texture, p.material.uvScale) : null, foot });
  }

  /** What's dissolving shrinks a little more each frame (drawn again, smaller), and goes once it's gone. */
  private shrink(): void {
    for (const [p, { since, faces, foot }] of this.dissolving) {
      const t = (this.time - since) / DISSOLVE;
      if (t >= 1) {
        // What only leans on it (its centre no higher) rests on as it lies, held by the rest of
        // what it touches (woken, each piece that goes from a pile would stir those round it);
        // what came to lie on it as it went wakes
        for (const r of [...(p.carried ?? [])])
          if (r.pose.position[1] <= p.pose.position[1]) {
            p.carried!.delete(r);
            r.under = r.under.filter((q) => q !== p);
          }
        this.removePiece(p);
        continue;
      }
      if (!faces || !p.draw) continue;
      // Slowly at first and at the last, as a smoothstep
      const k = 1 - t * t * (3 - 2 * t);
      const mesh = this.meshes.get(p.materialName)!;
      mesh.release(p.draw);
      p.draw = mesh.insert(p.body.index, faces.map((f) => ({ ...f, pts: f.pts.map((q) => lerp(foot, q, k)) })), p.tint, p.texture, p.state);
    }
  }

  /**
   * Break a moving piece where it struck (or into the cells of `seeds`): its cells take its motion
   * (each point of it moving as it moved, turning included) and `push` (a blast's throw), the
   * smallest flying as particles; a puff of dust goes up. The cells made (null: it couldn't be cut).
   */
  private shatterLoose(piece: Piece, at: V3, seeds?: V3[], push?: (cell: Cell) => V3 | null): Piece[] | null {
    if (piece.prop) return null;
    const m = piece.material;
    const c = piece.convex;
    const count = Math.min(m.maxPieces, 12, Math.max(3, Math.round((piece.size / m.fragmentSize) ** 2 * 0.6)));
    seeds ??= impactSeeds(c, { at: this.inside(piece, at), count, spread: Math.max(m.fragmentSize, piece.size * 0.4), rand: this.rand });
    const cells = voronoi(c, seeds, 1e-6, this.grainOf(piece));
    if (cells.length < 2) return null;
    const v = piece.body.velocity;
    const w = piece.body.angularVelocity;
    const com = piece.pose.position;
    const textureWorld = piece.textureFrame;
    this.removePiece(piece);
    const made: Piece[] = [];
    for (const cell of cells) {
      const r = sub(cell.centroid, com);
      const vel = this.capped(add(add(v as V3, cross(w as V3, r)), push?.(cell) ?? [0, 0, 0]));
      if (Math.cbrt(cell.volume) < m.minBodySize) {
        this.emit('debris', { at: cell.centroid, velocity: vel, volume: cell.volume, material: piece.materialName });
        continue;
      }
      const p = this.create(cell.convex, null, piece.materialName, textureWorld, piece.tint, 'loose', false, vel, w as V3);
      if (!p) continue;
      // Its cells collide as it did (a car's window's shards don't with the car they came out of)
      p.body.setCollisionGroups(piece.body.group, piece.body.collidesWith);
      this.watch(p);
      made.push(p);
    }
    this.emit('dust', { at, volume: piece.volume * 0.4, material: piece.materialName });
    this.emit('fracture', { piece, pieces: made, at });
    return made;
  }

  /** A piece's grain (its material's, along its texture frame's axis), for cutting it. */
  private grainOf(piece: Piece): Grain | undefined {
    const g = piece.material.grain;
    if (!g) return undefined;
    const unit: V3 = g.axis === 'u' ? [1, 0, 0] : g.axis === 'v' ? [0, 1, 0] : [0, 0, 1];
    return { axis: rotate(multiply(piece.pose.rotation, piece.texture.rotation), unit), stretch: g.stretch };
  }

  /**
   * Say what landed, then break those that landed hard and what heavy falling pieces struck: a few
   * per readback, the hardest first, the landings taking turns by material (stone falling with the
   * tiles doesn't leave every tile whole). `read`: the pieces this readback read.
   */
  private strike(read: Piece[]): void {
    for (const tally of new Set(this.touching.values())) {
      const by = new Map<string, number>();
      let mass = 0;
      let momentum = 0;
      for (const p of tally.pieces) {
        mass += p.mass;
        momentum += p.mass * length(this.velocities.get(p) ?? p.body.velocity);
        by.set(p.materialName, (by.get(p.materialName) ?? 0) + p.mass);
      }
      const material = [...by].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      // As it fell; struck before a readback said, as hard as its touches stopped it
      this.emit('landed', { at: scale(tally.at, 1 / tally.weight), pieces: tally.pieces, mass, speed: (tally.seen ? momentum : Math.max(momentum, tally.impulse)) / mass, material });
    }
    this.touching.clear();
    if (this.cracking.size) this.crack();
    // How they move now, for the touches the next readback brings
    for (const p of read) if (p.state === 'loose') this.velocities.set(p, [...p.body.velocity] as V3);
    if (this.landings.length) {
      const byMaterial = new Map<string, Array<{ piece: Piece; at: V3; impulse: number }>>();
      for (const h of this.landings.splice(0).sort((a, b) => b.impulse - a.impulse)) {
        const list = byMaterial.get(h.piece.materialName);
        if (list) list.push(h);
        else byMaterial.set(h.piece.materialName, [h]);
      }
      const queues = [...byMaterial.values()];
      const done = new Set<Piece>();
      while (done.size < this.maxImpacts && queues.some((q) => q.length)) {
        for (const q of queues) {
          // Each material's hardest landing still to break, in turn
          let h = q.shift();
          while (h && (done.has(h.piece) || h.piece.state !== 'loose')) h = q.shift();
          if (!h || done.size >= this.maxImpacts) continue;
          done.add(h.piece);
          this.shatterLoose(h.piece, h.at);
        }
      }
    }
    if (!this.impacts.length) return;
    const hits = this.impacts.splice(0).sort((a, b) => b.impulse - a.impulse);
    let n = 0;
    for (const h of hits) {
      if (n >= this.maxImpacts) break;
      if (h.struck.state !== 'fixed') continue;
      // Harder hits break more: the radius grows with the square root of how far past the threshold
      const radius = Math.min(1.6, 0.35 * Math.sqrt(h.impulse / h.struck.material.impact));
      this.explode({ at: h.at, radius, speed: 2, spin: 3, budget: 80 });
      n++;
    }
  }

  /**
   * A falling section cracks where its pieces strike: as each first strikes something since it came
   * loose, each of its joints gives way if the energy of its two pieces' strike (their speed into
   * what it struck, as of the readback before; the other's, with none since it was let go, as the
   * struck one's) is more than the joint's strength takes over TOUGH. A facade falling flat into the
   * street comes apart; a wall sliding down onto the pile doesn't, nor what's still in the air.
   */
  private crack(): void {
    for (const [p, { into, speed }] of this.cracking)
      for (const b of [...p.bonds]) {
        if (!b.joint || b.area >= WELD) continue;
        const q = b.other(p);
        const v = this.velocities.get(q);
        const s = (speed + (v ? Math.max(0, dot(v, into)) : speed)) / 2;
        const reduced = (p.mass * q.mass) / (p.mass + q.mass);
        if (0.5 * reduced * s * s <= Math.min(p.material.strength, q.material.strength) * b.area * TOUGH) continue;
        this.unbond(b);
        this.emit('bondBreak', { bond: b });
      }
    this.cracking.clear();
  }

  private afterRead(list: Piece[], dt: number): void {
    // Poses first (as of when the readback was taken): what breaks on landing breaks where it is now
    for (const p of list) {
      if (p.state !== 'loose') continue;
      p.moved({ position: p.body.position, rotation: p.body.rotation });
      this.posed.set(p, this.lastRead);
    }
    this.strike(list);
    const resting = new Set<Piece>();
    const hanging = this.hanging();
    for (const p of list) {
      if (p.state !== 'loose') continue;
      const b = p.body;
      // Fallen off the world, or flung far
      const [x, y, z] = p.pose.position;
      if (y < this.killBelow || Math.hypot(x, z) > this.killBeyond || y - (this.ground ?? 0) > this.killBeyond) {
        this.removePiece(p);
        continue;
      }
      const v = b.velocity;
      const w = b.angularVelocity;
      // Still: slow, and not creeping on (sliding slowly off what it's on isn't resting). Once it
      // has moved on, rubble that came to rest on it while it was still wakes (not at a jolt)
      if (!p.stoppedAt || distance(p.stoppedAt, p.pose.position) > CREEP) {
        p.stoppedAt = p.pose.position;
        p.still = 0;
        this.wakeCarried(p);
      }
      if (Math.hypot(v[0], v[1], v[2]) < 0.15 && Math.hypot(w[0], w[1], w[2]) < 0.3) p.still += dt;
      else p.still = 0;
      // Stopped, however it creeps or jitters: still within DRIFT of where it was after HALT seconds
      if (!p.driftFrom || distance(p.driftFrom, p.pose.position) > DRIFT) {
        p.driftFrom = p.pose.position;
        p.drift = 0;
      } else p.drift += dt;
      // (A piece hanging on a hinge swings, still or not: it never freezes there)
      if (this.atRest(p) && !hanging.has(p)) resting.add(p);
    }
    if (this.jams.size) this.clearJams();
    // Looked at from the next frame on (each has its own time for it), lowest first: a section's
    // turn comes with its lowest piece's
    const low = (p: Piece) => p.pose.position[1] - p.radius;
    this.atRestNow = resting.size ? { order: [...resting].sort((a, b) => low(a) - low(b)), resting, next: 0, seen: new Set(), hanging, cells: null } : null;
  }

  /** How long a loose piece has been at rest (s): still, or not moving on (DRIFT). */
  private rested(p: Piece): number {
    return Math.max(p.still, p.drift);
  }

  /** Whether a loose piece is at rest: still for a moment, or not moving on for a while. */
  private atRest(p: Piece): boolean {
    return p.still > 0.8 || p.drift > HALT;
  }

  /**
   * Freeze what has come to rest on something that holds it up: each piece, or each section still
   * joined together, whose centre of mass is over the touches pushing it up (the ground, scenery,
   * standing pieces, rubble, and loose pieces at rest under it). A section at rest that isn't held
   * can't stand as one (jammed between its neighbours, or propped on one end), nor one bent at a
   * joint (sagging across a gap): its joints give, and its pieces are looked at alone. A section at
   * rest in part, for a while, parts from the rest of it, which still moves. A piece that isn't held
   * (or a prop's welded parts, as one) stays loose, and drops clear of what it's jammed against
   * (unjam), or settles where it's wedged. Lowest first, REST_MS a frame; what's left over is looked
   * at in the next frames, until the next readback says afresh what's at rest. A big section that
   * won't fit in what's left of a frame's time has the next frame's to itself.
   */
  private rest(now: AtRest): void {
    const deadline = performance.now() + REST_MS;
    const { order, resting, seen, hanging } = now;
    // (The loose pieces by grid cell, once a readback: made this frame, nothing big fits after)
    let fresh = now.cells !== null;
    const cells = (now.cells ??= this.looseCells());
    while (now.next < order.length && performance.now() < deadline) {
      const p = order[now.next];
      if (p.state !== 'loose' || seen.has(p) || p.holdAt > this.time) {
        now.next++;
        continue;
      }
      const pieces = this.groupOf(p, 'loose');
      if (!fresh && pieces.length * PIECE_MS > deadline - performance.now()) break;
      fresh = false;
      now.next++;
      for (const q of pieces) seen.add(q);
      // (Jammed, any of it: it's dropping clear, and is looked at again once it has)
      if (pieces.some((q) => this.jams.has(q))) continue;
      if (!pieces.every((q) => resting.has(q))) {
        this.part(pieces.filter((q) => resting.has(q) && this.rested(q) > SETTLE));
        continue;
      }
      if (this.bent(pieces)) continue;
      const { center } = this.centerOf(pieces);
      // Balanced within a little of its size (the touches found are only those within REST_GAP):
      // on the ground (or the scenery), on that and what's under it, or on all that holds it
      const size = Math.cbrt(pieces.reduce((v, q) => v + q.volume, 0));
      const balanced = (points: V3[]) => overhang(center, points).distance <= BALANCE * (1 + size);
      const g = this.support(pieces, undefined, 'ground');
      if (balanced(g.points)) {
        this.freeze(pieces, g.under);
        continue;
      }
      const u = this.support(pieces, cells, 'under', balanced);
      if (balanced(u.points)) {
        this.freeze(pieces, u.under);
        continue;
      }
      const s = this.support(pieces, cells);
      if (balanced(s.points)) {
        this.freeze(pieces, s.under);
        continue;
      }
      // Leaning on something, it rests on that too: it wakes when that goes
      if (this.leans(center, s.points, s.sides)) {
        this.freeze(pieces, s.under, s.beside);
        continue;
      }
      // Its joints give, and its pieces are looked at alone; but a prop's welds hold (its parts are one piece)
      const joints = new Set<Bond>();
      for (const q of pieces) for (const b of q.bonds) if (b.joint && b.area < WELD) joints.add(b);
      if (joints.size) {
        for (const q of pieces) q.still = q.drift = 0;
        for (const b of joints) {
          this.unbond(b);
          this.emit('bondBreak', { bond: b });
        }
        continue;
      }
      // Jammed against what stands (nothing under it at all), or against the structure: neither
      // gives way, so it drops clear of them; and so does one over a gap, resting on one side and
      // propped on the other on rubble no lower than itself, or on a loose piece over the gap too
      // (a block in a V). Wedged in among rubble, still where it was though it passed through what
      // it touched, or touching nothing seen (held by something unseen: a body that isn't a
      // piece), it has settled there, on all it touches. Not while what's under it (as near as
      // their bounds tell; not what swings on a hinge) still moves, for HALT seconds at most: then
      // it rests on that too, and wakes when that moves on
      const members = new Set(pieces);
      const propped = this.overGap(center, members, cells) ? new Set(pieces.flatMap((q) => s.beside.get(q)!.filter((r) => r.state !== 'fixed' && r.pose.position[1] >= q.pose.position[1] && (r.state === 'rubble' || this.overGap(r.pose.position, new Set([r]), cells))))) : [];
      const jam = s.points.length ? [...s.against.filter((q) => q.state === 'fixed'), ...propped] : s.against;
      const rested = Math.min(...pieces.map((q) => this.rested(q)));
      // (Looked at again once it could settle there, not every readback till then: it costs)
      for (const q of pieces) q.holdAt = this.time + Math.max(0.5, SETTLE - rested);
      if (jam.length && rested < 2 * SETTLE) this.unjam(pieces, jam);
      else if (rested > SETTLE) {
        let onMoving = false;
        for (const q of pieces) {
          const moving = this.looseNear(q.bounds, cells).filter((r) => !members.has(r) && !hanging.has(r) && !this.atRest(r) && r.pose.position[1] < q.pose.position[1] && boxesOverlap(r.bounds, q.bounds, REST_GAP));
          if (!moving.length) continue;
          onMoving = true;
          s.beside.set(q, [...s.beside.get(q)!, ...moving]);
        }
        if (!onMoving || rested > SETTLE + HALT) this.freeze(pieces, s.under, s.beside);
      }
    }
    if (now.next >= order.length) this.atRestNow = null;
  }

  /**
   * Whether nothing at all is within HOLLOW under a point (a centre of mass): not the ground, the
   * scenery, a standing piece or rubble, nor a loose piece but `members`.
   */
  private overGap(at: V3, members: Set<Piece>, loose: LooseCells): boolean {
    const ground = this.groundAt(at[0], at[2]);
    if (ground !== null && at[1] - ground < HOLLOW) return false;
    const down: V3 = [0, -1, 0];
    if (this.raycast(at, down, HOLLOW)) return false;
    const below: Box3 = { min: [at[0], at[1] - HOLLOW, at[2]], max: at };
    const hits = (c: Convex) => raycastConvex(c, at, down, HOLLOW) !== null;
    if ((this.sceneryShapes ??= this.scenery()).some((s) => s.body.alive && boxesOverlap(s.bounds, below, 0) && hits(s.convex))) return false;
    return !this.looseNear(below, loose).some((q) => !members.has(q) && hits(q.convex));
  }

  /**
   * Part pieces of a section from the rest of it (their joints to it give way): those at rest for
   * a while, the rest still moving (a wall's foot at rest on the pile, its top still swaying).
   */
  private part(pieces: Piece[]): void {
    const members = new Set(pieces);
    for (const p of pieces)
      for (const b of [...p.bonds])
        if (b.joint && b.area < WELD && !members.has(b.other(p))) {
          this.unbond(b);
          this.emit('bondBreak', { bond: b });
        }
  }

  /**
   * Whether a section at rest is bent at its joints: one turned further than BEND from as it stood
   * is pulled open on one side (its middle sagged across a gap, or it lies broken over something),
   * and gives way. Metal's joints bend by design; a prop's welds hold.
   */
  private bent(pieces: Piece[]): boolean {
    let bent = false;
    for (const p of pieces)
      for (const b of [...p.bonds]) {
        if (b.a !== p || !b.joint || !b.turn || b.area >= WELD || (b.a.material.plastic && b.b.material.plastic)) continue;
        const now = multiply(conjugate(b.a.pose.rotation), b.b.pose.rotation);
        const off = multiply(conjugate(b.turn), now);
        if (2 * Math.acos(Math.min(1, Math.abs(off[3]))) <= BEND) continue;
        this.unbond(b);
        this.emit('bondBreak', { bond: b });
        bent = true;
      }
    return bent;
  }

  /**
   * Pieces at rest that nothing holds up (one, or a section, or a prop's parts), touching standing
   * pieces that don't hold them up either, are jammed against them (fixed pieces don't give way,
   * and friction against them can hold them): they pass through them, together, until they have
   * dropped (or tipped off what they rest on) clear of them, for `seconds` at most.
   */
  private unjam(pieces: Piece[], through: Piece[], seconds = 2): void {
    const jam = { pieces, groups: pieces.map((p) => p.body.group), through, until: this.time + seconds };
    for (const p of pieces) {
      this.jams.set(p, jam);
      p.body.setCollisionGroups(JAMMED);
    }
    for (const s of through) {
      const passed = this.passed.get(s);
      if (passed) passed.count++;
      else {
        this.passed.set(s, { count: 1, mask: s.body.collidesWith });
        s.body.setCollisionGroups(s.body.group, (s.body.collidesWith & ~JAMMED) >>> 0);
      }
    }
  }

  /** Jammed pieces clear of what they passed through, all of them (or still stuck after a while), collide with it again. */
  private clearJams(): void {
    for (const jam of new Set(this.jams.values())) {
      const inside = jam.pieces.some((p) => p.state === 'loose' && jam.through.some((s) => s.state !== 'gone' && boxesOverlap(s.bounds, p.bounds, 0)));
      if (inside && this.time < jam.until) continue;
      jam.pieces.forEach((p, i) => {
        this.jams.delete(p);
        if (p.state !== 'gone') p.body.setCollisionGroups(jam.groups[i]);
      });
      for (const s of jam.through) {
        const passed = this.passed.get(s)!;
        if (--passed.count) continue;
        this.passed.delete(s);
        if (s.state !== 'gone') s.body.setCollisionGroups(s.body.group, passed.mask);
      }
    }
  }

  /**
   * Pieces come to rest together: rubble, fixed until woken, each noting what it rests on (and,
   * given `beside`, what it touches at its sides: what it leans or is wedged against; and what
   * a hinge still holds it to, fallen with it).
   */
  private freeze(pieces: Piece[], under: Map<Piece, Piece[]>, beside?: Map<Piece, Piece[]>): void {
    const members = new Set(pieces);
    for (const p of pieces) {
      // Joined to another resting with it: the joint goes, the bond stays (they wake together)
      for (const bond of [...p.bonds]) {
        if (members.has(bond.other(p))) this.unjoin(bond);
        else this.unbond(bond);
      }
      this.loose.delete(p);
      this.become(p, 'rubble');
      p.still = 0;
      p.stoppedAt = null;
      p.drift = 0;
      p.driftFrom = null;
      p.body.setFixed(true);
      if (p.body.reportContacts) p.body.reportContacts = false;
      this.index(p);
      const held = this.hinges.get(p)?.flatMap(({ hinge, from }) => (from && hinge.holding ? [from] : [])) ?? [];
      this.link(p, [...(under.get(p) ?? []), ...(beside?.get(p) ?? []), ...held]);
    }
  }

  /**
   * What holds pieces up (a section, or one alone): the points where what they touch pushes them
   * up (the ground, scenery, standing pieces and rubble outside them, and, given the loose pieces,
   * loose ones at rest too), the pieces that do (`under`), the touches pushing them sideways (what
   * they may lean on) and, for each, the pieces those are on (`beside`), and the standing pieces
   * and rubble that touch them but don't hold them up at all (what they may be jammed against).
   * Rubble and loose pieces hold up only what's higher (its centre over theirs): two blocks at rest
   * in a V don't hold each other up. `only`, to look no further when that holds them: what the
   * ground and the scenery hold up, or that and what's under them (its centre lower), the nearest
   * first, until `enough` says what's found holds them.
   */
  private support(pieces: Piece[], loose?: LooseCells, only?: 'ground' | 'under', enough?: (points: V3[]) => boolean): { points: V3[]; sides: Touch[]; under: Map<Piece, Piece[]>; beside: Map<Piece, Piece[]>; against: Piece[] } {
    const members = new Set(pieces);
    const points: V3[] = [];
    const sides: Touch[] = [];
    const under = new Map<Piece, Piece[]>();
    const beside = new Map<Piece, Piece[]>();
    const against: Piece[] = [];
    // The ground's highest anywhere (a breakable ground's area has it at its bed): corners lower than that are looked at
    let g = this.ground;
    for (const ground of this.grounds) g = Math.max(g ?? -Infinity, ground.bed);
    const scenery = (this.sceneryShapes ??= this.scenery());
    // How what a piece touches pushes it: up (1, if it can hold it up), sideways (0) or not at all (-1)
    const pushes = (p: Piece, c: Convex, corners: V3[], holds = true): number => {
      let up = false;
      let side = false;
      for (const t of touches(p.convex, c, corners, REST_GAP))
        if (t.n[1] > UP && holds) {
          points.push(t.at);
          up = true;
        } else if (t.n[1] > -UP) {
          sides.push(t);
          side = true;
        }
      return up ? 1 : side ? 0 : -1;
    };
    for (const p of pieces) {
      const box = p.bounds;
      if (g !== null && box.min[1] < g + REST_GAP)
        for (const c of p.corners) {
          const floor = this.grounds.length ? this.groundAt(c[0], c[2]) : g;
          if (floor !== null && c[1] < floor + REST_GAP) points.push(c);
        }
      for (const s of scenery) if (s.body.alive && boxesOverlap(s.bounds, box, REST_GAP)) pushes(p, s.convex, s.corners);
      if (only === 'ground') continue;
      const mine: Piece[] = [];
      const by: Piece[] = [];
      under.set(p, mine);
      beside.set(p, by);
      // Standing pieces and rubble it touches, and loose pieces at rest (a moving one holds
      // nothing up, and nothing leans on it)
      const [x, y, z] = p.pose.position;
      const near = [...this.near(box, REST_GAP)].filter((s) => !members.has(s) && (only !== 'under' || s.pose.position[1] < y));
      if (loose) for (const q of this.looseNear(box, loose)) if (!members.has(q) && this.atRest(q) && (only !== 'under' || q.pose.position[1] < y) && boxesOverlap(q.bounds, box, REST_GAP)) near.push(q);
      if (only === 'under') near.sort((a, b) => Math.hypot(a.pose.position[0] - x, a.pose.position[2] - z) - Math.hypot(b.pose.position[0] - x, b.pose.position[2] - z));
      for (const s of near) {
        const k = pushes(p, s.convex, s.corners, s.state === 'fixed' || s.pose.position[1] < y);
        if (k > 0) {
          mine.push(s);
          if (enough?.(points)) return { points, sides, under, beside, against };
        } else if (k === 0) {
          by.push(s);
          if (s.state !== 'loose' && !against.includes(s)) against.push(s);
        }
      }
    }
    return { points, sides, under, beside, against };
  }

  /**
   * Whether pieces whose centre of mass is out past what holds them up lean on something instead (a
   * plank against a wall): a touch pushing them back over that edge, high enough above it that
   * friction at the edge (LEAN) can take its push. One level with the edge can't hold them: that's
   * a piece jammed sideways, or propped on a corner with its weight out over nothing.
   */
  private leans(center: V3, points: V3[], sides: Touch[]): boolean {
    const o = overhang(center, points);
    if (o.distance === Infinity || !sides.length) return false;
    const out = normalize([center[0] - o.edge[0], 0, center[2] - o.edge[1]]);
    const y = this.edgeHeight(points, o.edge);
    return sides.some((t) => t.n[0] * out[0] + t.n[2] * out[2] < -0.5 && t.at[1] - y >= o.distance / LEAN);
  }

  /** The height of the touches holding pieces up along an edge of them (seen from above). */
  private edgeHeight(points: V3[], edge: [number, number]): number {
    const near = points.filter((q) => Math.hypot(q[0] - edge[0], q[2] - edge[1]) < 0.5);
    return near.length ? near.reduce((s, q) => s + q[1], 0) / near.length : Math.min(...points.map((q) => q[1]));
  }

  /** The keys of the grid cells a box (grown by `margin`) is in. */
  private cells(b: Box3, margin = 0): string[] {
    const keys: string[] = [];
    for (let x = Math.floor((b.min[0] - margin) / GRID); x <= Math.floor((b.max[0] + margin) / GRID); x++)
      for (let y = Math.floor((b.min[1] - margin) / GRID); y <= Math.floor((b.max[1] + margin) / GRID); y++)
        for (let z = Math.floor((b.min[2] - margin) / GRID); z <= Math.floor((b.max[2] + margin) / GRID); z++) keys.push(cellKey(x, y, z));
    return keys;
  }

  /**
   * The loose pieces whose reach about their centre comes within REST_GAP of a box (their bounds,
   * which need their shape where they are now, may not). Not those frozen or gone since the cells
   * were made (they're kept until the next readback).
   */
  private looseNear(box: Box3, loose: LooseCells): Piece[] {
    const out: Piece[] = [];
    const add = (q: Piece) => {
      const c = q.pose.position;
      if (q.state === 'loose' && boxesOverlap({ min: c, max: c }, box, q.radius + REST_GAP)) out.push(q);
    };
    for (const k of this.cells(box, loose.reach)) for (const q of loose.cells.get(k) ?? []) add(q);
    for (const q of loose.big) add(q);
    return out;
  }

  /** The loose pieces by the grid cell their centre is in, and how far those reach; and those reaching further than a cell from it. */
  private looseCells(): LooseCells {
    const cells = new Map<string, Piece[]>();
    const big: Piece[] = [];
    let reach = 0;
    for (const p of this.loose) {
      if (p.radius + REST_GAP > GRID) {
        big.push(p);
        continue;
      }
      reach = Math.max(reach, p.radius + REST_GAP);
      const [x, y, z] = p.pose.position;
      const k = cellKey(Math.floor(x / GRID), Math.floor(y / GRID), Math.floor(z / GRID));
      const list = cells.get(k);
      if (list) list.push(p);
      else cells.set(k, [p]);
    }
    return { cells, big, reach };
  }

  /**
   * The world's fixed bodies that aren't pieces (the ground, steps, a quay) as convexes: what rests
   * on them is held up. Not those nothing collides with (a hinge's holder); those removed since are
   * passed over (support()). Looked at again by reinforce(), once all is built.
   */
  /** The scenery's shapes whose box seen from above may hold (x, z) (a grid of them, made with sceneryShapes). */
  private sceneryUnder(x: number, z: number): Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }> {
    const shapes = (this.sceneryShapes ??= this.scenery());
    if (this.sceneryGrid?.shapes !== shapes) {
      const cells = new Map<string, typeof shapes>();
      const big: typeof shapes = [];
      for (const sh of shapes) {
        const [i0, k0] = [Math.floor(sh.bounds.min[0] / SCENERY_CELL), Math.floor(sh.bounds.min[2] / SCENERY_CELL)];
        const [i1, k1] = [Math.floor(sh.bounds.max[0] / SCENERY_CELL), Math.floor(sh.bounds.max[2] / SCENERY_CELL)];
        if ((i1 - i0 + 1) * (k1 - k0 + 1) > 256) {
          big.push(sh);
          continue;
        }
        for (let i = i0; i <= i1; i++)
          for (let k = k0; k <= k1; k++) {
            const key = `${i},${k}`;
            const list = cells.get(key);
            if (list) list.push(sh);
            else cells.set(key, [sh]);
          }
      }
      this.sceneryGrid = { shapes, cells, big };
    }
    const g = this.sceneryGrid;
    const here = g.cells.get(`${Math.floor(x / SCENERY_CELL)},${Math.floor(z / SCENERY_CELL)}`);
    return here ? [...here, ...g.big] : g.big;
  }

  private scenery(): Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }> {
    const out: Array<{ body: Body; convex: Convex; corners: V3[]; bounds: Box3 }> = [];
    for (const body of this.world.bodies) {
      const shape = this.sceneryShape(body);
      if (shape) out.push(shape);
    }
    return out;
  }

  /** A body's shape as scenery: a fixed body in the world that isn't a piece's (else null). */
  private sceneryShape(body: Body): { body: Body; convex: Convex; corners: V3[]; bounds: Box3 } | null {
    if (!body.fixed || this.byBody.has(body) || !body.group || !body.collidesWith) return null;
    const { position, rotation } = body;
    let convex: Convex | null = null;
    if (body.shape === 'box') convex = boxConvex(body.size, position, rotation);
    else if (body.hull) {
      const v = body.hull.vertices;
      const points: V3[] = [];
      for (let i = 0; i + 2 < v.length; i += 3) points.push(add(rotate(rotation, [v[i], v[i + 1], v[i + 2]]), position));
      convex = hullConvex(points);
    }
    return convex ? { body, convex, corners: vertices(convex), bounds: bounds(convex) } : null;
  }

  /**
   * The scenery's shapes brought up to date after something dormant wakes, rather than made again
   * (8,000 bodies took 7-9 ms): those of bodies gone from the world dropped (its stand-in), those
   * of fixed bodies put in it since taken in (what its build put there: a hill under it), in the
   * grid sceneryUnder looks them up in too.
   */
  private refreshScenery(): void {
    const old = this.sceneryShapes;
    if (!old) return;
    const known = new Set(old.map((sh) => sh.body));
    const gone = old.filter((sh) => !sh.body.alive);
    const added: typeof old = [];
    for (const body of this.world.bodies) {
      if (known.has(body)) continue;
      const shape = this.sceneryShape(body);
      if (shape) added.push(shape);
    }
    if (!gone.length && !added.length) return;
    const shapes = [...old.filter((sh) => sh.body.alive), ...added];
    this.sceneryShapes = shapes;
    const g = this.sceneryGrid;
    if (g?.shapes !== old) return;
    const cellsOf = (sh: (typeof old)[number]): string[] | null => {
      const [i0, k0] = [Math.floor(sh.bounds.min[0] / SCENERY_CELL), Math.floor(sh.bounds.min[2] / SCENERY_CELL)];
      const [i1, k1] = [Math.floor(sh.bounds.max[0] / SCENERY_CELL), Math.floor(sh.bounds.max[2] / SCENERY_CELL)];
      if ((i1 - i0 + 1) * (k1 - k0 + 1) > 256) return null;
      const out: string[] = [];
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) out.push(`${i},${k}`);
      return out;
    };
    for (const sh of gone) {
      const keys = cellsOf(sh);
      if (!keys) g.big.splice(g.big.indexOf(sh), 1);
      else
        for (const key of keys) {
          const list = g.cells.get(key);
          const at = list?.indexOf(sh) ?? -1;
          if (list && at >= 0) list.splice(at, 1);
        }
    }
    for (const sh of added) {
      const keys = cellsOf(sh);
      if (!keys) g.big.push(sh);
      else
        for (const key of keys) {
          const list = g.cells.get(key);
          if (list) list.push(sh);
          else g.cells.set(key, [sh]);
        }
    }
    g.shapes = shapes;
  }

  /**
   * A blast reaching rubble throws it again, and what it rests joined to (a section come to rest)
   * goes with it as one, as a rigid body would; but what's at the blast's heart is torn off alone.
   */
  private throwRubble(piece: Piece, o: ExplosionOptions, result: ExplosionResult): void {
    const R = o.radius;
    // A prop that breaks, in the blast's heart: its pieces thrown as its cells would be
    if (piece.prop?.shards?.length && distance(piece.pose.position, o.at) < R * PROP_BREAK + piece.radius * 0.5) {
      result.loose.push(...this.breakProp(piece, o.at, { blast: o }));
      return;
    }
    const group = this.groupOf(piece, 'rubble');
    const kicks = new Map<Piece, V3>();
    for (const p of group) {
      const k = this.kick(p.pose.position, p.mass, o.at, R, o.speed ?? 12);
      if (k) kicks.set(p, k);
    }
    if (!kicks.has(piece)) return;
    // Torn from its group at the blast's heart (a prop's welded parts never are)
    const torn = new Set<Piece>();
    for (const p of kicks.keys()) if (group.length === 1 || (!p.prop && distance(p.pose.position, o.at) <= R * 0.5)) torn.add(p);
    for (const p of torn) for (const b of [...p.bonds]) if (b.area < WELD) this.unbond(b);
    // Each part (the group, or what's left of it torn apart) thrown as a rigid body is by its pieces' throws
    for (const p of group) {
      if (p.state !== 'rubble') continue;
      const part = this.wake(p);
      if (torn.has(p)) {
        p.body.set({ velocity: kicks.get(p)!, angularVelocity: this.randomSpin((o.spin ?? 10) * 0.5) });
        result.loose.push(p);
        continue;
      }
      const { velocities, spin } = this.rigid(part, kicks);
      for (const q of part) {
        q.body.set({ velocity: velocities.get(q)!, angularVelocity: spin });
        if (kicks.has(q)) result.loose.push(q);
      }
    }
  }

  on<K extends keyof Events>(event: K, listener: (e: Events[K]) => void): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  private emit<K extends keyof Events>(event: K, e: Events[K]): void {
    for (const l of this.listeners[event]) l(e);
  }

  /** The meshes drawing the pieces, one per material. */
  get drawn(): FragmentMesh[] {
    return [...this.meshes.values()];
  }

  dispose(): void {
    for (const p of [...this.pieces]) this.removePiece(p);
    for (const m of this.meshes.values()) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    this.blast?.destroy();
  }
}
