// What moves in Dust Town besides what breaks: the wind and its gusts (dust lifted off the street,
// the windmill's wheel turning, the hanging signs swinging and creaking, tumbleweeds rolling down
// the street), doves on the roofs and a hawk on the windmill that take off at a blast or the gun
// and come back, smoke from the forge, the water tower's tank spurting where it's shot (water.ts),
// and the chapel bell rung in alarm after a blast or a long burst, until it falls. Shot, the bell
// rings, a sign swings on what's left of it and a tumbleweed hops; a dove or the hawk in a round's
// way (or near a blast) is shot down (../../birds.ts). It also sees that the water
// tower, the fronts and the two-storey buildings' walls come down once what holds them up is shot
// out.

import * as THREE from 'three/webgpu';
import type { Destruction, Dormant, ExplosionResult, Hinge, ImpactEvent, LandedEvent, Piece, PropModel, V3, Voice } from '../../../lib/index.ts';
import { add, cross, frustum, normalize, random, rotate, scale, signedDistance, sub, toLocal } from '../../../lib/index.ts';
import { blown, Fall as Shot, first, reach as birdReach, struck } from '../../birds.ts';
import type { BulletHit, Burst, Round } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';
import { CHAIN, type Hanger, type WallWatch } from './fronts.ts';
import { ATLAS } from './signs.ts';
import type { Town } from './town.ts';
import { Water } from './water.ts';

const rand = random(2024);
const between = (a: number, b: number) => a + rand() * (b - a);
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The gusting wind: three slow sines, from about 0.3 (still) to 1.4 (a gust). */
export const gust = (t: number) => 0.85 + 0.3 * Math.sin(2 * Math.PI * 0.05 * t) + 0.18 * Math.sin(2 * Math.PI * 0.11 * t + 1.3) + 0.1 * Math.sin(2 * Math.PI * 0.23 * t + 2.1);

/** Seconds between the wind's pushes on what it moves (a readback's worth: a push answers the velocity read back). */
const PUSH = 0.1;
/** A tumbleweed's radius (m). */
const WEED = 0.42;

const step = new THREE.Vector3();
const axis = new THREE.Vector3();
const spun = new THREE.Quaternion();

/** A piece's pose, smoothed between readbacks (a loose piece's pose comes back ten times a second). */
class Follow {
  readonly p = new THREE.Vector3();
  readonly q = new THREE.Quaternion();
  private last: Piece['pose'] | null = null;
  private since = 0;
  private readonly target = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  readonly piece: Piece;
  constructor(piece: Piece) {
    this.piece = piece;
    this.p.set(...piece.pose.position);
    this.q.set(...piece.pose.rotation);
  }
  update(dt: number): void {
    const { pose, body } = this.piece;
    if (pose !== this.last) {
      this.last = pose;
      this.since = 0;
    }
    this.since = Math.min(this.since + dt, 0.15);
    this.target.set(...pose.position);
    this.turn.set(...pose.rotation);
    if (this.piece.state === 'loose') {
      // On from the last readback by its velocity
      const v = body.velocity;
      const w = body.angularVelocity;
      this.target.add(step.set(...v).multiplyScalar(this.since));
      const a = Math.hypot(...w) * this.since;
      if (a > 1e-5) this.turn.premultiply(spun.setFromAxisAngle(axis.set(...w).normalize(), a));
    }
    const k = 1 - Math.exp(-dt * 30);
    this.p.lerp(this.target, k);
    this.q.slerp(this.turn, k);
  }
}

/**
 * A hanging sign's chain, drawn from the arm down to what hangs from it (the board, or a part of it
 * after a round): that on its hinge, and where the link is on it (in its frame).
 */
interface Chain {
  mesh: THREE.Mesh;
  hinge: Hinge;
  board: Follow;
  at: THREE.Vector3;
  turn: THREE.Quaternion;
}

/** A hanging sign: its two chains (a board shot in two hangs from each by its half), and a creak owed once it's hung again. */
interface Sign {
  hanger: Hanger;
  chains: Chain[];
  creak: boolean;
}

/** What of a sign still hangs: its board, or the parts of it hung again (each once). */
const hanging = (g: Sign): Chain[] => g.chains.filter((c, i) => c.hinge.holding && g.chains.findIndex((o) => o.hinge === c.hinge) === i);

/** A tumbleweed, the furthest east it has got and when (one that stops gaining is caught on something), and when a round last made it hop. */
interface Weed {
  piece: Piece | null;
  east: number;
  at: number;
  hopped: number;
}

interface Dove {
  mesh: THREE.Group;
  wings: [THREE.Mesh, THREE.Mesh];
  perch: number;
  seat: V3;
  mode: 'perched' | 'away' | 'circle' | 'back' | 'gone' | 'shot';
  at: THREE.Vector3;
  v: THREE.Vector3;
  centre: THREE.Vector3;
  until: number;
  phase: number;
  /** Shot down: falling, then lying where it landed. */
  fall: Shot | null;
}

/**
 * The hawk: on the windmill (or a telegraph pole: its roosts) until a blast or the gun puts it up,
 * then climbing away from the noise, circling high over the town, and once it's been quiet a while
 * gliding back down over the town to high over a perch that stands ('down') and dropping onto it
 * ('in'). Its sitting figure and its flying one are drawn in turn.
 */
interface Hawk {
  mesh: THREE.Group;
  sitting: THREE.Group;
  flying: THREE.Group;
  wings: [THREE.Object3D, THREE.Object3D];
  mode: 'perched' | 'up' | 'circle' | 'down' | 'in' | 'shot';
  roost: number;
  at: THREE.Vector3;
  v: THREE.Vector3;
  /** Where it climbs to, and when it comes down (once the town has been quiet a while). */
  goal: THREE.Vector3;
  until: number;
  phase: number;
  /** Shot down: falling, then lying where it landed. */
  fall: Shot | null;
}

/** A wall being watched: watching what carries it, then (once its hits are in) let go, looked over as it lands, done. */
interface Fall {
  w: WallWatch;
  stage: 'watch' | 'cut' | 'down' | 'done';
  /** When the stage's next step is due. */
  at: number;
  /** The bays whose band has been hit. */
  blown: Set<number>;
  /** Where it's been hit, and those hits (broken over the next frames). */
  struck: V3[];
  hits: ExplosionResult[];
  /** What was let go with what of it had come loose already, and how many more looks it gets. */
  fell: Piece[];
  looks: number;
}

/** A sign's chain drawn where it is on what it hangs from. */
function place(c: Chain): void {
  c.mesh.position.copy(c.at).applyQuaternion(c.board.q).add(c.board.p);
  c.mesh.quaternion.copy(c.board.q).multiply(c.turn);
}

/** How far round a wall's box (frame) what of it has come loose already is looked for at its let-go. */
const NEAR: V3 = [0.6, 1, 0.8];
/** Up (a piece's own) within 30° of vertical: standing. */
const UPRIGHT = Math.cos(Math.PI / 6);
const ONE = new THREE.Vector3(1, 1, 1);

/** How near a round passes a dove, the hawk, to strike it (m); the way their models face. */
const DOVE = birdReach(0.54);
const HAWK = birdReach(1.3);
const FORWARD = new THREE.Vector3(0, 0, 1);

/** How far off the gun startles the doves after so many rounds: those close by at once, the street's in a couple of seconds (a blast's 40 m). */
const reach = (rounds: number) => Math.min(40, 8 + rounds * 1.2);

export class Life {
  private readonly town: Town;
  private readonly d: Destruction;
  private w = 0.85;
  private wasGust = false;
  private dustIn = 0;
  /** When the gust's swell of the wind's loop dies down again. */
  private swell = -1;
  /** When the wind next pushes the signs and the tumbleweeds. */
  private pushIn = 0;
  // Windmill
  private wheel: THREE.Group | null = null;
  private wheelPose: Follow | null = null;
  private wheelOffset = new THREE.Vector3();
  private spin = 0;
  private spinRate = 0;
  private loop: Voice | null = null;
  /** The wheel turning as drawn until a round or a blast reaches it; then it's pieces, stopped. */
  private wheelSleep: Dormant | null = null;
  private jammed = false;
  // Signs, birds, weeds, hawk, bell, forge, the tank's water
  private readonly signs: Sign[] = [];
  private readonly doves: Dove[] = [];
  private readonly perches: Array<{ at: V3; piece: Piece | null }>;
  private readonly weed: PropModel;
  private readonly weeds: Weed[] = [];
  private readonly hawk: Hawk;
  /** When it next cries while it's up. */
  private hawkIn = between(20, 40);
  private readonly water: Water;
  /** The gun's burst going on: when its last round struck, and how many have. */
  private lastRound = -Infinity;
  private rounds = 0;
  private tolls: number[] = [];
  private lastAlarm = -Infinity;
  private puffs = 0;
  private smokeIn = 0;
  // The water tower: legs cut, then the top let go over toward them
  private towerCheck = 0;
  private towerCreaked = false;
  private tower: 'watch' | 'snap' | 'done' = 'watch';
  private towerAt = 0;
  /** Which way it goes over: toward its cut legs. */
  private towerFall: V3 = [0, 0, 1];
  // The watched walls
  private readonly falls: Fall[];
  private wallCheck = 0;

  constructor(town: Town, d: Destruction) {
    this.town = town;
    this.d = d;
    this.falls = town.walls.map((w) => ({ w, stage: 'watch' as const, at: 0, blown: new Set<number>(), struck: [], hits: [], fell: [], looks: 2 }));
    // Three tumbleweeds down the street, props the wind pushes along
    this.weed = tumbleweed();
    for (let i = 0; i < 3; i++) this.weeds.push({ piece: this.addWeed(-40 + i * 28 + rand() * 10, i), east: -Infinity, at: 0, hopped: 0 });
    // What's drawn besides the pieces is made now, with the town, so the demo's warm-up before play
    // draws it (the windmill's wheel made at the first frame compiled its shaders the first time it
    // came into view)
    const scene = d.scene!;
    // The windmill's wheel rides the gearbox
    const g = town.gearbox;
    if (g) {
      this.wheel = windmillWheel();
      this.wheelPose = new Follow(g);
      const inv = new THREE.Quaternion(...g.pose.rotation).invert();
      this.wheelOffset.set(...town.hub).sub(new THREE.Vector3(...g.pose.position)).applyQuaternion(inv);
      this.wheel.position.copy(this.wheelOffset).applyQuaternion(this.wheelPose.q).add(this.wheelPose.p);
      this.wheel.quaternion.copy(this.wheelPose.q);
      scene.add(this.wheel);
      // Dormant while the gearbox stands: what reaches it jams it, and it's its pieces where it stopped
      const [hx, hy, hz] = town.hub;
      this.wheelSleep = d.addDormant({ name: 'windmill wheel', bounds: { min: [hx - 0.2, hy - 1.65, hz - 1.65], max: [hx + 0.2, hy + 1.65, hz + 1.65] }, build: (dd) => this.wheelPieces(dd) });
    }
    // The hanging signs' chains, from the arm down to each end of the board (in the board's frame:
    // its length along z, its top at half its height)
    const iron = new THREE.MeshStandardNodeMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.6 });
    const link = new THREE.BoxGeometry(0.012, CHAIN, 0.012);
    for (const hanger of town.hangers) {
      const board = new Follow(hanger.hinge.piece);
      const chains = [-0.38, 0.38].map((z) => {
        const mesh = new THREE.Mesh(link, iron);
        mesh.castShadow = true;
        scene.add(mesh);
        const c: Chain = { mesh, hinge: hanger.hinge, board, at: new THREE.Vector3(0, ATLAS.hang[1] / 2 + CHAIN / 2, z), turn: new THREE.Quaternion() };
        place(c);
        return c;
      });
      this.signs.push({ hanger, chains, creak: false });
    }
    // A board shot apart hangs on by what's left of it
    d.on('fracture', (e) => {
      const sign = this.signs.find((g) => g.chains.some((c) => c.hinge.piece === e.piece));
      if (sign) this.rehang(sign, e.piece, e.pieces);
    });
    // Doves on the perches; the perches stand while what's under them does
    this.perches = town.perches.map((at) => {
      const hit = d.raycast([at[0], at[1] + 3, at[2]], [0, -1, 0], 6);
      return { at, piece: hit?.piece ?? null };
    });
    for (let i = 0; i < 12; i++) {
      const perch = i < 7 ? 2 : i < 11 ? 1 : 0;
      const dove = makeDove();
      dove.mesh.name = 'western:dove';
      const seat = this.seat(perch, i);
      dove.mesh.position.set(...seat);
      dove.mesh.rotation.y = between(0, Math.PI * 2);
      scene.add(dove.mesh);
      this.doves.push({ ...dove, perch, seat, mode: 'perched', at: dove.mesh.position.clone(), v: new THREE.Vector3(), centre: new THREE.Vector3(), until: 0, phase: rand() * 10, fall: null });
    }
    // The hawk on the windmill, its flying figure drawn too (out of sight under the ground) so
    // both are made before play
    const hawk = makeHawk();
    hawk.mesh.name = 'western:hawk';
    this.hawk = { ...hawk, mode: 'perched', roost: 0, at: new THREE.Vector3(), v: new THREE.Vector3(), goal: new THREE.Vector3(), until: 0, phase: 0, fall: null };
    this.perch(this.hawk);
    hawk.flying.visible = true;
    hawk.flying.position.y = -30;
    scene.add(hawk.mesh);
    this.water = new Water(d, town.tower.tank);
  }

  /** A tumbleweed resting on the street at x (z at random), one of three shades. */
  private addWeed(x: number, shade: number): Piece | null {
    const a = rand() * Math.PI * 2;
    return this.d.addProp({ model: this.weed, material: 'hay', position: [x, WEED, between(-3, 2.5)], rotation: [0, Math.sin(a / 2), 0, Math.cos(a / 2)], tint: [0xffffff, 0xe6dccb, 0xd2c4ac][shade % 3] });
  }

  /** Once the sounds are in: the windmill's clank, and what a section landing in the street raises. */
  onStart(rt: WorldRuntime): void {
    if (this.town.gearbox?.state === 'fixed') this.loop = rt.sound.play('windmill.loop', { at: this.town.hub });
    rt.destruction.on('landed', (e) => this.landed(e, rt));
  }

  /** A seat on a perch for dove i: along the saloon's ridge, round the tank's roof, on the gable. */
  private seat(perch: number, i: number): V3 {
    const at = this.perches[perch]?.at ?? this.town.perches[perch];
    if (perch === 2) return [at[0], at[1], at[2] - 3.5 + (i % 7) * 1.1 + between(-0.2, 0.2)];
    if (perch === 1) {
      const a = (i / 4) * Math.PI * 2 + between(-0.3, 0.3);
      return [at[0] + Math.cos(a) * 1.0, at[1] - 0.36, at[2] + Math.sin(a) * 1.0];
    }
    return [at[0] + between(-0.4, 0.4), at[1] + 0.02, at[2]];
  }

  update(dt: number, rt: WorldRuntime): void {
    const t = rt.time;
    this.w = gust(t);
    const w = this.w;
    const s = Math.min(1, Math.max(0, (w - 0.3) / 1.1));
    rt.effects.wind.set(1.2 + 1.4 * s, 0, 0.3 + 0.3 * s);
    const cam = rt.camera.getWorldPosition(new THREE.Vector3());

    // Dust lifted off the street, more in a gust. Sunlit dust is paler than the dirt it's lifted
    // from, and it hangs low: a puff grows to about three times the cube root of its share of the
    // region, so about a puff per cubic metre keeps them near 4 m across and under 4 m high
    this.dustIn -= dt * (0.6 + w);
    if (this.dustIn <= 0) {
      this.dustIn = 1.2;
      // Not on top of the player
      const x = Math.max(-45, Math.min(45, cam.x + (rand() < 0.25 ? between(-14, -7) : between(6, 30))));
      const z = between(-5.5, 5.5);
      rt.effects.dustRegion([x, 0, z], [x + 4, 0.6, z + 3], between(4, 7) * (0.6 + w * 0.4), 0xeadcc4);
    }
    // A gust rising through 1: the wind swells, a long streak of dust upwind, the nearest signs creak
    const isGust = w > 1.0;
    if (isGust && !this.wasGust) {
      if (this.swell < 0) {
        rt.ambience.get('ambience.wind')?.setVolume(1.7, 1.4);
        this.swell = t + 1.6;
      }
      // Across the street from the player, so it drifts past rather than over them like a cloud
      const z = cam.z > 0 ? between(-5, -2) : between(2, 5);
      rt.effects.dustRegion([cam.x - 16, 0, z - 1], [cam.x - 4, 0.5, z + 1], 8, 0xeadcc4);
      const near = this.signs.map((g) => ({ g, on: hanging(g) })).filter(({ on }) => on.length).sort((a, b) => cam.distanceTo(a.on[0].board.p) - cam.distanceTo(b.on[0].board.p));
      for (const { g, on } of near.slice(0, 2)) {
        rt.sound.play('sign.creak', { at: on[0].board.p.toArray() as V3, delay: between(0, 0.8) });
        for (const c of on) rt.destruction.push(c.hinge.piece, scale(g.hanger.normal, between(0.25, 0.5)));
      }
    }
    this.wasGust = isGust;
    if (this.swell >= 0 && t >= this.swell) {
      rt.ambience.get('ambience.wind')?.setVolume(1, 1.6);
      this.swell = -1;
    }

    this.pushIn -= dt;
    const push = this.pushIn <= 0;
    if (push) this.pushIn += PUSH;
    this.updateWindmill(dt);
    this.updateSigns(dt, rt, push);
    this.updateDoves(dt, rt);
    if (push) this.updateWeeds(rt, cam);
    this.updateHawk(dt, rt);
    // The alarm tolls, while the bell still hangs, and it swings with each
    const bell = this.town.bell;
    while (this.tolls.length && this.tolls[0] <= t) {
      this.tolls.shift();
      if (!bell?.holding) continue;
      rt.sound.play('bell.toll', { at: bell.piece.pose.position });
      rt.destruction.push(bell.piece, [this.tolls.length % 2 ? 0.8 : -0.8, 0, 0]);
    }
    // A thin smoke off the forge's coals while they lie in the hearth
    this.smokeIn -= dt;
    const coals = this.town.forge;
    if (this.smokeIn <= 0 && coals?.state === 'fixed') {
      this.smokeIn = between(0.5, 0.9);
      rt.effects.puff(add(coals.pose.position, [between(-0.25, 0.25), 0.15, between(-0.1, 0.1)]), { color: 0x7a7470, rise: 0.7, size: 1.3, life: 5, opacity: 0.16 });
    }
    this.puffs = Math.max(0, this.puffs - dt * 6);
    this.water.update(dt, rt);
    this.updateTower(dt, rt);
    this.updateWalls(dt, rt);
  }

  /**
   * The watched walls. A ground-floor bay that's blown out has the floor band over it hit, so what's
   * above loses its footing. Once a wall's share of what carries it is gone (60% of a two-storey
   * front's ground-floor posts, 40% of a one-storey's; 60% of a side or back wall's ground floor), a
   * front's porch posts buckle (a side or back wall's floor band is cut along it), and once those
   * hits are in its ties are cut and it's let go turning out over its foot: a front into the street
   * with what its porch posts held, a wall away from the building. The library would bring most of
   * it down too, but straight down onto its stubs and porch; this lays it out. What of it still
   * stands on the rubble 2 s and 4 s on (a part that came loose before the let-go) is pushed over.
   */
  private updateWalls(dt: number, rt: WorldRuntime): void {
    this.wallCheck -= dt;
    if (this.wallCheck > 0) return;
    this.wallCheck = 0.05;
    const d = rt.destruction;
    const t = rt.time;
    const gone = (list: Piece[]) => list.filter((p) => p.state !== 'fixed').length / Math.max(1, list.length);
    for (const f of this.falls) {
      if (f.stage === 'done' || t < f.at) continue;
      const { w } = f;
      if (f.stage === 'watch') {
        w.bays.forEach((bay, i) => {
          if (f.blown.has(i) || bay.pieces.length < 2 || gone(bay.pieces) < 0.6) return;
          f.blown.add(i);
          f.struck.push(bay.over);
          d.hit(bay.over, 0.45, 1);
        });
        if (gone(w.base) < w.share) continue;
        rt.sound.play('timber.creak', { at: add(w.origin, rotate(w.rotation, [(w.min[0] + w.max[0]) / 2, w.min[1] + 2, (w.min[2] + w.max[2]) / 2])), volume: 1.2 });
        // A front's porch posts buckle first
        for (const at of w.porch) f.hits.push(d.hit(at, 0.25, 1));
        // Its floor band, where its bays haven't been hit already
        for (const at of w.under) {
          if (f.struck.some((c) => dist(c, at) < 0.6)) continue;
          f.hits.push(d.hit(at, 0.4, 1));
          rt.effects.dust(at, 0.1, 0xb8a080);
        }
        f.stage = 'cut';
        f.at = t + (w.kind === 'front' ? 0.5 : 0.25);
      } else if (f.stage === 'down') {
        // What of it landed standing in its plane on the rubble (a part the library let go straight
        // down while the porch posts were hit, say) is cut from what it came to rest joined to (a
        // push is shared with that) and pushed over its foot, turning out as the rest did
        const up = new Set(f.fell.filter((p) => (p.state === 'loose' || p.state === 'rubble') && p.pose.position[1] > 2 && near(w, p.pose.position) && Math.abs(rotate(p.pose.rotation, [0, 1, 0])[1]) > UPRIGHT));
        if (up.size) {
          for (const p of up)
            for (const b of [...p.bonds]) if (!up.has(b.other(p))) d.unbond(b);
          const low = Math.min(...[...up].map((p) => p.bounds.min[1]));
          const out = rotate(w.rotation, w.out);
          for (const p of up) d.push(p, add([0, 0.3, 0], scale(out, Math.max(1.2, 1.1 * (p.pose.position[1] - low)))));
        }
        f.at = t + 2;
        if (--f.looks === 0) f.stage = 'done';
      } else if (f.hits.every((h) => h.done)) {
        // Its ties cut, nails pulling out in a little dust, and turned out over its foot with what
        // its porch posts held
        const fixed = d.all().filter((p) => p.state === 'fixed');
        const own = fixed.filter((p) => inBox(w, p.pose.position, w.min, w.max));
        const porch = w.porchBox;
        const inside = new Set([...own, ...(porch ? fixed.filter((p) => inBox(w, p.pose.position, ...porch)) : [])]);
        const members = [...inside];
        const falling = [...d.loosePieces].filter((p) => !p.prop && near(w, p.pose.position));
        const ties: V3[] = [];
        for (const p of members)
          for (const b of [...p.bonds]) {
            if (inside.has(b.other(p))) continue;
            if (!ties.some((c) => dist(c, b.center) < 0.45)) ties.push(b.center);
            d.unbond(b);
          }
        for (const c of ties) rt.effects.dust(c, 0.12, 0xb8a080);
        if (own.length) {
          const edge = add(w.origin, rotate(w.rotation, w.face));
          const turn = scale(cross([0, 1, 0], rotate(w.rotation, w.out)), w.kind === 'front' ? 1.1 : 0.8);
          let mass = 0;
          let centre: V3 = [0, 0, 0];
          for (const p of members) {
            mass += p.mass;
            centre = add(centre, scale(p.pose.position, p.mass));
          }
          centre = scale(centre, 1 / mass);
          const foot: V3 = [edge[0], Math.min(...own.map((p) => p.bounds.min[1])), edge[2]];
          d.release(members, cross(turn, sub(centre, foot)), turn);
        }
        // Looked over 2 s and 4 s on, as it lands
        f.fell = [...members, ...falling];
        f.stage = 'down';
        f.at = t + 2;
      }
    }
  }

  /**
   * The water tower. Its legs carry it as columns, so two could hold the tank up for ever (or its
   * top settles on their stubs): once two are cut, the others groan and, a moment later, the top is
   * let go from its lowest joints, turning over toward the cut legs.
   */
  private updateTower(dt: number, rt: WorldRuntime): void {
    const tw = this.town.tower;
    const t = rt.time;
    if (this.tower === 'done' || !tw.legs.length || t < this.towerAt) return;
    const d = rt.destruction;
    if (this.tower === 'snap') {
      this.tower = 'done';
      const [cx, , cz] = tw.centre;
      const top = d.all().filter((p) => p.state === 'fixed' && Math.hypot(p.pose.position[0] - cx, p.pose.position[2] - cz) < 3 && p.pose.position[1] > tw.joint);
      if (!top.length) return;
      const out = this.towerFall;
      const turn = scale(cross([0, 1, 0], out), 0.5);
      let mass = 0;
      let centre: V3 = [0, 0, 0];
      for (const p of top) {
        mass += p.mass;
        centre = add(centre, scale(p.pose.position, p.mass));
      }
      centre = scale(centre, 1 / mass);
      const foot: V3 = [cx + out[0] * tw.spread, tw.joint, cz + out[2] * tw.spread];
      for (const at of tw.joints) rt.effects.dust(at, 0.2, 0xb8a080);
      d.release(top, cross(turn, sub(centre, foot)), turn);
      return;
    }
    this.towerCheck -= dt;
    if (this.towerCheck > 0) return;
    this.towerCheck = 0.25;
    const cut = tw.legs.map((leg, i) => (leg.some((p) => p.state !== 'fixed') ? i : -1)).filter((i) => i >= 0);
    const at = tw.legs[0][3]?.pose.position ?? tw.top;
    if (cut.length >= 1 && !this.towerCreaked) {
      this.towerCreaked = true;
      rt.sound.play('timber.creak', { at });
    }
    if (cut.length >= 2) {
      rt.sound.play('timber.creak', { at, volume: 1.2 });
      // Over toward the cut legs (two across a diagonal: toward the first)
      const mean = cut.reduce<V3>((m, i) => add(m, sub(tw.feet[i], tw.centre)), [0, 0, 0]);
      const dir: V3 = Math.hypot(mean[0], mean[2]) > 0.5 ? [mean[0], 0, mean[2]] : [tw.feet[cut[0]][0] - tw.centre[0], 0, tw.feet[cut[0]][2] - tw.centre[2]];
      this.towerFall = normalize(dir);
      this.tower = 'snap';
      this.towerAt = t + between(1.0, 1.6);
    }
  }

  private updateWindmill(dt: number): void {
    const g = this.town.gearbox;
    if (!this.wheel || !this.wheelPose || !g) return;
    const standing = g.state === 'fixed' && !this.jammed;
    // (Once the gearbox goes the wheel rides it down as drawn: nothing's to wake there)
    if (g.state !== 'fixed' && this.wheelSleep) this.wheelSleep.woken = true;
    if (this.jammed) this.wheel.visible = false;
    if (g.state === 'gone') {
      this.wheel.visible = false;
    } else {
      this.wheelPose.update(dt);
      const want = standing ? 0.6 + 2.2 * this.w : 0;
      this.spinRate += (want - this.spinRate) * (1 - Math.exp(-dt * (standing ? 0.7 : 2.5)));
      this.spin += this.spinRate * dt;
      this.wheel.position.copy(this.wheelOffset).applyQuaternion(this.wheelPose.q).add(this.wheelPose.p);
      this.wheel.quaternion.copy(this.wheelPose.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.spin));
    }
    // Its clank and squeak, louder and quicker in a gust; silent once it's down
    if (!this.loop) return;
    if (standing) {
      const k = Math.min(1, this.w / 1.2);
      this.loop.setVolume(0.55 + 0.45 * k, 0.3);
      this.loop.setRate(0.85 + 0.3 * k, 0.3);
    } else {
      this.loop.stop(0.2);
      this.loop = null;
    }
  }

  /**
   * The wheel stopped where it is (a round or a blast reached it): its hub bonded to the gearbox, its
   * eighteen blades to the hub, as pieces; the drawn wheel goes (its rings and arms with it).
   */
  private wheelPieces(d: Destruction): void {
    const w = this.wheel;
    const g = this.town.gearbox;
    if (!w || !g) return;
    this.jammed = true;
    w.visible = false;
    w.updateMatrixWorld(true);
    const at = (x: number, y: number, z: number): V3 => new THREE.Vector3(x, y, z).applyMatrix4(w.matrixWorld).toArray() as V3;
    const hub = d.addConvex({ material: 'iron', points: frustum(0.12, 0.12, 0.2, 10).map(([x, y, z]) => at(y - 0.1, x, z)), tint: 0x4a4440 });
    if (hub) d.bond(hub, g, 0.01);
    const [r0, r1, w0, w1] = [0.45, 1.6, 0.1, 0.3];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      // A blade's corners turned a about x, a little thickness either side
      const points: V3[] = [];
      for (const [x, y, z] of [
        [0.04, r0, -w0 / 2],
        [-0.04, r0, w0 / 2],
        [0.08, r1, -w1 / 2],
        [-0.08, r1, w1 / 2],
      ])
        for (const dx of [-0.01, 0.01]) points.push(at(x + dx, y * c - z * s, y * s + z * c));
      const blade = d.addConvex({ material: 'tin', points, tint: 0x9a948a });
      if (blade && hub) d.bond(blade, hub, 0.004);
    }
  }

  /**
   * The hanging signs swing on their hinges: the wind across their faces leans them (a push each
   * readback, buffeted), and their chains ride the boards. A sign whose arm falls goes with it; one
   * hung again on what was left of it after a round creaks.
   */
  private updateSigns(dt: number, rt: WorldRuntime, push: boolean): void {
    const wx = rt.effects.wind.x;
    for (const g of this.signs) {
      const on = hanging(g);
      for (const c of on) c.board.update(dt);
      for (const c of g.chains) {
        c.mesh.visible &&= c.hinge.holding;
        if (c.mesh.visible) place(c);
      }
      if (!on.length) continue;
      if (g.creak) {
        g.creak = false;
        rt.sound.play('sign.creak', { at: on[0].board.p.toArray() as V3, volume: 1.3 });
      }
      if (!push) continue;
      const n = g.hanger.normal;
      for (const c of on) rt.destruction.push(c.hinge.piece, scale(n, wx * n[0] * 0.04 * (1 + 0.6 * Math.sin(rt.time * 1.7 + c.board.p.x))));
    }
  }

  /**
   * A round shot a hanging board apart (`piece`, into `cells`): under each of its chains the biggest
   * cell there hangs on (one, or each half of a board shot in two), swinging away from the shot. A
   * chain with nothing under it but scraps too small to cut again goes, and they fall.
   */
  private rehang(g: Sign, piece: Piece, cells: Piece[]): void {
    const { arm, anchor, axis, normal } = g.hanger;
    if (arm.state !== 'fixed') return;
    const d = this.d;
    const { position, rotation } = piece.pose;
    const old = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion(...rotation), ONE);
    const holds = (cell: Piece, at: V3) => signedDistance(cell.local, toLocal(cell.pose.position, cell.pose.rotation, at)) < 0.03;
    const hung = new Map<Piece, { hinge: Hinge; board: Follow }>();
    for (const c of g.chains) {
      if (c.hinge.piece !== piece) continue;
      // Its foot on what hung (the link's lower end), and the biggest cell there
      const end = new THREE.Vector3(0, -CHAIN / 2, 0).applyQuaternion(c.turn).add(c.at);
      const foot = rotate(rotation, end.toArray()).map((v, k) => v + position[k]) as V3;
      const cell = cells.filter((q) => q.state === 'loose' && q.size > q.material.minSize * 1.5 && holds(q, foot)).sort((a, b) => b.volume - a.volume)[0];
      if (!cell) continue;
      let on = hung.get(cell);
      if (!on) {
        on = { hinge: d.hinge(cell, anchor, axis, { to: arm }), board: new Follow(cell) };
        hung.set(cell, on);
        // Swung away from the shot, as hard as a good shove (the cut flung it every way)
        const v = cell.body.velocity as V3;
        const side = Math.sign(v[0] * normal[0] + v[2] * normal[2]) || 1;
        d.push(cell, sub(scale(normal, side * 1.6), v));
      }
      // The link goes on with it: from the old piece's frame to the cell's
      const now = new THREE.Matrix4().compose(new THREE.Vector3(...cell.pose.position), new THREE.Quaternion(...cell.pose.rotation), ONE).invert().multiply(old);
      const m = now.multiply(new THREE.Matrix4().compose(c.at, c.turn, ONE));
      m.decompose(c.at, c.turn, new THREE.Vector3());
      Object.assign(c, on);
    }
    g.creak ||= hung.size > 0;
  }

  private updateDoves(dt: number, rt: WorldRuntime): void {
    for (const b of this.doves) {
      if (b.mode === 'gone') continue;
      b.phase += dt;
      if (b.fall) {
        // Shot: tumbling down, its wings limp and a last flutter dying away; lying spread there
        b.fall.update(dt, rt.floor);
        b.mesh.position.copy(b.fall.at);
        b.mesh.quaternion.copy(b.fall.q);
        const limp = b.fall.down ? 0.05 : 0.3 + 0.6 * Math.sin(b.phase * 16) * Math.exp(-b.fall.t * 1.5);
        b.wings[0].rotation.z = limp;
        b.wings[1].rotation.z = -limp;
        continue;
      }
      if (b.mode === 'perched') {
        // Folded wings, now and then a shuffle
        b.wings[0].rotation.z = 0.15;
        b.wings[1].rotation.z = -0.15;
        if (rand() < dt * 0.05) b.mesh.rotation.y += between(-0.8, 0.8);
        continue;
      }
      if (b.mode === 'back' && b.at.distanceTo(new THREE.Vector3(...b.seat)) < 1.2) {
        // Gliding in to land
        b.at.lerp(new THREE.Vector3(...b.seat), 1 - Math.exp(-dt * 4));
        b.mesh.position.copy(b.at);
        if (b.at.distanceTo(new THREE.Vector3(...b.seat)) < 0.04) {
          b.mode = 'perched';
          b.v.set(0, 0, 0);
          b.mesh.position.set(...b.seat);
          b.mesh.rotation.set(0, between(0, Math.PI * 2), 0);
        }
        continue;
      }
      const target = b.mode === 'away' || b.mode === 'circle' ? b.centre.clone() : new THREE.Vector3(...b.seat);
      if (b.mode === 'circle') {
        const a = b.phase * 0.35 + b.until;
        target.add(new THREE.Vector3(Math.cos(a) * 25, Math.sin(b.phase * 0.5) * 3, Math.sin(a) * 25));
      }
      const to = target.sub(b.at);
      const d = to.length();
      const speed = b.mode === 'back' ? Math.min(9, 1.5 + d * 0.6) : 10;
      b.v.lerp(to.normalize().multiplyScalar(speed), 1 - Math.exp(-dt * 1.6));
      b.at.addScaledVector(b.v, dt);
      b.mesh.position.copy(b.at);
      if (b.v.lengthSq() > 0.01) b.mesh.lookAt(b.at.clone().add(b.v));
      const flap = Math.sin(b.phase * 15) * 0.9;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
      if (b.mode === 'away' && d < 20) b.mode = 'circle';
      if (b.mode === 'circle' && rt.time > b.until) {
        // Home if the perch stands, else the highest that does, else away for good
        const ok = this.perches.findIndex((p, i) => i === b.perch && (!p.piece || p.piece.state === 'fixed'));
        if (ok < 0) {
          const other = this.perches.map((p, i) => ({ p, i })).filter(({ p }) => !p.piece || p.piece.state === 'fixed').sort((x, y) => y.p.at[1] - x.p.at[1])[0];
          if (other) {
            b.perch = other.i;
            b.seat = this.seat(other.i, Math.floor(rand() * 12));
          } else {
            b.mode = 'gone';
            b.mesh.visible = false;
            continue;
          }
        }
        b.mode = 'back';
      }
    }
  }

  /**
   * The tumbleweeds roll on with the wind (pushed toward its speed each readback), hop now and then
   * off a bump, and once past the east end of town come back in at the west; so does one caught on
   * something (it gains under 0.5 m east in 4 s), once it's out of the player's sight.
   */
  private updateWeeds(rt: WorldRuntime, cam: THREE.Vector3): void {
    const d = rt.destruction;
    const wind = rt.effects.wind;
    const t = rt.time;
    this.weeds.forEach((w, i) => {
      const p = w.piece;
      const [x, y, z] = p?.pose.position ?? [0, 0, 0];
      if (x > w.east + 0.5) {
        w.east = x;
        w.at = t;
      }
      const caught = t - w.at > 4 && Math.hypot(x - cam.x, z - cam.z) > 25;
      if (!p || p.state === 'gone' || x > 45 || caught) {
        if (p && p.state !== 'gone') d.removePiece(p);
        w.piece = this.addWeed(between(-70, -55), i);
        w.east = -Infinity;
        return;
      }
      const v = p.body.velocity;
      const low = y < WEED + 0.1;
      const hop = low && rand() < PUSH * 0.4 ? between(1.2, 2.4) * Math.min(1.5, Math.abs(v[0]) / 2) : 0;
      // Hardly at all off the ground: a weed in the air goes where it was thrown
      const k = low ? 0.35 : 0.05;
      // The wind's drift north, but not into the wagon's lane by the start, and east of the middle
      // of town back toward the street's middle: the chapel stands across its north half at the end
      const vz = x > 0 || z > 1.5 ? -z * 0.3 : wind.z * 0.3;
      d.push(p, [(wind.x * 0.9 - v[0]) * k, hop, (vz - v[2]) * k]);
    });
  }

  /** The hawk on its perch, climbing away, circling, or gliding back down; it cries now and then while it's up. */
  private updateHawk(dt: number, rt: WorldRuntime): void {
    const h = this.hawk;
    const t = rt.time;
    h.phase += dt;
    if (h.fall) {
      // Shot: tumbling down, its wings limp, then lying spread where it landed
      h.fall.update(dt, rt.floor);
      h.mesh.position.copy(h.fall.at);
      h.mesh.quaternion.copy(h.fall.q);
      const limp = h.fall.down ? 0.06 : 0.25 + 0.5 * Math.sin(h.phase * 11) * Math.exp(-h.fall.t * 1.5);
      h.wings[0].rotation.z = limp;
      h.wings[1].rotation.z = -limp;
      return;
    }
    if (h.mode === 'perched') {
      // (Its flying figure was drawn for the warm-up before play; not since)
      h.flying.visible = false;
      // Its perch gone from under it: up
      if (this.town.roosts[h.roost]?.piece?.state !== 'fixed') this.hawkUp(h.at.toArray() as V3, rt);
      else if (rand() < dt * 0.08) h.mesh.rotation.y = this.facing(h.roost) + between(-0.7, 0.7);
      return;
    }
    const seat = this.roostSeat(h.roost);
    if (h.mode === 'in' && h.at.distanceTo(seat) < 1.5) {
      // Gliding in to land, wings out, turning to face the street
      h.at.lerp(seat, 1 - Math.exp(-dt * 3));
      h.mesh.position.copy(h.at);
      h.mesh.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(axis.set(0, 1, 0), this.facing(h.roost)), 1 - Math.exp(-dt * 4));
      if (h.at.distanceTo(seat) < 0.03) this.perch(h);
      return;
    }
    let target: THREE.Vector3;
    let speed: number;
    let turn = 0.9;
    if (h.mode === 'up') {
      target = h.goal.clone();
      speed = 9;
      if (h.at.distanceTo(h.goal) < 8) h.mode = 'circle';
    } else if (h.mode === 'circle') {
      // Wide, slow circles high over the town
      const a = h.phase * 0.22;
      target = new THREE.Vector3(Math.cos(a) * 40, 48 + Math.sin(h.phase * 0.07) * 5, Math.sin(a) * 40);
      speed = 11;
      if (t > h.until) {
        // Back to its perch if it stands, else another; none: it stays up
        const roosts = this.town.roosts;
        const r = [h.roost, ...roosts.keys()].find((i) => roosts[i].piece?.state === 'fixed');
        if (r !== undefined) {
          h.roost = r;
          h.mode = 'down';
        } else h.until = t + 60;
      }
    } else if (h.mode === 'down') {
      // Over the town from above, to 6 m over the perch on its street side: the further off, the
      // higher it aims (gliding straight down at the perch, it clipped the saloon's false front)
      const over = seat.clone().setY(seat.y + 6);
      over.z += seat.z < 0 ? 3 : -3;
      const dh = Math.hypot(h.at.x - over.x, h.at.z - over.z);
      target = over.clone().setY(over.y + Math.max(0, dh - 4) * 0.6);
      speed = Math.min(10, 1.5 + h.at.distanceTo(over) * 0.35);
      if (h.at.distanceTo(over) < 2) h.mode = 'in';
    } else {
      // And from there down onto it, slowly and steering hard: in from the open side, clear of the
      // windmill's wheel, boom and vane
      target = seat.clone();
      speed = Math.min(2.5, 0.8 + h.at.distanceTo(seat) * 0.5);
      turn = 3;
    }
    const to = target.sub(h.at);
    h.v.lerp(to.normalize().multiplyScalar(speed), 1 - Math.exp(-dt * turn));
    h.at.addScaledVector(h.v, dt);
    h.mesh.position.copy(h.at);
    h.mesh.lookAt(h.at.clone().add(h.v));
    // Wingbeats climbing, a glide banked into the turn up high, a little flapping coming in
    const flap = h.mode === 'up' ? Math.sin(h.phase * 9) * 0.55 : h.mode === 'circle' ? 0.08 : Math.sin(h.phase * 6) * 0.15;
    h.wings[0].rotation.z = flap;
    h.wings[1].rotation.z = -flap;
    if (h.mode === 'circle') h.mesh.rotateZ(0.3);
    // Its cry, now and then while it's up
    this.hawkIn -= dt;
    if (this.hawkIn <= 0) {
      this.hawkIn = between(35, 80);
      rt.sound.play('hawk.cry', { at: h.at.toArray() as V3 });
    }
  }

  /** Where the hawk sits on a perch. */
  private roostSeat(i: number): THREE.Vector3 {
    return new THREE.Vector3(...this.town.roosts[i].at);
  }

  /** Which way it faces there: the street. */
  private facing(i: number): number {
    return this.town.roosts[i].at[2] < 0 ? 0 : Math.PI;
  }

  /** The hawk sits on its perch. */
  private perch(h: Hawk): void {
    h.mode = 'perched';
    h.v.set(0, 0, 0);
    h.at.copy(this.roostSeat(h.roost));
    h.mesh.position.copy(h.at);
    h.mesh.rotation.set(0, this.facing(h.roost), 0);
    h.sitting.visible = true;
    h.flying.visible = false;
  }

  /**
   * A blast or the gun from `at`: the hawk on its perch takes off away from it, crying, and climbs
   * to circle; one already up stays up for a minute or so more.
   */
  private hawkUp(at: V3, rt: WorldRuntime): void {
    const h = this.hawk;
    if (h.fall) return;
    const t = rt.time;
    h.until = t + between(55, 85);
    if (h.mode === 'down' || h.mode === 'in') h.mode = 'circle';
    if (h.mode !== 'perched') return;
    const away = h.at.clone().sub(new THREE.Vector3(...at)).setY(0);
    if (away.lengthSq() < 1) away.set(1, 0, 0);
    away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), between(-0.5, 0.5));
    h.mode = 'up';
    h.goal.copy(h.at).addScaledVector(away, 35).setY(30);
    h.v.set(away.x * 3, 3.5, away.z * 3);
    h.phase = 0;
    h.sitting.visible = false;
    h.flying.position.y = 0;
    h.flying.visible = true;
    this.hawkIn = between(35, 80);
    rt.sound.play('hawk.cry', { at: h.at.toArray() as V3, delay: between(0.5, 1.2) });
  }

  /** A round over the town: the first dove in its way, or the hawk, sat or flying, is shot down. */
  shoot(round: Round, rt: WorldRuntime): void {
    const dove = first(round, this.doveMiddles(), DOVE);
    const hawk = first(round, [this.hawkMiddle()], HAWK);
    if (dove >= 0) this.doveDown(this.doves[dove], this.pushOf(round, this.doves[dove].mode === 'perched'), rt);
    if (hawk >= 0) this.hawkDown(this.pushOf(round, this.hawk.mode === 'perched'), rt);
  }

  /** How a round pushes a bird it strikes: on with it; one sitting, off its perch (a round from below would only pin it there). */
  private pushOf(round: Round, sitting: boolean): THREE.Vector3 {
    const push = new THREE.Vector3(...round.direction);
    if (!sitting) return push.multiplyScalar(2);
    push.setY(0).normalize().multiplyScalar(between(2, 3));
    return push.setY(between(1.5, 2.5));
  }

  /** Where each dove's body is (null: gone or shot already). */
  private doveMiddles(): Array<THREE.Vector3 | null> {
    return this.doves.map((b) => (b.fall || b.mode === 'gone' ? null : b.at.clone().setY(b.at.y + 0.07)));
  }

  /** Where the hawk's body is: sitting, up off its perch (null: shot already). */
  private hawkMiddle(): THREE.Vector3 | null {
    const h = this.hawk;
    return h.fall ? null : h.mode === 'perched' ? h.at.clone().setY(h.at.y + 0.22) : h.at.clone();
  }

  private doveDown(b: Dove, push: THREE.Vector3, rt: WorldRuntime): void {
    const at = b.at.clone().setY(b.at.y + 0.07);
    // (Its wings are flat: it lies on its front, a little over, wings out, not on its side with one in the air)
    b.fall = new Shot(at, b.v, b.mesh.quaternion, push, FORWARD, 0.3, 0.04);
    b.mode = 'shot';
    struck(at, 0x6e6c70, 0.8, rt);
  }

  /** The hawk struck: down it comes, crying, in its flying figure. */
  private hawkDown(push: THREE.Vector3, rt: WorldRuntime): void {
    const h = this.hawk;
    const at = this.hawkMiddle()!;
    h.fall = new Shot(at, h.v, h.mesh.quaternion, push, FORWARD, 0.35, 0.06);
    h.mode = 'shot';
    h.sitting.visible = false;
    h.flying.position.y = 0;
    h.flying.visible = true;
    struck(at, 0x5e4330, 1.9, rt, 'hawk.cry');
  }

  onBlast(at: V3, radius: number, rt: WorldRuntime): void {
    const t = rt.time;
    const d = rt.destruction;
    // The birds near it blown out of the air (or off their perches)
    for (const { i, push } of blown(at, radius, this.doveMiddles())) this.doveDown(this.doves[i], push, rt);
    for (const { push } of blown(at, radius, [this.hawkMiddle()])) this.hawkDown(push, rt);
    this.alarm(at, t);
    // The doves near it flush; the hawk goes up
    this.flush([at], 40, t, rt);
    this.hawkUp(at, rt);
    // The blast's wind swings the signs nearby away from it (those in it are thrown by it)
    for (const g of this.signs) {
      const on = hanging(g);
      if (!on.length) continue;
      const p = on[0].hinge.piece.pose.position;
      const r = dist(p, at);
      if (r > 20) continue;
      const n = g.hanger.normal;
      const side = Math.sign((p[0] - at[0]) * n[0] + (p[2] - at[2]) * n[2]) || 1;
      for (const c of on) d.push(c.hinge.piece, scale(n, (side * radius * 3.5) / (r + 2)));
      if (r < 12) rt.sound.play('sign.creak', { at: p, delay: between(0.3, 0.9) });
    }
    // Tumbleweeds close by are thrown, up and away
    for (const { piece: p } of this.weeds) {
      if (!p || p.state === 'gone') continue;
      const [dx, , dz] = sub(p.pose.position, at);
      const r = Math.hypot(dx, dz);
      if (r > 8 || r < radius) continue;
      const k = between(6, 10) * (1 - r / 10);
      d.push(p, [(dx / r) * k, k * 0.7, (dz / r) * k]);
    }
  }

  /**
   * A round of the gun strikes: into the tank under the waterline it spurts (water.ts), the bell
   * rings and swings, a tumbleweed hops. And the town hears the gun: as a burst goes on, the doves
   * further and further from it take off (a few rounds startle those close by, a couple of seconds
   * the street's), and after a few rounds the hawk goes up.
   */
  onShot(hit: BulletHit, rt: WorldRuntime): void {
    const t = rt.time;
    const d = rt.destruction;
    const p = hit.piece;
    this.water.shot(hit, rt);
    const bell = this.town.bell;
    if (p && bell?.holding && p === bell.piece) {
      // (its pack's cooldown keeps a burst from ringing it every round)
      rt.sound.play('bell.shot', { at: hit.at });
      d.push(p, [hit.direction[0] * 0.35, 0, hit.direction[2] * 0.35]);
    }
    const weed = p && this.weeds.find((w) => w.piece === p);
    if (weed && p.pose.position[1] < WEED + 0.2 && t - weed.hopped > 0.3) {
      weed.hopped = t;
      d.push(p, [0, between(2.2, 3.4), 0]);
    }
    this.rounds = t - this.lastRound > 0.3 ? 1 : this.rounds + 1;
    this.lastRound = t;
    const gun = sub(hit.at, scale(hit.direction, hit.distance));
    this.flush([gun, hit.at], reach(this.rounds), t, rt);
    if (this.rounds === 4) this.hawkUp(gun, rt);
  }

  /** A burst has ended: whatever of the town it reached that hasn't stirred yet does now, and a long one brings out the alarm. */
  onBurst(burst: Burst, rt: WorldRuntime): void {
    const t = rt.time;
    const gun = rt.camera.getWorldPosition(new THREE.Vector3()).toArray() as V3;
    const at = burst.at ?? gun;
    this.flush([gun, at], reach(burst.rounds), t, rt);
    if (burst.rounds >= 4) this.hawkUp(gun, rt);
    if (burst.seconds >= 2.5) this.alarm(at, t);
  }

  /** Someone rings the alarm after a blast or a long burst near the chapel, while the bell still hangs; at most once in 25 s. */
  private alarm(at: V3, t: number): void {
    const bell = this.town.bell;
    if (!bell?.holding || dist(at, bell.piece.pose.position) > 45 || t - this.lastAlarm < 25) return;
    this.lastAlarm = t;
    const s = t + between(2, 3);
    this.tolls.push(s, s + 1.7, s + 3.4);
  }

  /** The perched doves within `range` of any of `from` take off, away from the first, and come back later. */
  private flush(from: V3[], range: number, t: number, rt: WorldRuntime): void {
    const flocks = new Set<number>();
    for (const b of this.doves) {
      if (b.mode !== 'perched' || !from.some((f) => dist(f, b.at.toArray() as V3) <= range)) continue;
      flocks.add(b.perch);
      const away = b.at.clone().sub(new THREE.Vector3(...from[0])).setY(0).normalize();
      if (!Number.isFinite(away.x)) away.set(1, 0, 0);
      away.applyAxisAngle(new THREE.Vector3(0, 1, 0), between(-0.4, 0.4));
      b.centre.copy(b.at).addScaledVector(away, 120).setY(30 + between(-4, 6));
      b.mode = 'away';
      b.v.set(away.x * 3, 4 + rand() * 2, away.z * 3);
      b.until = t + between(42, 55);
    }
    for (const p of flocks) rt.sound.play('birds.flush', { at: this.perches[p].at, delay: between(0.05, 0.25) });
  }

  onImpact(e: ImpactEvent, rt: WorldRuntime): void {
    // Things landing in the street raise its dust (the street's slabs are pieces of its ground)
    if ((e.other === null || e.other.ground) && e.impulse > 2 && this.puffs < 6) {
      this.puffs++;
      rt.effects.dust(e.at, Math.min(1.5, e.impulse * 0.05), 0xeadcc4);
    }
    const m = e.piece.materialName;
    if ((m === 'iron' && e.speed > 4) || (m === 'bronze' && e.speed > 3)) rt.effects.impact(e.at, [0, 1, 0], 0x6a5a50);
  }

  /** A section landing flat in the street (a front, a roof, the tank) slaps up a sheet of its dust. */
  private landed(e: LandedEvent, rt: WorldRuntime): void {
    if (e.mass < 0.5 || e.at[1] > 0.6) return;
    rt.effects.dust(e.at, Math.min(4, e.mass * e.speed * 0.08), 0xeadcc4);
  }
}

/** Whether a point (world) is in a box in a watched wall's frame. */
function inBox(w: WallWatch, at: V3, min: V3, max: V3): boolean {
  const p = toLocal(w.origin, w.rotation, at);
  return [0, 1, 2].every((k) => p[k] > min[k] && p[k] < max[k]);
}

/** Whether a point (world) is in a watched wall's box or within NEAR of it. */
function near(w: WallWatch, at: V3): boolean {
  return inBox(w, at, sub(w.min, NEAR), add(w.max, NEAR));
}

/**
 * A tumbleweed as a prop: its twigs drawn (tumbleweedGeometry), colliding as a ball of 32 points
 * (round enough to roll), as light as a dry bush.
 */
function tumbleweed(): PropModel {
  const object = new THREE.Mesh(tumbleweedGeometry(), new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 1 }));
  // Points spread evenly over a sphere (a Fibonacci spiral), a little inside the twigs' reach
  const collider: V3[] = Array.from({ length: 32 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 32;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    return scale([Math.cos(a) * r, y, Math.sin(a) * r], WEED * 0.92);
  });
  return { object, collider, hullVertices: 32, mass: 0.004, name: 'tumbleweed' };
}

/** The windmill's wheel: eighteen tin blades on two rings round a hub, turning about x. */
function windmillWheel(): THREE.Group {
  const g = new THREE.Group();
  const tin = new THREE.MeshStandardNodeMaterial({ color: 0x9a948a, metalness: 0.3, roughness: 0.7, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardNodeMaterial({ color: 0x4a4440, metalness: 0.5, roughness: 0.6 });
  const blade = new THREE.BufferGeometry();
  // A blade: narrow at the hub, wide at the rim, twisted a little
  const [r0, r1, w0, w1] = [0.45, 1.6, 0.1, 0.3];
  blade.setAttribute('position', new THREE.Float32BufferAttribute([0.04, r0, -w0 / 2, -0.04, r0, w0 / 2, 0.08, r1, -w1 / 2, -0.08, r1, w1 / 2], 3));
  blade.setIndex([0, 2, 1, 1, 2, 3]);
  blade.computeVertexNormals();
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(blade, tin);
    m.rotation.x = (i / 18) * Math.PI * 2;
    m.castShadow = true;
    g.add(m);
  }
  for (const r of [0.9, 1.55]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 4, 48), dark);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), dark);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  // Arms from the hub to the outer ring
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.5, 0.03), dark);
    arm.position.y = 0.8;
    const pivot = new THREE.Group();
    pivot.rotation.x = (i / 6) * Math.PI * 2;
    pivot.add(arm);
    g.add(pivot);
  }
  return g;
}

function makeDove(): { mesh: THREE.Group; wings: [THREE.Mesh, THREE.Mesh] } {
  const grey = new THREE.MeshStandardNodeMaterial({ color: 0x6e6c70, roughness: 0.9, side: THREE.DoubleSide });
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), grey);
  body.scale.set(0.07, 0.065, 0.15);
  body.position.y = 0.07;
  mesh.add(body);
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), grey);
  head.position.set(0, 0.13, 0.12);
  mesh.add(head);
  const wingGeometry = new THREE.PlaneGeometry(0.24, 0.12);
  wingGeometry.rotateX(-Math.PI / 2);
  wingGeometry.translate(0.12, 0, 0);
  const left = new THREE.Mesh(wingGeometry, grey);
  const right = new THREE.Mesh(wingGeometry, grey);
  left.position.set(0.03, 0.09, 0);
  right.position.set(-0.03, 0.09, 0);
  right.scale.x = -1;
  mesh.add(left, right);
  return { mesh, wings: [left, right] };
}

/**
 * A red-tailed hawk, its front along +z: sitting (upright, wings folded, a pale breast, half a
 * metre tall), and flying (wings of 1.3 m spread from the shoulders, a fanned tail), each drawn in
 * turn.
 */
function makeHawk(): { mesh: THREE.Group; sitting: THREE.Group; flying: THREE.Group; wings: [THREE.Object3D, THREE.Object3D] } {
  const look = (color: number) => new THREE.MeshStandardNodeMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const [brown, dark, pale, rufous] = [look(0x5e4330), look(0x3a2a20), look(0xd8c8ac), look(0x9a5a34)];
  const blob = (m: THREE.Material, size: V3, at: V3, tilt = 0) => {
    const o = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), m);
    o.scale.set(...size);
    o.position.set(...at);
    o.rotation.x = tilt;
    return o;
  };
  const sitting = new THREE.Group();
  sitting.add(
    blob(brown, [0.1, 0.21, 0.09], [0, 0.2, -0.01], -0.15),
    blob(pale, [0.08, 0.16, 0.055], [0, 0.22, 0.03], -0.15),
    blob(brown, [0.065, 0.065, 0.075], [0, 0.38, 0.015]),
    blob(dark, [0.015, 0.02, 0.035], [0, 0.37, 0.08]),
    // Wings folded down its sides, the tail hanging under them
    blob(dark, [0.03, 0.16, 0.08], [0.075, 0.2, -0.025], -0.25),
    blob(dark, [0.03, 0.16, 0.08], [-0.075, 0.2, -0.025], -0.25),
    blob(rufous, [0.05, 0.12, 0.012], [0, 0.03, -0.08], -0.35),
  );
  const flying = new THREE.Group();
  flying.add(blob(brown, [0.07, 0.06, 0.22], [0, 0, 0]), blob(brown, [0.05, 0.05, 0.06], [0, 0.01, 0.24]));
  // Outlines in their own plane (x across, y forward), laid flat: forward is +z
  const flat = (points: Array<[number, number]>) => new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))).rotateX(Math.PI / 2);
  // A wing from the shoulder out
  const wing = flat([[0, 0.1], [0.25, 0.09], [0.52, 0.02], [0.63, -0.05], [0.5, -0.11], [0.28, -0.15], [0, -0.13]]);
  const wings = [1, -1].map((side) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(side * 0.05, 0.02, 0.02);
    const m = new THREE.Mesh(wing, brown);
    m.scale.x = side;
    pivot.add(m);
    flying.add(pivot);
    return pivot;
  }) as [THREE.Object3D, THREE.Object3D];
  const fan = new THREE.Mesh(flat([[-0.04, 0], [0.04, 0], [0.1, -0.22], [-0.1, -0.22]]), rufous);
  fan.position.z = -0.17;
  flying.add(fan);
  const mesh = new THREE.Group();
  mesh.add(sitting, flying);
  return { mesh, sitting, flying, wings };
}

/**
 * A tumbleweed: about 280 fine twigs, each two or three bent lengths of a three-sided tube, wound
 * round a ball and packed toward its core; pale straw-grey outside, darker within (vertex colours).
 */
function tumbleweedGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const outer = new THREE.Color(0xc4b494);
  const inner = new THREE.Color(0x6e5e46);
  const c = new THREE.Color();
  const dir = new THREE.Vector3();
  const at = new THREE.Vector3();
  const next = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const ring = (p: THREE.Vector3, r: number): THREE.Vector3[] =>
    [0, 1, 2].map((k) => {
      const a = (k / 3) * Math.PI * 2;
      return p.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
    });
  for (let i = 0; i < 280; i++) {
    // Denser toward the core
    const radial = new THREE.Vector3(between(-1, 1), between(-1, 1), between(-1, 1)).normalize();
    const depth = Math.pow(rand(), 0.7);
    at.copy(radial).multiplyScalar(0.06 + depth * 0.36);
    // Twigs run round the ball, not out of it
    dir.set(between(-1, 1), between(-1, 1), between(-1, 1)).cross(radial).normalize();
    const segments = rand() < 0.5 ? 2 : 3;
    const length = between(0.15, 0.35) / segments;
    const r = between(0.006, 0.01);
    c.copy(inner).lerp(outer, Math.min(1, depth * 1.2) * between(0.75, 1));
    for (let k = 0; k < segments; k++) {
      bend.set(between(-1, 1), between(-1, 1), between(-1, 1)).normalize();
      dir.applyAxisAngle(bend, between(0.2, 0.5)).normalize();
      next.copy(at).addScaledVector(dir, length);
      u.set(0, 1, 0).cross(dir);
      if (u.lengthSq() < 1e-4) u.set(1, 0, 0).cross(dir);
      u.normalize();
      v.crossVectors(dir, u);
      const a = ring(at, r);
      const b = ring(next, r * 0.8);
      for (let s = 0; s < 3; s++) {
        const t = (s + 1) % 3;
        for (const p of [a[s], b[s], a[t], a[t], b[s], b[t]]) {
          pos.push(p.x, p.y, p.z);
          col.push(c.r, c.g, c.b);
        }
      }
      at.copy(next);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
