// The demo: a world (src/demo/worlds: picked with ?world=<id>), a rocket launcher, and everything
// breakable. Everything here is the same in every world; the world says what's built, how it looks
// and sounds, and how it reacts.

import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { builtinAOContext, color, float, luminance, metalness, mix, mrt, normalView, output, packNormalToRGB, pass, roughness, sample, screenUV, unpackRGBToNormal, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { recommendedLimits, World } from 'three-avbd';
import { Destruction, type Ground, loadPropPack, materialKind, type PropModel, type V3 } from '../lib/index.ts';
import { DemoAudio } from './audio.ts';
import { collapseDust } from './effects.ts';
import { Effects } from './fx.ts';
import { Gun } from './gun.ts';
import { Launcher, loadKit } from './launcher.ts';
import { Player, Solids } from './player.ts';
import { followSun, sky, type SkyOptions } from './sky.ts';
import { heatHaze, Weather } from './weather.ts';
import { groundKind, gunHooks, waterOf, type WeaponName, Weapons } from './weapons.ts';
import { loadWorld, worlds } from './worlds/registry.ts';
import type { WorldLook, WorldRuntime } from './worlds/types.ts';

const status = document.getElementById('status')!;
const say = (s: string) => (status.textContent = s);
const params = new URLSearchParams(location.search);
// The worlds are there to see even where they can't run
picker((worlds.find((w) => w.id === params.get('world')) ?? worlds[0]).id);

if (!navigator.gpu) {
  say('This needs WebGPU: Chrome or Edge, or Safari 26.');
  throw new Error('no WebGPU');
}
// Chrome on Linux has navigator.gpu but no adapter until WebGPU is switched on; three.js would then
// fall back to WebGL2, where the physics can't run
if (!(await navigator.gpu.requestAdapter())) {
  say('WebGPU is off in this browser. In Chrome on Linux, turn on chrome://flags/#enable-unsafe-webgpu and #enable-vulkan and relaunch, or run npm run chrome.');
  throw new Error('no WebGPU adapter');
}

const def = await loadWorld(params.get('world'));
document.title = `${def.title} · Breakable`;
// ?look={...} and ?sky={...}: try looks and skies out (JSON over the world's own: fog, bloom,
// grade, reflections, weather; azimuth, elevation, sun)
const look: WorldLook = { ...def.look, ...(JSON.parse(params.get('look') ?? '{}') as WorldLook) };
const skyOptions: SkyOptions = { ...def.sky, ...(JSON.parse(params.get('sky') ?? '{}') as Partial<SkyOptions>) };

const renderer = new THREE.WebGPURenderer({ antialias: true, requiredLimits: await recommendedLimits() });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = look.exposure ?? 1.1;
document.body.prepend(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const fog = look.fog ?? { color: 0xb9c4cc, near: 60, far: 260 };
scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, def.far ?? 600);
scene.add(camera);

// The props load while the rest is made (a world is fine without them)
const propsLoading = Promise.all(
  (def.props ?? []).map((base) =>
    loadPropPack({ base }).catch((e): Record<string, PropModel> => {
      console.warn(`No props at ${base}:`, e.message);
      return {};
    }),
  ),
).then((packs) => Object.assign({}, ...packs) as Record<string, PropModel>);
// The launcher's and the rocket's models (without them, a drawn tube)
const kitLoading = loadKit().catch((e) => void console.warn('No launcher kit:', e.message));

say('Sky…');
const sun = await sky(scene, skyOptions);
const hemi = look.hemisphere ?? { sky: 0xc8d8ec, ground: 0x6a5a48, intensity: 0.35 };
scene.add(new THREE.HemisphereLight(hemi.sky, hemi.ground, hemi.intensity));
if (look.fill) {
  const f = look.fill;
  const s = sun.sunDirection;
  const azimuth = f.azimuth ?? Math.atan2(-s.z, s.x) + Math.PI;
  const elevation = f.elevation ?? Math.asin(s.y);
  const light = new THREE.DirectionalLight(f.color ?? sun.sun.color, f.intensity);
  light.position.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.sin(azimuth) * Math.cos(elevation));
  scene.add(light);
}

say('Physics…');
const world = await World.create({ renderer, maxBodies: 60_000 });
await def.scenery(scene, world, sun);
// The scenery's fixed bodies (the pieces come after): rockets go off on every one; the player walks
// into and stands on those that rise above the ground (groundAt has the ground's own, as drawn)
const solids = new Solids(world.bodies.filter((b) => b.fixed));
const footing = solids.above(def.groundAt);

say(`Building ${def.title}…`);
const destruction = new Destruction({ maxLoose: 3000, capacity: 600_000, ...def.destruction, world, scene, materials: def.materials(), ground: def.ground === undefined ? 0 : def.ground });
const models = await propsLoading;
const start = await def.build(destruction, models);
// It stands as built (roofs carry their tanks, towers their battlements); what's undermined still falls
destruction.reinforce();

// Chips land on what's under them (the world's own sprays and sparks too), not on a plane at y 0
const effects = new Effects(scene, camera, { maxParticles: 8000, sunDirection: sun.sunDirection, renderer, smoke: look.smoke, dustPalette: look.dustPalette, destruction, floor: floorUnder });
// Every effect used once, out of sight, so the first blast doesn't stall
effects.warm();
const player = new Player(camera, renderer.domElement, destruction, def.groundAt, { walkable: def.walkable?.bind(def), solids: footing });
player.place(new THREE.Vector3(...start.feet), new THREE.Vector3(...start.look));
const kit = await kitLoading;
const launcher = new Launcher(scene, camera, destruction, def.groundAt, { kit, effects, player, solids });
// Where the ground is water (the world's, or guessed: Harbor Yard's): it takes bullets, and keeps no scorch
const water = waterOf(def);
// The machine gun: the scenery and the ground stop its bullets too, the ground of what its steps
// sound like (down in a crater through a breakable ground, what that ground is made of there, or
// what the world says a pit's side is)
const kindOf = (m: string) => materialKind(m, destruction.materials[m], def.audio.materials[m]);
const pitSide = (at: V3, g: Ground) => def.pitSide?.(at, g);
const gun = new Gun(camera, destruction, def.groundAt, { kit: kit?.gun, effects, player, solids, kindOf, ground: groundKind(def), water, pitSide });
const weapons = new Weapons([launcher, gun]);
const audio = new DemoAudio(def, destruction, camera, launcher, player, gun);
// The weapons dip with each footfall and landing (their sounds are on these already)
const footstep = player.onStep;
const landing = player.onLand;
player.onStep = (on, speed) => (footstep(on, speed), weapons.footfall(speed));
player.onLand = (speed) => (landing(speed), weapons.footfall(speed));
const rt: WorldRuntime = { scene, camera, destruction, sound: audio.engine, ambience: audio.ambience, effects, time: 0, floor: floorUnder, blast: (at, radius, throws) => blast(at, [0, 1, 0], radius, undefined, throws) };
// The world starts once its sounds have loaded (or failed to)
audio.ready.catch((e: Error) => console.warn('Sounds:', e.message)).then(() => def.onStart?.(rt));

// --- What happens when things break ------------------------------------------------------------

const DUST = def.dust;
/** How much dust a material raises (1: as much as any). */
const dustAmount = (material: string) => def.dustAmount?.[material] ?? 1;
const RADIUS = def.blastRadius ?? 2.3;

function blast(at: V3, normal: V3, radius = RADIUS, rocket?: THREE.Object3D, throws: { speed?: number; spin?: number } = {}): void {
  // Just off the surface, so it reaches into the wall rather than starting inside it
  const p: V3 = [at[0] + normal[0] * 0.15, at[1] + normal[1] * 0.15, at[2] + normal[2] * 0.15];
  // What's already falling is cut too: a rocket into a falling section breaks it
  destruction.explode({ at: p, radius, speed: throws.speed ?? 15, spin: throws.spin ?? 12, loose: true });
  effects.explosion(p, normal, (1.35 * radius) / 2.3);
  // Soot where it went off, but not on the water (it would lie on it, within a metre of the blast)
  if (!water?.(at[0], at[2]) || at[1] > def.groundAt(at[0], at[2]) + 1) effects.scorch(at, normal, radius);
  audio.blast(p, radius, rocket);
  def.onBlast?.(p, radius, rt);
  const d = camera.position.distanceTo(new THREE.Vector3(...p));
  player.shake = Math.max(player.shake, Math.min(3, 30 / (d + 4)));
}

destruction.on('dust', (e) => effects.dust(e.at, e.volume * dustAmount(e.material), DUST[e.material]));
// Pieces too small to be bodies fly as particles: a spray for each, at most a few dozen a frame
const CHIPS = def.chips;
const debris: Array<{ at: V3; velocity: V3; material: string }> = [];
destruction.on('debris', (e) => debris.push(e));
function sprayDebris(): void {
  const stride = Math.max(1, Math.ceil(debris.length / 30));
  for (let i = 0; i < debris.length; i += stride) {
    const { at, velocity: v, material } = debris[i];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    const dir: V3 = [v[0] / l, v[1] / l, v[2] / l];
    // Landing on what's under where it was (its place is empty now): out of a breakable ground, a
    // spray of what it is, as a strike throws it; else chips
    const floor = floorUnder(at);
    if (destruction.grounds.some((g) => g.contains(at[0], at[2]) && at[1] < g.top)) effects.bullet(at, dir, { kind: kindOf(material), chips: CHIPS[material], dust: DUST[material], floor });
    else effects.impact(at, dir, CHIPS[material] ?? 0x8a8a8a, floor);
  }
  debris.length = 0;
}
destruction.on('collapse', (e) => {
  // Dust over what came down, more for bigger sections, as much as what they're made of raises,
  // in the colour of most of it
  const c = collapseDust(e.pieces, dustAmount);
  effects.dustRegion(c.min, c.max, Math.min(80, 8 + e.volume * 6) * c.amount, DUST[c.material] ?? 0xa89a88);
});
launcher.onBlast = (b) => blast(b.at, b.normal, RADIUS, b.rocket);
destruction.on('impact', (e) => def.onImpact?.(e, rt));
launcher.onTrail = (at, v) => effects.trail(at, v);
/**
 * What chips fall onto from a point in the open: the ground, or what stands under it (a breakable
 * ground's slabs: under them groundAt has the bed).
 */
function floorUnder(from: V3): number {
  const ground = def.groundAt(from[0], from[2]);
  return Math.max(ground, destruction.raycast(from, [0, -1, 0], Math.max(0, from[1] - ground))?.point[1] ?? -Infinity);
}
// Where a bullet strikes: chips and powder in the colours of what it struck (sparks off metal),
// falling from just off it onto what's under it, a hole in it (a dent in metal, a pock in the dirt)
// unless it gave way or is flying, and its sound; then the world hears it (onShot), and each burst
// as it ends (onBurst)
gunHooks(gun, def, rt, (h) => {
  const [at, n] = [h.at, h.normal];
  const chips = h.material ? CHIPS[h.material] : undefined;
  effects.bullet(at, n, { kind: h.kind, chips, dust: h.material ? DUST[h.material] : undefined });
  if (!h.broke && h.kind !== 'glass' && h.piece?.state !== 'loose') effects.decal(at, n, { kind: h.kind === 'metal' ? 'dent' : h.kind === 'dirt' ? 'pock' : 'hole', piece: h.piece, color: chips });
  audio.bullet(h);
});

// --- Input -------------------------------------------------------------------------------------

const canvas = renderer.domElement;
const overlay = document.getElementById('overlay')!;
const hint = document.getElementById('hint')!;
const locked = () => document.pointerLockElement === canvas;
/** The card over the world, open or closed; closed and not playing, a line says how to. */
function card(open: boolean): void {
  overlay.classList.toggle('hidden', !open);
  hint.classList.toggle('hidden', open || locked());
}
// Set once the world's ready; when the lock was last let go (ms)
let ready = false;
let unlockedAt = -Infinity;
canvas.addEventListener('click', () => {
  if (!locked()) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  card(!locked());
  if (!locked()) {
    weapons.trigger(false);
    unlockedAt = performance.now();
  }
});
overlay.addEventListener('click', () => canvas.requestPointerLock());
// The left button fires (the gun while it's held), the wheel switches
canvas.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) weapons.trigger(true);
});
addEventListener('mouseup', (e) => e.button === 0 && weapons.trigger(false));
// (once a turn of it: a touchpad's swipe is many small steps; lines and pages are taken as notches)
canvas.addEventListener('wheel', (e) => document.pointerLockElement === canvas && weapons.scroll(e.deltaMode ? e.deltaY * 100 : e.deltaY, e.timeStamp), { passive: true });
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  // Esc lets go of the mouse and opens the card (the browser's doing); again, it closes it. Not
  // back into play: Esc can't take the mouse, a click on the world does. (Not the Esc that let go)
  if (e.code === 'Escape' && ready && !locked() && performance.now() - unlockedAt > 300) {
    (document.activeElement as HTMLElement | null)?.blur();
    card(overlay.classList.contains('hidden'));
  }
  if (e.code === 'KeyR') location.reload();
  if (e.code === 'KeyM') audio.mute = !audio.mute;
  if (e.code === 'Digit1') weapons.select('launcher');
  if (e.code === 'Digit2') weapons.select('gun');
  // (Flying, Q goes down)
  if (e.code === 'KeyQ' && !player.fly) weapons.swap();
});

// --- Rendering ---------------------------------------------------------------------------------

// A depth and normal pre-pass for ambient occlusion (in the corners, the reveals of the windows,
// under the rubble), which then shades the scene's indirect light; bloom on what's bright
const pipeline = new THREE.RenderPipeline(renderer);
// The particles (layer 1) aren't in the pre-pass, which sees the solid world through a camera of
// its own (layer 0 only), kept on the player's each frame: dust isn't a surface to occlude
const PARTICLES = 1;
// The world's weather, with the particles: not a surface to occlude
const weather = look.weather ? new Weather(look.weather) : null;
if (weather) scene.add(weather);
const airborne = [...effects.objects, ...(weather ? [weather] : [])];
for (const o of airborne) o.traverse((c) => c.layers.set(PARTICLES));
camera.layers.enable(PARTICLES);
const solidCamera = new THREE.PerspectiveCamera(camera.fov, camera.aspect, camera.near, camera.far);
solidCamera.layers.set(0);
const prePass = pass(scene, solidCamera, { samples: 0 });
prePass.setMRT(mrt({ output: normalView }));
const occlusion = ao(prePass.getTextureNode('depth'), prePass.getTextureNode(), solidCamera);
occlusion.radius.value = look.ao ?? 0.6;
occlusion.resolutionScale = 0.5;
const scenePass = pass(scene, camera);
scenePass.contextNode = builtinAOContext(occlusion.getTextureNode().sample(screenUV).r);
// The scene as drawn, seen through heat haze where the world has it
const beauty = scenePass.getTextureNode('output');
let colour: THREE.Node<'vec4'> = look.haze ? heatHaze(beauty, scenePass.getTextureNode('depth'), camera, look.haze) : beauty;
if (look.reflections) {
  // Reflections on what's glossy: the beauty pass also writes its normals and how much each pixel
  // reflects (metal, or smooth: wet asphalt, glass, polished stone), and screen-space rays find
  // what each reflects. Particles and weather reflect nothing.
  const strength = look.reflections.strength ?? 1;
  const shine = metalness.max(float(1).sub(roughness.smoothstep(0.1, 0.4)).mul(strength));
  scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView), shine: vec2(shine, roughness) }));
  for (const o of airborne) o.traverse((c) => ((c as THREE.Mesh).material as THREE.NodeMaterial | undefined)?.isNodeMaterial && (((c as THREE.Mesh).material as THREE.NodeMaterial).mrtNode = mrt({ shine: vec2(0, 1) })));
  const normals = scenePass.getTextureNode('normal');
  const shineMap = scenePass.getTextureNode('shine');
  const reflection = ssr(beauty, scenePass.getTextureNode('depth'), sample((uv) => unpackRGBToNormal(normals.sample(uv))), { metalnessNode: shineMap.r, roughnessNode: shineMap.g, camera });
  // Rays long enough to reach a tall sign from the street (a step a pixel), at half resolution
  // to keep them cheap
  reflection.maxDistance.value = look.reflections.distance ?? 100;
  reflection.thickness.value = look.reflections.thickness ?? 0.15;
  reflection.resolutionScale = look.reflections.resolution ?? 0.5;
  reflection.quality.value = look.reflections.quality ?? 1;
  // Its colour comes weighted already (by how much the pixel reflects, the ray's length, Fresnel):
  // added, as specular light is; a miss adds nothing
  colour = vec4(colour.rgb.add(reflection.rgb), colour.a);
}
const glow = look.bloom ?? {};
let final = colour.add(bloom(colour, glow.strength ?? 0.35, glow.radius ?? 0.4, glow.threshold ?? 0.92));
if (look.grade) {
  // Grading in linear light, before tone mapping: saturation and contrast about middle grey, a tint, a vignette
  const g = look.grade;
  let c: THREE.Node<'vec3'> = final.rgb;
  if (g.saturation !== undefined) c = mix(vec3(luminance(c)), c, g.saturation);
  if (g.contrast !== undefined) c = c.div(0.18).max(0).pow(g.contrast).mul(0.18);
  if (g.tint !== undefined) c = c.mul(color(new THREE.Color(g.tint)));
  if (g.vignette) c = c.mul(float(1).sub(screenUV.sub(0.5).length().mul(1.414).smoothstep(0.45, 1.05).mul(g.vignette)));
  final = vec4(c, final.a);
}
pipeline.outputNode = final;

// Every pipeline a frame draws with, made before play: each pass's (the occlusion pre-pass, the
// beauty pass with its reflection buffers, the shadows, the post) for every object in the scene,
// in view or not. Made as they were first drawn, they froze the first seconds of play (Harbor
// Yard's 155: 6 s of frames over 100 ms; Brick Street's, 4). And what the first frame makes besides:
// the solver's on its first step (the hull narrowphase, once the first hulls reach it), the
// particles' kernels
say('Shaders…');
// (And those of materials only what wakes uses: a piece of each, out of sight while the frames are drawn)
const warmed = destruction.warm();
world.step();
effects.update(0);
await compileFrames();
warmed();

/**
 * Draw two frames with nothing culled, and wait for the GPU to have made what they drew with. In the
 * renderer's animation loop, as play draws them: drawn outside it, a frame's passes (the shadows,
 * the reflections) made pipelines of their own, and the first frames of play made 40 more.
 */
async function compileFrames(): Promise<void> {
  const culled: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (!o.frustumCulled) return;
    o.frustumCulled = false;
    culled.push(o);
  });
  let left = 2;
  await new Promise<void>((done) =>
    renderer.setAnimationLoop(() => {
      pipeline.render();
      if (--left === 0) done();
    }),
  );
  renderer.setAnimationLoop(null);
  for (const o of culled) o.frustumCulled = true;
  await world.device.queue.onSubmittedWorkDone();
}

const hud = document.getElementById('hud')!;
const weaponHud = document.getElementById('weapon')!;
const profile: number[][] = [];
let owed = 0;
let lastFrame = performance.now();
const timer = new THREE.Timer();
let frames = 0;
let fpsAt = performance.now();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const t0 = performance.now();
  player.update(dt);
  weapons.update(dt, Math.min(1, Math.hypot(player.velocity.x, player.velocity.z) / 4));
  const t1 = performance.now();
  // Physics: the steps this frame owes (at most three: behind further, it slows down rather than
  // stalls). Only the first detects contacts; the rest reuse them, so a slow frame doesn't pay for
  // collision three times over and fall further behind
  owed += dt;
  const steps = Math.min(3, Math.floor(owed / world.dt));
  for (let k = 0; k < steps; k++) world.step(k === 0 ? {} : { reuseManifolds: true });
  owed = Math.min(owed - steps * world.dt, world.dt);
  const t2 = performance.now();
  destruction.update(dt);
  const t3 = performance.now();
  sprayDebris();
  audio.update(dt);
  rt.time += dt;
  def.update?.(dt, rt);
  effects.update(dt);
  followSun(sun, player.position);
  solidCamera.position.copy(camera.position);
  solidCamera.quaternion.copy(camera.quaternion);
  const t4 = performance.now();
  pipeline.render();
  const t5 = performance.now();
  // Where each frame's CPU time went (demo.profile: the last 300 frames)
  profile.push([t0 - lastFrame, t1 - t0, t2 - t1, t3 - t2, t4 - t3, t5 - t4]);
  weapons.show(weaponHud);
  if (profile.length > 300) profile.shift();
  lastFrame = t0;
  frames++;
  const now = performance.now();
  if (now - fpsAt > 500) {
    const fps = (frames * 1000) / (now - fpsAt);
    frames = 0;
    fpsAt = now;
    const s = destruction.stats;
    hud.innerHTML = `<b></b>${fps.toFixed(0)} fps · ${s.pieces.toLocaleString('en')} pieces · ${s.loose.toLocaleString('en')} moving`;
    hud.querySelector('b')!.textContent = def.title;
  }
});
say('');
overlay.title = 'Click to play';
ready = true;
// Loaded: the card goes (Esc brings it back, for the worlds)
if (!locked()) card(false);

addEventListener('resize', () => {
  camera.aspect = solidCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  solidCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// For scripted checks (scripts/shot.mjs)
Object.assign(window, {
  demo: {
    THREE,
    renderer,
    destruction,
    world,
    player,
    launcher,
    gun,
    weapons,
    effects,
    audio,
    camera,
    /** The post-processing (pipeline.render() draws a frame). */
    pipeline,
    /** The world's definition (def.id: which world), and what its hooks get. */
    def,
    rt,
    models,
    /** Stand at feet (x, y, z) looking at (tx, ty, tz). */
    look: (x: number, y: number, z: number, tx: number, ty: number, tz: number) => player.place(new THREE.Vector3(x, y, z), new THREE.Vector3(tx, ty, tz)),
    /** A blast at a point, off a surface facing `normal` (default: toward z = 0). */
    blast: (x: number, y: number, z: number, radius = RADIUS, normal?: V3) => blast([x, y, z], normal ?? [0, 0, -Math.sign(z) || 1], radius),
    /** Fire a rocket from the player's eye at a point. */
    shoot: (x: number, y: number, z: number) => launcher.fireFrom(camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.3, -0.3, 0)), new THREE.Vector3(x, y, z)),
    /** Take up a weapon ('gun' or 'launcher'). */
    weapon: (name: WeaponName) => weapons.select(name),
    /** Fire `n` rounds of the gun, or rockets of the launcher (the one in hand), at its pace, where the crosshair is. */
    fire: (n = 1) => weapons.burst(n),
    stats: () => ({ ...destruction.stats, particles: effects.count, marks: effects.marks, props: destruction.all().filter((p) => p.prop).length, voices: audio.engine.active }),
    /** The last frames' times (ms): since the last frame, player, world, destruction, effects, render. */
    profile,
  },
});

/** The worlds in the overlay's card, a picture of each: the one shown (to play it), and the others to go to. */
function picker(current: string): void {
  const list = document.getElementById('worlds');
  if (!list) return;
  for (const w of worlds) {
    const b = document.createElement('button');
    b.className = w.id === current ? 'world on' : 'world';
    if (w.id === current) b.setAttribute('aria-current', 'true');
    b.innerHTML = `<img alt="" width="640" height="360" /><span class="text"><strong></strong><span></span></span>`;
    // Its picture is public/thumbs/<id>.jpg; a world without one keeps the space
    const img = b.querySelector('img')!;
    img.onerror = () => (img.style.visibility = 'hidden');
    img.src = `thumbs/${w.id}.jpg`;
    b.querySelector('strong')!.textContent = w.title;
    b.querySelector('.text span')!.textContent = w.blurb;
    b.onclick = (e) => {
      e.stopPropagation();
      if (w.id !== current) location.search = `?world=${w.id}`;
      else {
        // Not focused while playing, or Space (jump) would press it
        b.blur();
        document.getElementById('overlay')!.click();
      }
    };
    list.append(b);
  }
  // The arrow keys go from card to card, up and down a row as they're laid out
  list.addEventListener('keydown', (e) => {
    const cards = [...list.children] as HTMLElement[];
    const i = cards.indexOf(document.activeElement as HTMLElement);
    const across = cards.filter((c) => c.offsetTop === cards[0].offsetTop).length;
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: across, ArrowUp: -across };
    const step = steps[e.key];
    if (i < 0 || !step) return;
    e.preventDefault();
    cards[Math.min(cards.length - 1, Math.max(0, i + step))].focus();
  });
}
