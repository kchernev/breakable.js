// What bullets do (Destruction.shoot): how many a piece takes before it gives way, by its material
// and its size; how hard one pushes what's free to move; and what kind of thing a material is, for
// the sound and the look of a strike.

import type { MaterialSounds } from './destruction-audio.ts';
import type { BreakableMaterial } from './materials.ts';

/** The kinds of thing a bullet strikes, each with its own sound (`bullet.<kind>`) and look. */
export type MaterialKind = 'brick' | 'concrete' | 'metal' | 'wood' | 'glass' | 'dirt';

/** A bullet's damage to standing pieces (power 1) and its push on loose ones, at the unit. */
const BRICK = 25;
const SIZE = 0.25;
const MOMENTUM = 0.008;
/** The fastest a bullet sends anything (m/s): a can skitters, it isn't flung. */
const MOST = 6;

/**
 * How many bullets of power 1 a piece takes before it breaks. Glass breaks at the first; anything
 * else as hard to break as its material is (its `impact`, a brick's 25 the unit; metal, which bends
 * rather than cracks, 2.5 times more) and as big as it is (its size, the cube root of its volume,
 * to the power 1.5): a quarter-metre brick 3, a thin board 2, a 2 m concrete block over 40, a steel
 * plate a few hundred.
 */
export function bulletsToBreak(material: BreakableMaterial, size: number): number {
  if (material.shatter) return 1;
  const tough = (material.impact / BRICK) * (material.plastic ? 2.5 : 1);
  return Math.max(1, Math.round(3 * tough * Math.pow(Math.max(size, 0) / SIZE, 1.5)));
}

/**
 * How fast a bullet of `power` sends a loose piece, rubble or a prop of `mass` (density × volume)
 * on its way (m/s): a crate skitters off, a bin rocks and slides a little, a car doesn't notice.
 */
export function bulletPush(mass: number, power = 1): number {
  return Math.min(MOST, (MOMENTUM * power) / Math.max(mass, 1e-6));
}

const KINDS: MaterialKind[] = ['glass', 'metal', 'wood', 'brick', 'concrete', 'dirt'];

/**
 * What kind of thing a material is: what its bullet sound says (`bullet.brick`: terracotta that
 * shatters is still fired clay, not glass); else glass if it shatters, metal if it bends, earth if
 * it's called so (`dirt`, `earth`, `sand`, `soil`...), what its other sounds are named after
 * (`brick.break`, `wood.impact`...), wood if it has a grain or is light (under 1.1), and stone
 * (concrete) if nothing says otherwise.
 */
export function materialKind(name: string, material: BreakableMaterial, sounds?: MaterialSounds): MaterialKind {
  const named = (s: string | undefined) => (s ? KINDS.find((k) => s.startsWith(`${k}.`) || s === `bullet.${k}`) : undefined);
  const own = named(sounds?.bullet);
  if (own) return own;
  if (material.shatter) return 'glass';
  if (material.plastic) return 'metal';
  if (/dirt|earth|soil|sand|mud|gravel|turf|grass/i.test(name)) return 'dirt';
  for (const s of [sounds?.break, sounds?.impact, sounds?.heavyImpact, sounds?.debris]) {
    const kind = named(s);
    if (kind) return kind;
  }
  if (/brick/i.test(name)) return 'brick';
  if (material.grain || material.density < 1.1) return 'wood';
  return 'concrete';
}
