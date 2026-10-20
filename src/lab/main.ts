// The lab: a few small structures to check the library against, click to blast.

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { recommendedLimits, World } from 'three-avbd';
import { Destruction, presets, type V3 } from '../lib/index.ts';

const renderer = new THREE.WebGPURenderer({ antialias: true, requiredLimits: await recommendedLimits() });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c8);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(6, 6, 16);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(3, 2, 0);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4036, 1.4));
const sun = new THREE.DirectionalLight(0xfff2e0, 3);
sun.position.set(12, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardNodeMaterial({ color: 0x6d6a63, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const world = await World.create({ renderer, maxBodies: 30_000 });
world.addBox({ size: [200, 1, 200], position: [0, -0.5, 0], fixed: true, friction: 0.8 });

const destruction = new Destruction({
  world,
  scene,
  materials: { brick: presets.brick(), concrete: presets.concrete(), glass: presets.glass() },
});

// A wall in two halves, bonded where they meet
destruction.addBox({ material: 'brick', size: [3, 3, 0.3], position: [-1.5, 1.5, 0] });
destruction.addBox({ material: 'brick', size: [3, 3, 0.3], position: [1.5, 1.5, 0], tint: 0xe8d0c0 });
// Two pillars and a slab on them
destruction.addBox({ material: 'brick', size: [0.6, 3, 0.6], position: [5.5, 1.5, 0] });
destruction.addBox({ material: 'brick', size: [0.6, 3, 0.6], position: [8.5, 1.5, 0] });
destruction.addBox({ material: 'concrete', size: [4.2, 0.3, 2], position: [7, 3.15, 0] });
// A pane
destruction.addBox({ material: 'glass', size: [1.6, 1.4, 0.04], position: [-4, 0.7, 0] });

// Click: blast where the ray hits
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !e.shiftKey) return;
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const o = ray.ray.origin.toArray() as V3;
  const d = ray.ray.direction.toArray() as V3;
  const hit = destruction.raycast(o, d);
  if (hit) destruction.explode({ at: hit.point, radius: 1.2 });
});

const hud = document.getElementById('hud')!;
const clock = new THREE.Timer();
let frames = 0;
let fpsAt = performance.now();
let fps = 0;
renderer.setAnimationLoop(() => {
  clock.update();
  const dt = Math.min(clock.getDelta(), 1 / 20);
  world.update(dt);
  destruction.update(dt);
  controls.update();
  renderer.render(scene, camera);
  frames++;
  const now = performance.now();
  if (now - fpsAt > 500) {
    fps = (frames * 1000) / (now - fpsAt);
    frames = 0;
    fpsAt = now;
    const s = destruction.stats;
    hud.textContent = `${fps.toFixed(0)} fps   pieces ${s.pieces}  loose ${s.loose}  joints ${s.joints}  verts ${s.vertices}\nshift-click: blast`;
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// For scripted checks
Object.assign(window, {
  lab: {
    destruction,
    world,
    camera,
    controls,
    explode: (x: number, y: number, z: number, radius = 1.2) => {
      const r = destruction.explode({ at: [x, y, z], radius });
      return { broken: r.broken, made: r.made.length, loose: r.loose.length, dust: +r.dust.toFixed(3), collapsed: r.collapsed.length };
    },
    stats: () => destruction.stats,
  },
});
