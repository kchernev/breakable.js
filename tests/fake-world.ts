// A stand-in for three-avbd's World with no GPU: bodies keep the poses they're given, joints just
// exist, and readbacks resolve at once. Enough to test the structure logic (bonds, support,
// weighing, collapse) on the CPU.

import type { World } from 'three-avbd';

type V3 = [number, number, number];
type Q = [number, number, number, number];

function rotate(q: Q, v: V3): V3 {
  const [x, y, z, w] = q;
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
}

function multiply(a: Q, b: Q): Q {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}

export class FakeBody {
  readonly index: number;
  readonly shape: 'box' | 'hull';
  /** Full widths (a box's). */
  readonly size: V3;
  /** A hull's shape (vertices about its centre of mass), as World.addHull keeps it. */
  readonly hull: { vertices: Float32Array } | null;
  fixed: boolean;
  alive = true;
  reportContacts = false;
  position: V3;
  rotation: Q;
  velocity: V3;
  angularVelocity: V3 = [0, 0, 0];
  density = 1;
  readonly world: FakeWorld;
  /** Impulses given it (applyImpulse), in order. */
  readonly impulses: V3[] = [];
  constructor(world: FakeWorld, index: number, o: { position?: V3; rotation?: Q; fixed?: boolean; velocity?: V3; size?: V3; group?: number; collidesWith?: number }, hull: { vertices: Float32Array } | null = null) {
    this.world = world;
    this.group = o.group ?? 1;
    this.collidesWith = o.collidesWith ?? 0xffffffff;
    this.index = index;
    this.shape = hull ? 'hull' : 'box';
    this.size = o.size ?? [1, 1, 1];
    this.hull = hull;
    this.fixed = o.fixed ?? false;
    this.position = o.position ?? [0, 0, 0];
    this.rotation = o.rotation ?? [0, 0, 0, 1];
    this.velocity = o.velocity ?? [0, 0, 0];
  }
  setFixed(fixed: boolean): void {
    this.fixed = fixed;
    this.velocity = [0, 0, 0];
  }
  set(s: { position?: V3; rotation?: Q; velocity?: V3; angularVelocity?: V3 }): void {
    if (s.position) this.position = s.position;
    if (s.rotation) this.rotation = s.rotation;
    if (s.velocity) this.velocity = s.velocity;
    if (s.angularVelocity) this.angularVelocity = s.angularVelocity;
  }
  applyImpulse(impulse: V3): void {
    this.impulses.push(impulse);
  }
  group: number;
  collidesWith: number;
  setCollisionGroups(group: number, collidesWith = this.collidesWith): void {
    this.group = group;
    this.collidesWith = collidesWith;
  }
  remove(): void {
    this.alive = false;
    this.world.removed++;
  }
}

export class FakeJoint {
  removed = false;
  readonly a: FakeBody;
  readonly b: FakeBody;
  readonly options: Record<string, unknown>;
  constructor(a: FakeBody, b: FakeBody, options: Record<string, unknown>) {
    this.a = a;
    this.b = b;
    this.options = options;
  }
  remove(): void {
    this.removed = true;
  }
}

export interface FakeContact {
  type: 'begin' | 'end';
  a: FakeBody;
  b: FakeBody;
  point: V3;
  normal: V3;
  impulse: number;
  step: number;
}

export class FakeWorld {
  readonly gravity: V3 = [0, -9.81, 0];
  readonly dt = 1 / 60;
  private readonly contactListeners = new Set<(e: FakeContact) => void>();
  readonly bodyAttribute = null;
  readonly device = undefined;
  /** Every body made, removed ones too. */
  readonly made: FakeBody[] = [];
  readonly joints: FakeJoint[] = [];
  removed = 0;
  addBox(o: { position?: V3; rotation?: Q; fixed?: boolean; velocity?: V3; size?: V3; group?: number; collidesWith?: number }, hull: { vertices: Float32Array } | null = null): FakeBody {
    const b = new FakeBody(this, this.made.length, o, hull);
    this.made.push(b);
    return b;
  }
  addHull(o: { shape: { center: number[]; rotation: number[]; vertices: Float32Array }; position?: V3; rotation?: Q; fixed?: boolean; velocity?: V3; density?: number }): FakeBody {
    // As World.addHull: the points' frame placed as asked, the body at the shape's centre of mass, on its principal axes
    const p = o.position ?? [0, 0, 0];
    const q = o.rotation ?? [0, 0, 0, 1];
    const c = rotate(q, o.shape.center as V3);
    const body = this.addBox({ ...o, position: [p[0] + c[0], p[1] + c[1], p[2] + c[2]], rotation: multiply(q, o.shape.rotation as Q) }, o.shape);
    body.density = o.density ?? 1;
    return body;
  }
  addJoint(a: FakeBody, b: FakeBody, options: Record<string, unknown>): FakeJoint {
    const j = new FakeJoint(a, b, options);
    this.joints.push(j);
    return j;
  }
  onBreak(): () => void {
    return () => {};
  }
  onContact(listener: (e: FakeContact) => void): () => void {
    this.contactListeners.add(listener);
    return () => this.contactListeners.delete(listener);
  }
  /** As a readback bringing a contact event. */
  contact(e: Partial<FakeContact> & { a: FakeBody; b: FakeBody }): void {
    const full: FakeContact = { type: 'begin', point: [0, 0, 0], normal: [0, 1, 0], impulse: 1, step: 0, ...e };
    for (const l of this.contactListeners) l(full);
  }
  read(): Promise<void> {
    return Promise.resolve();
  }
  /** As World.bodies: those still in the world. */
  get bodies(): FakeBody[] {
    return this.made.filter((b) => b.alive);
  }
}

/** The fake as the World type Destruction takes. */
export const asWorld = (w: FakeWorld): World => w as unknown as World;
