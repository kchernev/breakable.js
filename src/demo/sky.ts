// The sky: an HDRI for the background and the light, turned so its sun comes from where it's
// wanted, with a directional light (and its shadows) where the sun is.

import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export interface SkyOptions {
  /** The HDRI: a file in public/hdri, or a URL. */
  hdri: string;
  /**
   * Another HDRI to show as the background, turned so its own sun is on the light's azimuth too
   * (default: the lighting's). For a sky that lights well but shows what it shouldn't (hills,
   * buildings), or the other way round.
   */
  backgroundHdri?: string;
  /** Where the sun comes from: radians from +x toward -z (default 1.15). */
  azimuth?: number;
  /**
   * The sun light's height above the horizon (radians; default the HDRI's own sun's, raised to
   * about 14° if it's lower). The sky's glow stays where the HDRI has it.
   */
  elevation?: number;
  /** Background and lighting strength (defaults 0.85, 0.55). */
  background?: number;
  environment?: number;
  /** The sun light's colour and strength (defaults warm white, 3.2). */
  sun?: { color?: THREE.ColorRepresentation; intensity?: number };
  /** Shadows cover this far around the player (m, default 45). */
  shadowRange?: number;
}

export interface Sky {
  sun: THREE.DirectionalLight;
  /** Unit vector toward the sun. */
  sunDirection: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);

export async function sky(scene: THREE.Scene, o: SkyOptions): Promise<Sky> {
  const load = async (name: string) => {
    const t = await new HDRLoader().loadAsync(name.includes('/') ? name : `hdri/${name}`);
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  };
  const [hdr, back] = await Promise.all([load(o.hdri), o.backgroundHdri ? load(o.backgroundHdri) : null]);
  scene.background = back ?? hdr;
  scene.environment = hdr;
  scene.backgroundIntensity = o.background ?? 0.85;
  scene.environmentIntensity = o.environment ?? 0.55;

  // Turn the sky about the vertical so its sun is where it's wanted
  const azimuth = o.azimuth ?? 1.15;
  const lit = aimSky(hdr, azimuth);
  scene.environmentRotation.set(0, lit.turn, 0);
  scene.backgroundRotation.set(0, back ? aimSky(back, azimuth).turn : lit.turn, 0);

  const sunDirection = lit.sun;
  if (o.elevation !== undefined) {
    const e = o.elevation;
    sunDirection.set(Math.cos(azimuth) * Math.cos(e), Math.sin(e), -Math.sin(azimuth) * Math.cos(e));
  } else if (sunDirection.y < 0.25) sunDirection.y = 0.25; // a sun below the horizon (night) still lights from above a little: the moon's way
  sunDirection.normalize();
  const sun = new THREE.DirectionalLight(o.sun?.color ?? 0xfff0dc, o.sun?.intensity ?? 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const r = o.shadowRange ?? 45;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 });
  scene.add(sun, sun.target);
  return { sun, sunDirection };
}

/** Keep the sun's shadow box on the player. */
export function followSun(s: Sky, at: THREE.Vector3): void {
  s.sun.target.position.copy(at);
  s.sun.position.copy(at).addScaledVector(s.sunDirection, 100);
}

/**
 * How far to turn an equirectangular HDR about the vertical (as scene.environmentRotation.y or
 * backgroundRotation.y) to put its brightest texel, its sun, at `azimuth` (radians from +x toward
 * -z), and that sun's direction once turned. Three shows what was at azimuth a at a + turn.
 */
export function aimSky(t: THREE.DataTexture, azimuth: number): { turn: number; sun: THREE.Vector3 } {
  const found = brightest(t);
  const turn = azimuth - Math.atan2(-found.z, found.x);
  return { turn, sun: found.applyAxisAngle(UP, turn) };
}

/** The direction of the brightest texel of an equirectangular HDR (three's mapping). */
function brightest(t: THREE.DataTexture): THREE.Vector3 {
  const { width, height, data } = t.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const read = data instanceof Uint16Array ? (i: number) => THREE.DataUtils.fromHalfFloat(data[i]) : (i: number) => data[i];
  let best = -1;
  let at = 0;
  for (let i = 0; i < width * height; i++) {
    const l = read(4 * i) + read(4 * i + 1) + read(4 * i + 2);
    if (l > best) {
      best = l;
      at = i;
    }
  }
  const u = ((at % width) + 0.5) / width;
  const v = (Math.floor(at / width) + 0.5) / height;
  const phi = (u - 0.5) * 2 * Math.PI;
  // Rows run top down in the file; the sun is above the horizon either way it's read
  const theta = Math.abs((v - 0.5) * Math.PI);
  return new THREE.Vector3(Math.cos(phi) * Math.cos(theta), Math.sin(theta), Math.sin(phi) * Math.cos(theta)).normalize();
}
