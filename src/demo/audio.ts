// The demo's sound, the same in every world: the base pack and the world's own packs on one
// SoundEngine, the world's materials mapped to sounds, its ambience (louder or quieter up high),
// the launcher, the rockets in flight, the machine gun and where its bullets strike, footsteps (by
// what's underfoot, if the world says).

import type * as THREE from 'three/webgpu';
import { type Destruction, DestructionSounds, loadSoundPack, SoundEngine, type SoundOptions, type V3, type Voice } from '../lib/index.ts';
import type { BulletHit, Gun } from './gun.ts';
import type { Launcher } from './launcher.ts';
import type { Player } from './player.ts';
import type { WorldDefinition } from './worlds/types.ts';

const VOLUME = 0.85;
/** The gun's report, as a share of its pack level (at it, a burst at a wall was louder than a blast 20 m off). */
const SHOT = 0.5;
/**
 * How the gun's sounds play here, under the world's own settings (the pack's index has the rest):
 * its report masks less of the world around it (it always has a voice: sounds in the head have
 * voices kept for them); the echo after a burst goes through the world's reverb. Where its bullets
 * strike is in the world, with the rubble and the debris for voices: what the player shoots at is
 * what they listen for, so a strike outweighs them (under sustained fire, without it, a quarter of
 * the strikes in a busy street went unheard).
 */
const WEAPONS: Record<string, Partial<SoundOptions>> = {
  'gun.shot': { priority: 0.6 },
  'gun.tail': { reverb: 0.45 },
  ...Object.fromEntries(['brick', 'concrete', 'metal', 'wood', 'glass', 'dirt'].map((kind) => [`bullet.${kind}`, { priority: 2 }])),
};

export class DemoAudio {
  readonly engine = new SoundEngine({ volume: VOLUME });
  readonly sounds: DestructionSounds;
  readonly ready: Promise<void>;
  /**
   * The world's ambience loops (WorldAudio.ambience) by sound name, once loaded: the world can
   * turn one down (`setVolume(0.2, 1)`: a fifth of its level here) and back up. The height shift is
   * applied apart (setMix), so it doesn't undo the world's fades.
   */
  readonly ambience = new Map<string, Voice>();
  private readonly rockets = new Map<THREE.Object3D, Voice | null>();
  /** Each loop's level as listed, how it shifts up high, and the shift last applied. */
  private readonly loops: Array<{ voice: Voice; volume: number; high: number; mix: number }> = [];
  private readonly camera: THREE.Camera;
  private muted = false;

  constructor(world: WorldDefinition, destruction: Destruction, camera: THREE.Camera, launcher: Launcher, player: Player, gun?: Gun) {
    const e = this.engine;
    const a = world.audio;
    this.camera = camera;
    e.listen(camera);
    this.sounds = new DestructionSounds(e, destruction, { materials: a.materials });
    const settings: Record<string, Partial<SoundOptions>> = { ...WEAPONS };
    for (const [name, s] of Object.entries(a.settings ?? {})) settings[name] = { ...settings[name], ...s };
    this.ready = (async () => {
      // The base pack, then the world's: a later pack's sound replaces an earlier one's
      for (const base of ['sounds/', ...(a.packs ?? [])]) await loadSoundPack(e, { base, settings });
      // Loops wait for the first click to be heard
      for (const amb of a.ambience ?? []) {
        const voice = e.play(amb.sound);
        if (!voice) continue;
        const loop = { voice, volume: amb.volume ?? 1, high: amb.high ?? 1, mix: amb.volume ?? 1 };
        voice.setMix(loop.mix, 0);
        this.loops.push(loop);
        if (!this.ambience.has(amb.sound)) this.ambience.set(amb.sound, voice);
      }
    })();
    launcher.onLaunch = (rocket, fired) => {
      if (fired) {
        e.play('launcher.fire');
        e.play('launcher.reload', { delay: 0.2, volume: 0.8 });
      }
      this.rockets.set(rocket, e.play('rocket.loop', { follow: rocket }));
    };
    if (gun) {
      // Each shot a take of its own at once, in the player's head, under its pack level: a burst
      // goes on, and mustn't drown the world (or be louder than a blast down the street); the echo
      // when a burst ends, longer bursts louder; casings tinkling at the feet now and then
      gun.onShot = () => e.play('gun.shot', { volume: SHOT });
      gun.onBurstEnd = (b) => e.play('gun.tail', { volume: Math.min(1, 0.4 + b.rounds / 20) });
      gun.onCasing = (at, delay) => e.play('casing.drop', { at, delay });
    }
    const steps = { hard: 'steps.asphalt', rubble: 'steps.rubble', land: 'player.land', ...a.footsteps };
    player.onStep = (on, speed) => {
      let sound = on === 'rubble' ? steps.rubble : steps.hard;
      if (steps.surface) {
        // What the foot is on, found as the player finds it: the first piece down from a metre up,
        // if its top is at the feet (a floor, a boardwalk, rubble, a car); otherwise the ground or
        // the scenery. The rubble flag comes from the same piece
        const p = player.position;
        const hit = destruction.raycast([p.x, p.y + 1, p.z], [0, -1, 0], 3);
        const piece = hit && hit.point[1] > p.y - 0.05 ? hit.piece : null;
        const rubble = piece?.state === 'rubble';
        const wanted = steps.surface([p.x, p.y, p.z], piece?.materialName ?? null, rubble);
        sound = wanted && e.has(wanted) ? wanted : rubble ? steps.rubble : steps.hard;
      }
      e.play(sound, { volume: Math.min(1.2, 0.6 + speed * 0.08) });
    };
    player.onLand = (speed) => e.play(steps.land, { volume: Math.min(1, speed / 9) });
  }

  /** A blast went off (and the rocket that made it, if it was one). */
  blast(at: V3, radius: number, rocket?: THREE.Object3D): void {
    if (rocket) {
      this.rockets.get(rocket)?.stop(0.05);
      this.rockets.delete(rocket);
    }
    this.sounds.blast(at, radius);
  }

  /** A bullet struck something: its sound, and now and then a ricochet (more often glancing). */
  bullet(hit: BulletHit): void {
    const [d, n] = [hit.direction, hit.normal];
    this.sounds.bullet(hit.at, hit.material, hit.kind, 1 - Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]));
  }

  get mute(): boolean {
    return this.muted;
  }

  set mute(on: boolean) {
    this.muted = on;
    this.engine.master.gain.setTargetAtTime(on ? 0 : VOLUME, this.engine.context.currentTime, 0.05);
  }

  update(dt: number): void {
    // Up high, the ambience shifts (more wind, less street): only as the height changes
    const up = Math.min(1, Math.max(0, (this.camera.position.y - 3) / 40));
    for (const a of this.loops) {
      const mix = a.volume * (1 + (a.high - 1) * up);
      if (Math.abs(mix - a.mix) <= a.mix * 0.01) continue;
      a.mix = mix;
      a.voice.setMix(mix, 0.5);
    }
    this.sounds.update();
    this.engine.update(dt);
  }
}
