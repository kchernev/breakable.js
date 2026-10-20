// Weather around the player, all on the GPU: rain (streaks falling and slanting in the wind) and
// motes (dust or pollen drifting in the light). Each particle's place is a function of its index
// and the time, wrapped in a box that moves with the camera, so nothing is updated on the CPU and
// the field looks fixed in the world as you walk through it. And heat haze, a post-process: the
// air over hot ground shimmering in the distance.

import { cameraPosition, color, cross, float, getViewPosition, hash, instanceIndex, mod, mx_noise_float, normalize, perspectiveDepthToViewZ, positionGeometry, reference, screenUV, sin, smoothstep, time, uniform, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';

export interface WeatherOptions {
  /** Rain: 0–1 (how heavy), with its colour and the wind's push (m/s, x and z). */
  rain?: number;
  rainColor?: THREE.ColorRepresentation;
  wind?: [number, number];
  /** Motes drifting in the air: 0–1 (how many), and their colour (lit by the sun: keep it light). */
  motes?: number;
  motesColor?: THREE.ColorRepresentation;
}

/** Heat haze: what's seen through the air low over the ground in the distance wavers. */
export interface HazeOptions {
  /** How far it bends what's seen, about in pixels at 1080 lines (default 1.5). */
  strength?: number;
  /** Where it begins (m from the eye, default 40); full by twice that. */
  from?: number;
  /** Up to what height what's seen shimmers (m above y = 0, default 4; fading out from half of it). */
  height?: number;
}

type Vec3 = THREE.Node<'vec3'>;

/**
 * The scene (`beauty`, with its `depth`) seen through heat haze: each pixel shifted a little by
 * noise rising through the air, where what it shows is far and low. One full-screen pass.
 */
export function heatHaze(beauty: THREE.TextureNode, depth: THREE.TextureNode, camera: THREE.PerspectiveCamera, options: HazeOptions): THREE.Node<'vec4'> {
  const strength = ((options.strength ?? 1.5) / 1080) * 2;
  const from = options.from ?? 40;
  const height = options.height ?? 4;
  // The camera's own (the pass draws a quad with a camera of its own)
  const near = reference('near', 'float', camera);
  const far = reference('far', 'float', camera);
  const unproject = uniform(camera.projectionMatrixInverse);
  const toWorld = uniform(camera.matrixWorld);
  // What the pixel shows: how far, how high
  const d = depth.sample(screenUV).r;
  const distance = perspectiveDepthToViewZ(d, near, far).negate();
  const y = toWorld.mul(vec4(getViewPosition(screenUV, d, unproject), 1)).y;
  const amount = smoothstep(from, from * 2, distance).mul(float(1).sub(smoothstep(height * 0.5, height, y)));
  // Rising, wavering cells: finer up and down than across, as the air rises in thin layers
  const q = vec3(screenUV.x.mul(55), screenUV.y.mul(180).add(time.mul(3)), time.mul(0.7));
  const shift = vec2(mx_noise_float(q.add(17.3)).mul(0.35), mx_noise_float(q)).mul(amount.mul(strength));
  return beauty.sample(screenUV.add(shift));
}

/** Where particle `i` is: a hash of its index, carried by `drift` × time, wrapped in a box of `size` around the camera. */
function place(i: THREE.Node<'float'>, size: THREE.Vector3, drift: Vec3): Vec3 {
  const seed = vec3(hash(i), hash(i.add(17.3)), hash(i.add(41.7))).mul(vec3(size.x, size.y, size.z));
  const box = vec3(size.x, size.y, size.z);
  const p = seed.add(drift.mul(time));
  // Into the box around the camera, the way a tiling would: fixed in the world, always near
  return cameraPosition.add(mod(p.sub(cameraPosition), box).sub(box.mul(0.5)));
}

export class Weather extends THREE.Group {
  constructor(options: WeatherOptions) {
    super();
    this.name = 'weather';
    const wind = options.wind ?? [1.2, 0.4];
    if (options.rain) this.add(rain(options.rain, options.rainColor ?? 0xb8c8d8, wind));
    if (options.motes) this.add(motes(options.motes, options.motesColor ?? 0xfff2d8));
  }
}

function rain(amount: number, tint: THREE.ColorRepresentation, wind: [number, number]): THREE.Mesh {
  const count = Math.round(9000 * Math.min(1, amount));
  const size = new THREE.Vector3(36, 22, 36);
  const fall = vec3(wind[0], -9.5, wind[1]);
  const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(0.014, 0.55) as unknown as THREE.InstancedBufferGeometry);
  geometry.instanceCount = count;
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const i = instanceIndex.toFloat();
  // Each drop a little faster or slower, so they don't fall in sheets
  const speed = float(0.85).add(hash(i.add(3.1)).mul(0.3));
  const at = place(i, size, fall.mul(speed));
  // The streak along the fall, turned about it to face the camera
  const along = normalize(fall);
  const across = normalize(cross(along, normalize(cameraPosition.sub(at))));
  m.positionNode = at.add(across.mul(positionGeometry.x)).add(along.mul(positionGeometry.y));
  // Fainter far off and toward the ends of the streak
  const near = float(1).sub(at.sub(cameraPosition).length().div(18).clamp(0, 1));
  const ends = float(1).sub(positionGeometry.y.abs().div(0.275)).clamp(0, 1);
  m.colorNode = color(new THREE.Color(tint)).mul(0.55);
  m.opacityNode = near.mul(ends).mul(0.35 + 0.35 * Math.min(1, amount));
  const mesh = new THREE.Mesh(geometry, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

function motes(amount: number, tint: THREE.ColorRepresentation): THREE.Mesh {
  const count = Math.round(2500 * Math.min(1, amount));
  const size = new THREE.Vector3(30, 14, 30);
  const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(0.03, 0.03) as unknown as THREE.InstancedBufferGeometry);
  geometry.instanceCount = count;
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: true });
  const i = instanceIndex.toFloat();
  const t = time.add(hash(i.add(5.5)).mul(100));
  // A slow drift, and a wander of its own
  const wander = vec3(sin(t.mul(0.31).add(i)), sin(t.mul(0.23).add(i.mul(1.7))).mul(0.6), sin(t.mul(0.27).add(i.mul(2.3))));
  const at = place(i, size, vec3(0.25, 0.03, 0.1)).add(wander.mul(0.4));
  // A square facing the camera
  const toCam = normalize(cameraPosition.sub(at));
  const right = normalize(cross(vec3(0, 1, 0), toCam));
  const up = cross(toCam, right);
  m.positionNode = at.add(right.mul(positionGeometry.x)).add(up.mul(positionGeometry.y));
  const d = at.sub(cameraPosition).length();
  // Seen near, gone far; round (the corners of the square fade)
  const round = float(1).sub(positionGeometry.xy.length().div(0.015)).clamp(0, 1);
  const glint = sin(t.mul(1.7)).mul(0.5).add(0.5);
  m.colorNode = color(new THREE.Color(tint));
  m.opacityNode = round.mul(float(1).sub(d.div(14).clamp(0, 1))).mul(glint.mul(0.5).add(0.3));
  const mesh = new THREE.Mesh(geometry, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}
