// The weapons in hand: the rocket launcher and the machine gun. One is held at a time; taking up
// the other lowers the one in hand out of view and brings the other up (about 0.3 s), and the
// trigger and the scripted bursts go to the one held. Each goes on with what it has under way
// while it's down (rockets in flight). The HUD (index.html's #weapon) shows them, and which is in
// hand. Neither runs dry: the launcher reloads itself after each rocket, the gun never needs to.

import type * as THREE from 'three/webgpu';
import type { MaterialKind } from '../lib/index.ts';
import type { BulletHit, Gun } from './gun.ts';
import type { WorldDefinition, WorldRuntime } from './worlds/types.ts';

export type WeaponName = 'launcher' | 'gun';

/** A weapon as the demo holds it (Launcher, Gun). */
export interface Weapon {
  readonly name: WeaponName;
  /** The view model (a child of the camera). */
  readonly view: THREE.Object3D;
  /** How far it's lowered out of view: 0 in hand, 1 out of view (Weapons sets it while switching). */
  lowered: number;
  /** It fires while the trigger is held (the gun): held through a switch, it fires once it's up. */
  readonly automatic?: boolean;
  /** The trigger pressed (true) or let go. */
  trigger(down: boolean): void;
  /** Fire `n` shots (rounds, rockets) at its own pace, as if the trigger were held for them (scripted checks). */
  burst(n: number): void;
  /** A foot came down (or the player landed) at `speed` m/s: the view model dips. */
  footfall(speed: number): void;
  update(dt: number, moving: number): void;
}

/** What the HUD calls each weapon. */
const LABELS: Record<WeaponName, string> = { launcher: 'Launcher', gun: 'Machine gun' };
/** Seconds to lower the one in hand out of view; as long again to bring the next up. */
const SWITCH = 0.15;
/** How far the wheel turns to switch (pixels: a notch is 100 or so), and the pause (ms) that ends a turn of it. */
const NOTCH = 50;
const WHEEL_PAUSE = 150;

export class Weapons {
  readonly list: readonly Weapon[];
  /** The weapon in hand (while switching, the one going down, then the one coming up). */
  current: Weapon;
  /** The one to take up (null: none, it's in hand). */
  private next: Weapon | null = null;
  /** The one held before (Q goes back to it). */
  private last: Weapon;
  /** The trigger is down (passed on to an automatic weapon once it's up). */
  private held = false;
  /** The wheel turned so far in this turn of it, when last, and whether it has switched in it. */
  private wheel = 0;
  private wheelAt = -Infinity;
  private wheeled = false;
  private shown = '';

  constructor(list: Weapon[]) {
    this.list = list;
    this.current = this.last = list[0];
    for (const w of list) w.lowered = w === this.current ? 0 : 1;
  }

  /** A weapon by name. */
  get(name: WeaponName): Weapon | undefined {
    return this.list.find((w) => w.name === name);
  }

  /** Switching from one to the other. */
  get switching(): boolean {
    return this.next !== null;
  }

  /** Take up a weapon (by name, or its place in the list): the one in hand goes down, then it comes up. */
  select(which: WeaponName | number): void {
    const w = typeof which === 'number' ? this.list[which] : this.get(which);
    if (!w || w === (this.next ?? this.current)) return;
    if (!this.next) this.last = this.current;
    // Put away: its trigger let go, what's left of a scripted burst not fired
    this.current.trigger(false);
    this.current.burst(0);
    this.next = w;
  }

  /** The next weapon in the list, or the one before (the mouse wheel). */
  cycle(step: number): void {
    if (this.next || !step) return;
    const n = this.list.length;
    this.select((this.list.indexOf(this.current) + Math.sign(step) + n) % n);
  }

  /**
   * The mouse wheel turned `delta` (pixels, as WheelEvent.deltaY) at `time` (ms): once a turn of it,
   * to the next weapon or the one before. A turn is a notch, or a touchpad's swipe and its glide
   * (many small steps): it ends with a pause.
   */
  scroll(delta: number, time: number): void {
    if (time - this.wheelAt > WHEEL_PAUSE) {
      this.wheel = 0;
      this.wheeled = false;
    }
    this.wheelAt = time;
    if (this.wheeled) return;
    this.wheel += delta;
    if (Math.abs(this.wheel) < NOTCH) return;
    this.wheeled = true;
    this.cycle(this.wheel);
  }

  /** Back to the weapon held before (Q). */
  swap(): void {
    this.select(this.last.name);
  }

  trigger(down: boolean): void {
    this.held = down;
    if (!this.next || !down) this.current.trigger(down);
  }

  /** Fire `n` shots of the weapon in hand (or of the one coming up). */
  burst(n: number): void {
    (this.next ?? this.current).burst(n);
  }

  footfall(speed: number): void {
    for (const w of this.list) w.footfall(speed);
  }

  update(dt: number, moving: number): void {
    const next = this.next;
    if (next) {
      // Down with the one in hand, then up with the next
      if (this.current !== next) {
        this.current.lowered = Math.min(1, this.current.lowered + dt / SWITCH);
        if (this.current.lowered === 1) this.current = next;
      } else {
        next.lowered = Math.max(0, next.lowered - dt / SWITCH);
        if (next.lowered === 0) {
          this.next = null;
          // A trigger held through the switch: the gun fires as it comes up (the launcher waits for a click)
          if (this.held && next.automatic) next.trigger(true);
        }
      }
    }
    for (const w of this.list) w.update(dt, moving);
  }

  /** Show the weapons on the HUD: which is in hand (or coming up), written only when it changes. */
  show(el: HTMLElement): void {
    const held = this.next ?? this.current;
    const parts = this.list.map((w, i) => `<span class="slot${w === held ? ' on' : ''}"><kbd>${i + 1}</kbd>${LABELS[w.name]}</span>`);
    const html = parts.join('');
    if (html === this.shown) return;
    this.shown = html;
    el.innerHTML = html;
  }
}

/**
 * What the ground is where a bullet strikes it (not a piece: the world's own ground), by the step
 * sound the world gives it there: earth where it's dirt, sand, gravel or grass underfoot, else
 * stone (asphalt, cobbles, a wet quay).
 */
export function groundKind(def: Pick<WorldDefinition, 'audio'>): (x: number, y: number, z: number) => MaterialKind {
  const steps = def.audio.footsteps;
  return (x, y, z) => (/dirt|sand|gravel|grass|soil|mud|earth/.test(steps?.surface?.([x, y, z], null, false) ?? steps?.hard ?? '') ? 'dirt' : 'concrete');
}

/**
 * The world hears the gun: each bullet that strikes something, after `strike` (its look and
 * sound), goes to the world's onShot; each burst, as it ends (after what the gun already does
 * then: its echo), to its onBurst.
 */
export function gunHooks(gun: Gun, def: Pick<WorldDefinition, 'onRound' | 'onShot' | 'onBurst'>, rt: WorldRuntime, strike: (hit: BulletHit) => void): void {
  gun.onRound = (r) => def.onRound?.(r, rt);
  gun.onHit = (h) => {
    strike(h);
    def.onShot?.(h, rt);
  };
  const ended = gun.onBurstEnd;
  gun.onBurstEnd = (b) => {
    ended(b);
    def.onBurst?.(b, rt);
  };
}

/**
 * Where the world's ground is water (bullets go into it, blasts leave no scorch on it): where the
 * world says, else where the player may not walk and the ground lies low (Harbor Yard's harbour;
 * not Market Town's lanes by its scenery houses, kept clear of the player). Undefined: nowhere.
 */
export function waterOf(def: Pick<WorldDefinition, 'water' | 'walkable' | 'groundAt'>): ((x: number, z: number) => boolean) | undefined {
  if (def.water) return def.water.bind(def);
  const walkable = def.walkable?.bind(def);
  return walkable && ((x, z) => !walkable(x, z) && def.groundAt(x, z) < -0.5);
}
