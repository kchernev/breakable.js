// Cars in a world (the library's Vehicle makes them come apart), and what goes on around one that
// isn't the library's. Shot, knocked or landing hard, its alarm goes off. A door, the hood or the
// trunk lid sprung swings open with a clunk; a tyre shot bursts with a bang and a hiss, and the car
// sinks onto its rim. A round into its tank holes it: a dark stream runs down under it and a pool
// spreads. A few more holes, or a blast reaching it, and the fuel catches: flames from under it,
// black smoke, the fire's roar, the alarm dying; some seconds later the tank goes up, a blast of
// the world's own that throws the car and tears it open (and sets off the next one, leaking near
// it), and what's left burns out black. Landing hard, its glass bursts.

import type * as THREE from 'three/webgpu';
import { addVehicle, type Destruction, distance, type ImpactEvent, type LandedEvent, type Piece, type Q, type V3, type Vehicle, type VehicleModel, vehicleOf, type Voice } from '../lib/index.ts';
import { Fires, type Leak, type LeakOptions, Leaks } from './fire.ts';
import type { WorldRuntime } from './worlds/types.ts';

/** Alarms going at once, at most (a new one cuts the oldest short); seconds one stays quiet once stopped. */
const ALARMS = 2;
const REARM = 45;
/** A holed tank's leak: a narrow stream, a pool up to 1.4 m spreading over 9 s, running a minute. */
const LEAK: LeakOptions = { strip: 0.08, most: 1.4, spread: 9, life: 60 };
/** Holes in its tank before a round's spark catches the fuel. */
const CATCH = 3;
/** A blast within this many of its radii of a leaking car (or its tank) sets it alight. */
const IGNITE = 2.5;
/** Seconds it burns before the tank goes up (at random between); a blast at the tank, faster. */
const BURN: [number, number] = [7, 12];
const FUSE: [number, number] = [1.2, 2.5];
/** The tank's blast (m), and how long what's left burns after (s). */
const GO_UP = 3.2;
const AFTER = 30;
/**
 * The flame's size (a tank's is 1: 4 m tall) in a burning car, and once it has gone up; its foot
 * at the car's waist over the tank (from under it, the car hid it: it burns up through the cabin).
 */
const FLAME = 0.6;
const WRECK = 0.42;
const WAIST = 0.75;
const SOOT = 0x1c1a18;
/** A car landing this hard (m/s) bursts a pane or two; harder, all of them. */
const BURST = 5;
const SHATTER = 9;

interface Car {
  vehicle: Vehicle;
  alarm: Voice | null;
  alarmUntil: number;
  quiet: number;
  leak: Leak | null;
  leakVoice: Voice | null;
  fire: { flame: number; voices: Array<Voice | null>; upAt: number; puffAt: number; until: number } | null;
}

export class Cars {
  readonly list: Vehicle[] = [];
  private readonly cars = new Map<Vehicle, Car>();
  private readonly fires: Fires;
  private readonly leaks: Leaks;
  private rt: WorldRuntime | null = null;
  private time = 0;

  /** Made with the scenery, so the flames' and the leaks' materials are ready before the first. */
  constructor(scene: THREE.Scene) {
    this.fires = new Fires(scene);
    this.leaks = new Leaks(scene, [], 6, 8);
  }

  /** A car parked at `position`, turned `rotation`, in `tint` (its paint, where it has one). */
  place(d: Destruction, model: VehicleModel, position: V3, rotation: Q, tint?: THREE.ColorRepresentation): Vehicle {
    const vehicle = addVehicle(
      d,
      model,
      { position, rotation, tint },
      {
        latch: (_v, part, at) => this.rt?.sound.play(part === 'hood' || part === 'trunk' ? 'car.lid' : 'car.door', { at }),
        tyre: (v, _wheel, at) => {
          this.rt?.sound.play('tyre.burst', { at });
          this.rt?.effects.puff(at, { color: 0xd8d4cc, size: 0.9, life: 1.2, opacity: 0.35, rise: 0.2 });
          this.alarm(v, at, 0.15);
        },
        tank: (v, at, holes) => this.holed(v, at, holes),
      },
    );
    this.list.push(vehicle);
    this.cars.set(vehicle, { vehicle, alarm: null, alarmUntil: 0, quiet: 0, leak: null, leakVoice: null, fire: null });
    return vehicle;
  }

  /** Once the sounds are in: landing hard sets its alarm off and bursts its glass. */
  start(rt: WorldRuntime): void {
    this.rt = rt;
    rt.destruction.on('landed', (e) => this.landed(e, rt));
  }

  /** A round struck something: one of the cars, its alarm (and what the car itself does with it). */
  shot(hit: { piece: Piece | null; at: V3; direction: V3 }): void {
    const v = vehicleOf(hit.piece);
    if (!v) return;
    v.shot(hit);
    this.alarm(v, hit.at, 0.2);
  }

  /** A blast: the cars it reaches are torn open; one leaking near it, or with its tank in it, catches. */
  blast(at: V3, radius: number, rt: WorldRuntime): void {
    for (const v of this.list) {
      const r = distance(v.center, at);
      if (r > radius * 4) continue;
      v.blast(at, radius);
      if (r < 15 && Math.random() < 0.6) this.alarm(v, v.center, 0.5 + Math.random() * 1.2);
      // Its tank in the blast: alight half the time, else holed; one leaking near it catches
      const car = this.cars.get(v)!;
      const tank = distance(v.toWorld(v.model.fuel), at);
      if (car.fire || v.burnt) continue;
      if (tank < radius * 1.1) {
        if (Math.random() < 0.5) this.ignite(v, FUSE, rt);
        else this.holed(v, v.toWorld(v.model.fuel), 1);
      } else if (car.leak && tank < radius * IGNITE) this.ignite(v, BURN, rt);
    }
  }

  /** Something heavy coming down on a parked car sets its alarm off. */
  impact(e: ImpactEvent): void {
    const v = vehicleOf(e.other);
    if (v && e.speed > 3 && e.piece.mass > 0.3) this.alarm(v, e.at, 0.2);
  }

  update(rt: WorldRuntime): void {
    this.time = rt.time;
    let newest: V3 | null = null;
    for (const car of this.cars.values()) {
      const v = car.vehicle;
      if (car.alarm && rt.time > car.alarmUntil) this.stopAlarm(car);
      // The leak follows the car as it moves
      if (car.leak) {
        const tank = v.toWorld(v.model.fuel);
        this.leaks.move(car.leak, [tank[0], tank[1] + 0.05, tank[2]], this.outward(v), rt.floor(tank), rt.time);
      }
      const fire = car.fire;
      if (!fire) continue;
      // Flames up through it over its tank (as it lies now), black smoke off them
      const fuel = v.model.fuel;
      const at = v.toWorld([fuel[0], WAIST, fuel[2]]);
      this.fires.move(fire.flame, at, v.burnt ? WRECK : FLAME);
      newest = at;
      if (rt.time > fire.puffAt) {
        fire.puffAt = rt.time + 0.35 + Math.random() * 0.3;
        rt.effects.puff([at[0] + (Math.random() - 0.5), at[1] + 1.5, at[2] + (Math.random() - 0.5)], { color: SOOT, rise: 2.2, size: v.burnt ? 3 : 4, life: 7, opacity: 0.8, velocity: [0.3, 1.2, 0] });
      }
      if (fire.upAt > 0 && rt.time > fire.upAt) this.goUp(car, rt);
      if (rt.time > fire.until) this.putOut(car);
    }
    this.fires.update(rt.time, newest);
    this.leaks.update(rt.time);
  }

  /** Its alarm, going off at `at` after `delay` for a while (not one just stopped, nor a burnt one's). */
  private alarm(v: Vehicle, at: V3, delay: number): void {
    const car = this.cars.get(v);
    const rt = this.rt;
    if (!car || !rt || car.alarm || rt.time < car.quiet || v.burnt || car.fire) return;
    const going = [...this.cars.values()].filter((c) => c.alarm);
    if (going.length >= ALARMS) this.stopAlarm(going[0]);
    car.alarm = rt.sound.play('alarm.car', { at, delay });
    car.alarmUntil = rt.time + delay + 14 + Math.random() * 12;
  }

  private stopAlarm(car: Car): void {
    car.alarm?.stop(0.3);
    car.alarm = null;
    car.quiet = this.time + REARM;
  }

  /** Its tank holed: the first hole starts it leaking; enough of them, and a round's spark catches the fuel. */
  private holed(v: Vehicle, at: V3, holes: number): void {
    const car = this.cars.get(v)!;
    const rt = this.rt;
    if (!rt || car.fire || v.burnt) return;
    if (!car.leak) {
      const tank = v.toWorld(v.model.fuel);
      car.leak = this.leaks.start(v, [tank[0], tank[1] + 0.05, tank[2]], this.outward(v), rt.floor(tank), LEAK, rt.time);
      car.leakVoice = rt.sound.play('fuel.leak', { at: tank, fadeIn: 0.5, volume: 0.7 });
    }
    if (holes >= CATCH) this.ignite(v, BURN, rt);
    else rt.effects.sparks(at, [0, -1, 0], 0.15, 0xffb060);
  }

  /** The fuel catches with a whoomph: flames, the roar, its alarm gone; the tank goes up `fuse` seconds on. */
  private ignite(v: Vehicle, fuse: [number, number], rt: WorldRuntime): void {
    const car = this.cars.get(v)!;
    if (car.fire || v.burnt) return;
    const tank = v.toWorld(v.model.fuel);
    rt.sound.play('fuel.ignite', { at: tank });
    const voices = [rt.sound.play('fire.loop', { at: tank, fadeIn: 0.6 })];
    if (car.alarm) this.stopAlarm(car);
    car.fire = { flame: this.fires.start(tank, FLAME), voices, upAt: rt.time + fuse[0] + Math.random() * (fuse[1] - fuse[0]), puffAt: rt.time, until: Infinity };
  }

  /** The tank goes up: a blast under the car (throwing it), it's burnt black, and burns on a while. */
  private goUp(car: Car, rt: WorldRuntime): void {
    const v = car.vehicle;
    const fire = car.fire!;
    fire.upAt = -1;
    fire.until = rt.time + AFTER;
    if (car.leak) this.leaks.end(car.leak, rt.time);
    car.leak = null;
    car.leakVoice?.stop(0.5);
    car.leakVoice = null;
    const tank = v.toWorld(v.model.fuel);
    v.burn();
    // Under it: it jumps and comes down burning, its doors and lids blown off (not thrown down the street)
    rt.blast([tank[0], tank[1] + 0.1, tank[2]], GO_UP, { speed: 6, spin: 5 });
  }

  /** Burnt out: the flames die, the roar with them. */
  private putOut(car: Car): void {
    const fire = car.fire!;
    this.fires.stop(fire.flame);
    for (const voice of fire.voices) voice?.stop(3);
    car.fire = null;
  }

  /** A car come down hard: its alarm; its glass bursts (a pane or two, or all of it). */
  private landed(e: LandedEvent, rt: WorldRuntime): void {
    const hit = new Set(e.pieces.map((p) => vehicleOf(p)).filter((v): v is Vehicle => !!v));
    for (const v of hit) {
      if (e.speed > 3) this.alarm(v, e.at, 0.3);
      if (e.speed < BURST) continue;
      const panes = [...v.panes.values()].filter((p) => p.state !== 'gone');
      const burst = e.speed > SHATTER ? panes : panes.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
      for (const p of burst) rt.destruction.explode({ at: p.pose.position, radius: 0.3, speed: 1.5, spin: 4, loose: true });
    }
  }

  /** The way out from the car's tank (its back, as it lies now). */
  private outward(v: Vehicle): V3 {
    const f = v.frame();
    const [x, y, z, w] = f.rotation;
    // Its +z (the back, in glTF's frame: the car faces -z), level
    const back: V3 = [2 * (x * z + w * y), 0, 1 - 2 * (x * x + y * y)];
    const l = Math.hypot(back[0], back[2]) || 1;
    return [back[0] / l, 0, back[2] / l];
  }
}
