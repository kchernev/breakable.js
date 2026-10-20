// A world: everything the demo needs to put one place on screen and let it be blown apart. The
// demo (main.ts) does the rest the same for every world: the renderer and its post-processing,
// physics, the player, the weapons, particles, sound.
//
// A world lives in src/demo/worlds/<id>/: meta.ts (its card in the picker) and index.ts (its
// definition, the default export), found by registry.ts. Its own assets go in public/packs/<id>/
// (textures, sounds, models), made by scripts/assets with PACK=<id>.

import type * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import type { BreakableMaterial, Destruction, DestructionOptions, Ground, ImpactEvent, MaterialSounds, PropModel, SoundEngine, SoundOptions, V3, Voice } from '../../lib/index.ts';
import type { DustPalette, Effects, SmokeOptions } from '../effects.ts';
import type { Burst, BulletHit } from '../gun.ts';
import type { Sky, SkyOptions } from '../sky.ts';
import type { HazeOptions, WeatherOptions } from '../weather.ts';

/** The world's card in the picker. */
export interface WorldMeta {
  id: string;
  title: string;
  /** A line about it. */
  blurb: string;
  /** Its place in the list (lowest first). */
  order: number;
}

/** What a world can reach while it runs. */
export interface WorldRuntime {
  scene: THREE.Scene;
  camera: THREE.Camera;
  destruction: Destruction;
  sound: SoundEngine;
  /** The ambience loops (WorldAudio.ambience) by sound name, once the sounds have loaded (empty before onStart). */
  ambience: Map<string, Voice>;
  effects: Effects;
  /** Seconds since it started. */
  time: number;
}

export interface WorldLook {
  /** Fog: colour, and where it starts and is complete (m). */
  fog?: { color: THREE.ColorRepresentation; near: number; far: number };
  /** Tone mapping exposure (default 1.1). */
  exposure?: number;
  /** Bloom: strength, radius, threshold (defaults 0.35, 0.4, 0.92). Night worlds want more. */
  bloom?: { strength?: number; radius?: number; threshold?: number };
  /** Sky-and-ground fill light (default a pale blue sky, a brown ground, 0.35). */
  hemisphere?: { sky: THREE.ColorRepresentation; ground: THREE.ColorRepresentation; intensity: number };
  /**
   * A directional light without shadows on the shaded side: what the sunlit street, walls and sky
   * bounce back into the shade. From `azimuth` and `elevation` (radians, as the sky's; default
   * opposite the sun, as high), in `color` (default the sun's). Default: none.
   */
  fill?: { intensity: number; color?: THREE.ColorRepresentation; azimuth?: number; elevation?: number };
  /** Ambient occlusion radius (m, default 0.6). */
  ao?: number;
  /**
   * Screen-space reflections on glossy surfaces (wet streets, polished stone, glass, metal): how
   * strongly surfaces reflect by their roughness (those under ~0.1 fully, over ~0.4 not at all), up
   * to how far along the reflected ray (m, default 100: from the street, a tall sign's reflection
   * lies far along it). Costs a pass; for worlds that need it. `thickness`: how thick (m) what's
   * seen in the depth buffer is taken to be (default 0.15); `quality`: steps per pixel of the ray on
   * screen (0–1, default 1); `resolution`: of the pass, as a share of the screen's (default 0.5).
   */
  reflections?: { strength?: number; distance?: number; thickness?: number; quality?: number; resolution?: number };
  /** Colour grading after bloom: saturation (1: as is), contrast (1), a tint multiplied in, and a vignette (0–1). */
  grade?: { saturation?: number; contrast?: number; tint?: THREE.ColorRepresentation; vignette?: number };
  /** Rain or motes in the air around the player (see src/demo/weather.ts). */
  weather?: WeatherOptions;
  /**
   * The explosion's cloud: its colour (default the dust palette's), and its density, how long it
   * hangs and its size as times the default's (1), e.g. `{ color: 0xe8e4dc, life: 0.6 }`.
   */
  smoke?: SmokeOptions;
  /**
   * What all dust is made of: the colours each puff's is mixed from (default warm tans and greys),
   * and how far a material's own dust colour (WorldDefinition.dust) is blended over them, 0–1
   * (default 0.45), e.g. `{ colors: [0x9a9c9c, 0x84888a], blend: 0.8 }` for steel.
   */
  dustPalette?: DustPalette;
  /** Heat haze: the air shimmering over the ground in the distance (see src/demo/weather.ts). */
  haze?: HazeOptions;
}

export interface WorldAudio {
  /**
   * Sound packs to load besides the base pack ('sounds/', always first): base URLs, like
   * 'packs/<id>/sounds/'. A later pack's sound replaces an earlier one's of the same name.
   */
  packs?: string[];
  /** How sounds are played here (name → settings over the pack's). */
  settings?: Record<string, Partial<SoundOptions>>;
  /**
   * Loops from the start. `high`: how much louder (or quieter) it gets when the player is up high.
   * Once loaded, each is the demo's `audio.ambience.get(sound)` (a Voice: setVolume(1) is its level here).
   */
  ambience?: Array<{ sound: string; volume?: number; high?: number }>;
  /** Which sounds each material makes (see the library's packMaterials). */
  materials: Record<string, MaterialSounds>;
  /** Footsteps on hard ground and on rubble, and landing (default the base pack's). */
  footsteps?: {
    hard?: string;
    rubble?: string;
    land?: string;
    /**
     * The step sound for a foot coming down at `at` (the feet: x, y, z) on `material` (the piece
     * stood on; null: the ground or the scenery), `rubble` if that piece is rubble. Nothing, or a
     * sound that isn't loaded: `hard` or `rubble` as usual.
     */
    surface?: (at: V3, material: string | null, rubble: boolean) => string | undefined;
  };
}

export interface WorldStart {
  /** Where the player's feet are, and what they look at. */
  feet: V3;
  look: V3;
}

export interface WorldDefinition extends WorldMeta {
  sky: SkyOptions;
  look?: WorldLook;
  /** The breakable materials (names used by build(), audio.materials, dust and chips). */
  materials(): Record<string, BreakableMaterial>;
  /** The height pieces stand on (Destruction's `ground`; default 0; null: none, use static pieces). */
  ground?: number | null;
  /**
   * What doesn't break: the ground and the far scenery, drawn, and in the world where things land on
   * it. Its fixed bodies are solid to the player too (walls to walk into, tops to stand on).
   * Lights: add every light the world will ever use here or in build(), switched off (intensity 0)
   * until wanted. A light added or removed later, or a shadow switched on or off, recompiles every
   * lit material (a frame of over half a second in Brick Street); its intensity, colour and place
   * change freely.
   */
  scenery(scene: THREE.Scene, world: World, sky: Sky): void | Promise<void>;
  /** The ground's height at (x, z): where the player walks and rockets go off (structures aside). */
  groundAt(x: number, z: number): number;
  /** Where the player may walk (default anywhere): a step off it stops at the edge. Flying goes anywhere. */
  walkable?(x: number, z: number): boolean;
  /**
   * Where the ground is water: bullets go into it (nothing seen or heard), and a blast within a
   * metre over it (groundAt there: the water's surface) leaves no scorch. Default: where walkable
   * says no and groundAt is under -0.5 m.
   */
  water?(x: number, z: number): boolean;
  /**
   * What the side of a pit through a breakable ground is where a bullet strikes it at `at` (the
   * scenery's face under the ground's top, at the edge of its area): a material, null for the
   * scenery's own stone (a building's footing, a beam, drawn as concrete), nothing for the
   * ground's layer at that height (the default: a square's edge drawn as its setts over earth).
   */
  pitSide?(at: V3, ground: Ground): string | null | undefined;
  /** The camera's far plane (m, default 600): how far off anything is drawn. */
  far?: number;
  /**
   * The Destruction's options (src/lib/destruction.ts): shatterSpeed, heavy, maxLoose and so on.
   * Default: the library's, with maxLoose 3000 and capacity 600k. The demo sets world, scene,
   * materials and ground.
   */
  destruction?: Partial<Omit<DestructionOptions, 'world' | 'scene' | 'materials' | 'ground'>>;
  /** Prop packs to load (base URLs, like 'models/' or 'packs/<id>/models/'); their models are merged by name. */
  props?: string[];
  /** Build the breakable world (the demo reinforces it after) and say where the player starts. */
  build(d: Destruction, models: Record<string, PropModel>): WorldStart | Promise<WorldStart>;
  audio: WorldAudio;
  /** Colours of the dust a material makes (taken over look.dustPalette as far as its blend says), and of its chips. */
  dust: Record<string, number>;
  chips: Record<string, number>;
  /**
   * How much dust a material raises, times the default (1): from its broken bits and over a section
   * of it coming down. A steel frame raises grit (0.15), not a masonry cloud.
   */
  dustAmount?: Record<string, number>;
  /** A rocket's blast radius here (m, default 2.3). */
  blastRadius?: number;
  /**
   * Once, when it's built and its sounds have loaded (rt.ambience is filled, loops can be played):
   * subscribe to events, start sounds. update() runs from the first frame, before it too.
   */
  onStart?(rt: WorldRuntime): void;
  /** Reactions: to blasts, to loose pieces striking things, and each frame. */
  onBlast?(at: V3, radius: number, rt: WorldRuntime): void;
  onImpact?(e: ImpactEvent, rt: WorldRuntime): void;
  /**
   * The gun: each bullet that strikes something (a piece, the scenery or the ground; not the sky or
   * the water), after the strike's chips, mark and sound: a car's alarm, a sign's sparks, a bell's
   * ring. Up to 14 a second while the trigger is held: keep it light.
   */
  onShot?(hit: BulletHit, rt: WorldRuntime): void;
  /**
   * Once a burst of the gun ends (the trigger let go, the gun put away): the rounds fired, where
   * most of them struck (the middle of their strikes; null: none struck anything), and how long it
   * lasted (s). For the noise of it: a hush, birds taking off, a siren.
   */
  onBurst?(burst: Burst, rt: WorldRuntime): void;
  update?(dt: number, rt: WorldRuntime): void;
}
