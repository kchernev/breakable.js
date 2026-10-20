// FX lab: a ground, a wall and a few boxes, a rocket every few seconds, bullet hits and falling dust.
// URL flags: ?auto=0 (no automatic effects), ?bloom=0, ?tm=0 (no tone mapping), ?soft=0 (no soft particles),
// ?demo=1 (the demo's lighting: HDR sky as environment, AgX, a weak hemisphere light, fog),
// ?gpu=1 (GPU timestamps: fx.gpu() gives the render and compute time per frame in ms).
// Scripted checks: window.fx = { effects, explode(x, y, z), ... }

import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Effects, type V3 } from './effects.ts';

const params = new URLSearchParams(location.search);
const flag = (name: string, fallback: boolean): boolean => (params.has(name) ? params.get(name) !== '0' : fallback);
let auto = flag('auto', true);
const useBloom = flag('bloom', true);
const demoLight = flag('demo', false);

const gpuTiming = flag('gpu', false);
const renderer = new THREE.WebGPURenderer({ antialias: true, trackTimestamp: gpuTiming });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
if (flag('tm', true)) {
  renderer.toneMapping = demoLight ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
}
document.body.append(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c8);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(16, 7, 20);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.5, -1);
controls.update();

if (demoLight) {
  const hdr = await new HDRLoader().loadAsync('hdri/qwantani_late_afternoon_puresky_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  scene.environment = hdr;
  scene.backgroundIntensity = 0.85;
  scene.environmentIntensity = 0.55;
  scene.fog = new THREE.Fog(0xb9c4cc, 60, 260);
}
scene.add(demoLight ? new THREE.HemisphereLight(0xc8d8ec, 0x6a5a48, 0.35) : new THREE.HemisphereLight(0xdfe8ff, 0x4a4036, 1.4));
const sun = new THREE.DirectionalLight(0xfff2e0, demoLight ? 3.2 : 3);
sun.position.set(0.5, 0.8, 0.3).multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 100 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardNodeMaterial({ color: 0x6d6a63, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const box = (size: V3, pos: V3, color: number): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardNodeMaterial({ color, roughness: 0.9 }));
  m.position.set(...pos);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
};
// A brick "building" whose front face is at z = 0
box([10, 8, 5], [0, 4, -2.5], 0x9c6a52);
box([3, 2, 3], [9, 1, 2], 0x8f8a80);
box([1.5, 1.5, 1.5], [-7, 0.75, 4], 0x6e7c88);
box([2, 4, 2], [-8.5, 2, -3], 0x8f8a80);

const rocketMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), new THREE.MeshStandardNodeMaterial({ color: 0x3a3d33 }));
rocketMesh.visible = false;
scene.add(rocketMesh);

const effects = new Effects(scene, camera, { sunDirection: new THREE.Vector3(0.5, 0.8, 0.3), softParticles: flag('soft', true) });

let pipeline: THREE.RenderPipeline | null = null;
if (useBloom) {
  pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  pipeline.outputNode = scenePass.add(bloom(scenePass, 0.45, 0.35, 1.0));
}

// A rocket: flies from `from` to `to`, leaving a trail, then explodes there
interface Rocket { p: THREE.Vector3; v: THREE.Vector3; to: THREE.Vector3; normal: V3 }
const rockets: Rocket[] = [];
const fire = (to: V3, normal: V3 = [0, 0, 1]): void => {
  const target = new THREE.Vector3(...to);
  const from = target.clone().add(new THREE.Vector3(normal[0] * 30 - 12, 4, normal[2] * 30 + 6));
  rockets.push({ p: from, v: target.clone().sub(from).normalize().multiplyScalar(45), to: target, normal });
};

const explode = (x: number, y: number, z: number, nx = 0, ny = 0, nz = 1, scale = 1): number => {
  effects.explosion([x, y, z], [nx, ny, nz], scale);
  return effects.count;
};

// The automatic show
let showClock = 0;
let nextRocket = 0.5;
let nextHit = 0;
let nextDust = 1.5;
const tick = (dt: number): void => {
  if (!auto) return;
  showClock += dt;
  if (showClock >= nextRocket) {
    nextRocket = showClock + 3;
    fire([THREE.MathUtils.randFloat(-3, 3), THREE.MathUtils.randFloat(2.5, 6), 0.05]);
  }
  if (showClock >= nextHit) {
    nextHit = showClock + THREE.MathUtils.randFloat(0.15, 0.4);
    effects.impact([THREE.MathUtils.randFloat(-4.5, 4.5), THREE.MathUtils.randFloat(0.5, 7.5), 0.02], [0, 0, 1], 0x9c6a52);
  }
  if (showClock >= nextDust) {
    nextDust = showClock + 3;
    // Pieces falling off the wall: a few puffs at the foot, a strip of falling dust
    const x = THREE.MathUtils.randFloat(-4, 4);
    effects.dust([x, 0.3, 0.8], 0.15, 0x9c6a52);
    effects.dustRegion([x - 1, 0.1, 0.2], [x + 1, 2.5, 1.2], 8, 0x9c6a52);
  }
};

const hud = document.getElementById('hud')!;
const timer = new THREE.Timer();
let frames = 0;
let fpsAt = performance.now();
let cpuMs = 0;
let gpuRender = 0;
let gpuCompute = 0;
let resolving = false;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  tick(dt);
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    const step = r.v.clone().multiplyScalar(dt);
    if (r.p.distanceTo(r.to) <= step.length()) {
      rockets.splice(i, 1);
      effects.explosion(r.to.toArray() as V3, r.normal, 1);
      continue;
    }
    r.p.add(step);
    effects.trail(r.p.toArray() as V3, r.v.toArray() as V3);
  }
  rocketMesh.visible = rockets.length > 0;
  if (rockets.length) {
    rocketMesh.position.copy(rockets[0].p);
    rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rockets[0].v.clone().normalize());
  }
  const t0 = performance.now();
  effects.update(dt);
  cpuMs = cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  controls.update();
  if (pipeline) pipeline.render();
  else renderer.render(scene, camera);
  if (gpuTiming && !resolving) {
    resolving = true;
    void Promise.all([renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER), renderer.resolveTimestampsAsync(THREE.TimestampQuery.COMPUTE)]).then(() => {
      gpuRender = gpuRender * 0.9 + renderer.info.render.timestamp * 0.1;
      gpuCompute = gpuCompute * 0.9 + renderer.info.compute.timestamp * 0.1;
      resolving = false;
    });
  }
  frames++;
  const now = performance.now();
  if (now - fpsAt > 500) {
    const fps = (frames * 1000) / (now - fpsAt);
    frames = 0;
    fpsAt = now;
    hud.textContent = `${fps.toFixed(0)} fps   particles ${effects.count}   fx cpu ${cpuMs.toFixed(2)} ms\n${auto ? 'auto' : 'manual'}${useBloom ? ' + bloom' : ''}`;
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

Object.assign(window, {
  fx: {
    effects,
    renderer,
    camera,
    controls,
    explode,
    fire,
    setAuto: (on: boolean) => {
      auto = on;
    },
    /** Average frame time over n frames, in ms. */
    frameTime: (n = 40) =>
      new Promise<string>((resolve) => {
        const t: number[] = [];
        let last = performance.now();
        const f = (): void => {
          const now = performance.now();
          t.push(now - last);
          last = now;
          if (t.length < n) requestAnimationFrame(f);
          else resolve((t.reduce((a, b) => a + b) / t.length).toFixed(1));
        };
        requestAnimationFrame(f);
      }),
    cpu: () => cpuMs.toFixed(3),
    /** GPU ms per frame (smoothed), with ?gpu=1. */
    gpu: () => ({ render: +gpuRender.toFixed(2), compute: +gpuCompute.toFixed(3) }),
  },
});
