// The solver's behaviour, checked in Chrome (the GPU solver doesn't run under Node here): pieces
// thrown at the ground, sliding, sliding over the seams of a tiled floor, stacked, pinched, rolling
// and landing. Each case runs on a world of its own on the demo's GPU device and has a threshold;
// the script prints each and exits 1 if one fails. Chrome runs as in shot.mjs.
// node scripts/solver-lab.mjs [--port 5330] [--world nyc] [--only seams,roll]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

// Each case: an async function of (World, device), run in the page, returning { ok, detail }
const CASES = {
  // Thin plates and slivers thrown at a 1 m ground box at 10-40 m/s, turned every which way, a slow
  // frame's substeps between: speculative contacts catch them at the surface
  throw: async (World, device) => {
    const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const w = await World.create({ device, maxBodies: 512 });
    w.maxSpeed = 40;
    w.addBox({ size: [400, 1, 400], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
    const plates = [];
    for (let k = 0; k < 120; k++) {
      const q = [hash(k) - 0.5, hash(k + 0.3) - 0.5, hash(k + 0.7) - 0.5, hash(k + 0.9) - 0.5];
      const l = Math.hypot(...q);
      plates.push(w.addBox({ size: k % 2 ? [0.3, 0.01, 0.3] : [0.6, 0.03, 0.04], position: [(k % 12) * 3, 0.6, Math.floor(k / 12) * 3], rotation: q.map((x) => x / l), density: 0.5, friction: 0.8, velocity: [0, -10 - (k % 4) * 10, 0] }));
    }
    for (let s = 1; s <= 120; s++) w.step(s % 2 ? {} : { reuseManifolds: true });
    await w.read();
    const through = plates.filter((p) => p.position[1] < -0.5).length;
    w.destroy();
    return { ok: through <= 2, detail: `${through} of 120 through the ground box (at most 2)` };
  },

  // Boxes of density 0.001 to 1000 sliding from 10 m/s (friction 0.5): v²/(2μg) = 10.2 m. Thrown at
  // once, and after resting 2 s (a contact that stuck mustn't pull its box back once it stops)
  slide: async (World, device) => {
    const rows = [];
    let ok = true;
    for (const settled of [false, true]) {
      const w = await World.create({ device, maxBodies: 64 });
      w.maxSpeed = 40;
      w.addBox({ size: [400, 1, 400], position: [0, -0.5, 0], fixed: true, friction: 0.5 });
      const densities = [0.001, 0.1, 1, 10, 1000];
      const boxes = densities.map((density, k) => w.addBox({ size: [0.3, 0.3, 0.3], position: [0, 0.15, k * 3], density, friction: 0.5, velocity: settled ? [0, 0, 0] : [10, 0, 0] }));
      if (settled) {
        for (let s = 0; s < 120; s++) w.step();
        boxes.forEach((b, k) => b.applyImpulse([10 * densities[k] * 0.027, 0, 0]));
      }
      const farthest = boxes.map(() => 0);
      for (let s = 1; s <= 300; s++) {
        w.step();
        if (s % 30 === 0) { await w.read(); boxes.forEach((b, k) => (farthest[k] = Math.max(farthest[k], b.position[0]))); }
      }
      await w.read();
      boxes.forEach((b, k) => {
        const x = b.position[0];
        ok &&= Math.abs(x / 10.19 - 1) <= 0.15 && farthest[k] - x < 0.05;
        rows.push(`${settled ? 'settled ' : ''}${densities[k]}: ${x.toFixed(2)} m`);
      });
      w.destroy();
    }
    return { ok, detail: `${rows.join(', ')} (10.2 m within 15%, none sliding back)` };
  },

  // Boxes and a hull slid across a floor of flush fixed tiles (0.5 m: a seam every 0.5 m), boxes and
  // hulls, from 3 to 15 m/s (friction 0.4): as far as on one floor, v²/(2μg), and no hop
  seams: async (World, device) => {
    const blob = [-0.13, -0.05, -0.1, 0.14, -0.05, -0.09, 0.12, -0.05, 0.11, -0.12, -0.05, 0.1, -0.1, 0.06, -0.07, 0.09, 0.07, -0.08, 0.1, 0.05, 0.09, -0.08, 0.08, 0.06, 0, 0.1, 0];
    const tile = [-0.25, -0.1, -0.25, 0.25, -0.1, -0.25, 0.25, -0.1, 0.25, -0.25, -0.1, 0.25, -0.25, 0.1, -0.25, 0.25, 0.1, -0.25, 0.25, 0.1, 0.25, -0.25, 0.1, 0.25];
    let worst = [Infinity, 0];
    let hop = 0;
    for (const hulls of [false, true]) {
      const w = await World.create({ device, maxBodies: 2048 });
      w.maxSpeed = 40;
      for (let k = 0; k < 120; k++) for (let m = 0; m < 12; m++) {
        const at = [k * 0.5 + 0.25, -0.1, m * 0.5 - 2.75];
        if (hulls) w.addHull({ points: tile, position: at, fixed: true, friction: 0.4 });
        else w.addBox({ size: [0.5, 0.2, 0.5], position: at, fixed: true, friction: 0.4 });
      }
      const pieces = [];
      for (const [i, v] of [3, 6, 10, 15].entries()) for (const [j, s] of [[0.3, 0.1, 0.2], [0.05, 0.05, 0.05], [0.4, 0.02, 0.3], null].entries()) {
        const at = [0.6, s ? s[1] / 2 : 0.051, -2.5 + (i * 4 + j) * 0.32];
        const options = { position: at, density: 500, friction: 0.4, velocity: [v, 0, 0] };
        pieces.push({ v, body: s ? w.addBox({ ...options, size: s }) : w.addHull({ ...options, points: blob }) });
      }
      for (let s = 1; s <= 360; s++) {
        w.step();
        if (s % 3 === 0) { await w.read(); for (const p of pieces) hop = Math.max(hop, p.body.velocity[1]); }
      }
      await w.read();
      for (const p of pieces) {
        const share = (p.body.position[0] - 0.6) / ((p.v * p.v) / (2 * 0.4 * 9.81));
        worst = [Math.min(worst[0], share), Math.max(worst[1], share)];
      }
      w.destroy();
    }
    const ok = worst[0] >= 0.85 && worst[1] <= 1.15 && hop < 1;
    return { ok, detail: `went ${worst[0].toFixed(2)}-${worst[1].toFixed(2)} of v²/(2μg) (0.85-1.15), fastest up ${hop.toFixed(2)} m/s (under 1)` };
  },

  // At rest: a column of ten 0.3 m bricks (each contact rests the margin, 1 cm, in: its top at 2.9
  // m), a 4 t slab on four 2 g cubes, and a 0.3 m box of density 1 under one of 2500. The column and
  // the slab stand; the light box, under 2500 times its weight (more than its contacts may push:
  // maxSpeed), is pressed into the ground, not through it
  stack: async (World, device) => {
    const w = await World.create({ device, maxBodies: 64 });
    w.maxSpeed = 40;
    w.addBox({ size: [100, 1, 100], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) w.addBox({ size: [0.05, 0.05, 0.05], position: [x, 0.025, z], density: 16, friction: 0.8 });
    const slab = w.addBox({ size: [2, 0.4, 2], position: [0, 0.25, 0], density: 2500, friction: 0.8 });
    const column = [];
    for (let k = 0; k < 10; k++) column.push(w.addBox({ size: [0.3, 0.3, 0.3], position: [5, 0.15 + k * 0.3, 0], density: 1800, friction: 0.8 }));
    const light = w.addBox({ size: [0.3, 0.3, 0.3], position: [8, 0.15, 0], density: 1, friction: 0.8 });
    const heavy = w.addBox({ size: [0.3, 0.3, 0.3], position: [8, 0.45, 0], density: 2500, friction: 0.8 });
    let still = 0;
    for (let s = 1; s <= 240; s++) {
      w.step();
      if (s > 120 && s % 4 === 0) { await w.read(); for (const b of [slab, ...column]) still = Math.max(still, Math.hypot(...b.velocity)); }
    }
    await w.read();
    const top = column[9].position[1] + 0.15;
    const slabBottom = slab.position[1] - 0.2;
    const lightBottom = light.position[1] - 0.15;
    w.destroy();
    const ok = Math.abs(top - 2.9) < 0.03 && slabBottom > -0.03 && still < 0.05 && lightBottom > -0.4;
    return { ok, detail: `column top ${top.toFixed(3)} m (2.9 within 3 cm), slab bottom ${slabBottom.toFixed(3)} (over -0.03), fastest at rest ${still.toFixed(3)} m/s (under 0.05); light box under heavy: bottom ${lightBottom.toFixed(3)} (pressed in, over -0.4)` };
  },

  // Light pieces pinched: slivers on edge under a 4 t slab dropped from 1 m, chips in a V between two
  // fixed blocks with a 1 t block dropped in, panes between two 2.5 t boxes driven together, a pile
  // of chips under a slab. None is shot out: its speed never rises by 8 m/s between readbacks
  pinch: async (World, device) => {
    const hash = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const turn = (ax, a) => [ax[0] * Math.sin(a / 2), ax[1] * Math.sin(a / 2), ax[2] * Math.sin(a / 2), Math.cos(a / 2)];
    const w = await World.create({ device, maxBodies: 512 });
    w.maxSpeed = 40;
    w.addBox({ size: [200, 1, 200], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
    const light = [];
    for (let k = 0; k < 9; k++) light.push(w.addBox({ size: [0.3, 0.05, 0.01], position: [(k % 3) * 0.6 - 0.6, 0.025, Math.floor(k / 3) * 0.6 - 0.6], rotation: turn([1, 0, 0], Math.PI / 2 + 0.1 * hash(k)), density: 2.5, friction: 0.6 }));
    w.addBox({ size: [2, 0.4, 2], position: [0, 1.25, 0], density: 2.5, friction: 0.8 });
    w.addBox({ size: [1, 1, 2], position: [9.45, 0.6, 0], rotation: turn([0, 0, 1], -Math.PI / 6), fixed: true, friction: 0.8 });
    w.addBox({ size: [1, 1, 2], position: [10.55, 0.6, 0], rotation: turn([0, 0, 1], Math.PI / 6), fixed: true, friction: 0.8 });
    for (let k = 0; k < 6; k++) light.push(w.addBox({ size: [0.04, 0.04, 0.04], position: [10 + (hash(k + 3) - 0.5) * 0.1, 0.6 + k * 0.05, (k - 2.5) * 0.25], density: 2.5, friction: 0.6 }));
    w.addBox({ size: [0.6, 0.6, 1.6], position: [10, 2.5, 0], density: 2.5, friction: 0.8 });
    for (const z of [-0.3, 0.3]) light.push(w.addBox({ size: [0.01, 0.4, 0.2], position: [20, 0.5, z], density: 2.5, friction: 0.6 }));
    w.addBox({ size: [1, 1, 1], position: [19.45, 0.5, 0], density: 2.5, friction: 0.8, velocity: [6, 0, 0] });
    w.addBox({ size: [1, 1, 1], position: [20.55, 0.5, 0], density: 2.5, friction: 0.8, velocity: [-6, 0, 0] });
    for (let k = 0; k < 30; k++) light.push(w.addBox({ size: [0.06, 0.03, 0.05], position: [30 + (hash(k + 10) - 0.5) * 1.5, 0.02 + 0.04 * Math.floor(k / 10), (hash(k + 20) - 0.5) * 1.5], rotation: turn([0, 1, 0], hash(k) * 6), density: 2.5, friction: 0.6 }));
    w.addBox({ size: [2, 0.5, 2], position: [30, 1.5, 0], density: 2.5, friction: 0.8 });
    const last = light.map(() => 0);
    let rise = 0;
    for (let s = 1; s <= 300; s++) {
      w.step(s % 2 ? {} : { reuseManifolds: true });
      if (s % 2 === 0) {
        await w.read();
        light.forEach((b, k) => {
          const v = Math.hypot(...b.velocity);
          rise = Math.max(rise, v - last[k]);
          last[k] = v;
        });
      }
    }
    await w.read();
    const strayed = light.filter((b) => !(Math.hypot(b.position[0], b.position[2]) < 60 && b.position[1] > -0.5)).length;
    w.destroy();
    return { ok: rise < 8 && strayed === 0, detail: `most speed gained between readbacks ${rise.toFixed(1)} m/s (under 8), ${strayed} strayed far or under the ground (0)` };
  },

  // A sixteen-sided drum (0.6 m across) set rolling at 2 m/s, with rolling resistance 0 and 0.02; a
  // cube spinning in the air spins as without it (nothing pushes on it)
  roll: async (World, device) => {
    const prism = (n, r, L) => { const p = []; for (let k = 0; k < n; k++) { const a = (2 * Math.PI * (k + 0.5)) / n; for (const x of [-L / 2, L / 2]) p.push(x, r * Math.cos(a), r * Math.sin(a)); } return p; };
    const went = {};
    const spin = {};
    for (const rolling of [0, 0.02]) {
      const w = await World.create({ device, maxBodies: 16 });
      w.maxSpeed = 40;
      w.addBox({ size: [800, 1, 800], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
      const drum = w.addHull({ points: prism(16, 0.3 / Math.cos(Math.PI / 16), 0.9), position: [0, 0.3, 0], density: 0.3, friction: 0.8, rolling, velocity: [0, 0, 2], angularVelocity: [2 / 0.3, 0, 0] });
      const cube = w.addBox({ size: [0.3, 0.3, 0.3], position: [50, 200, 0], density: 1.8, rolling, angularVelocity: [5, 0, 0] });
      for (let s = 1; s <= 480; s++) {
        w.step();
        if (s === 60) { await w.read(); spin[rolling] = Math.hypot(...cube.angularVelocity); }
      }
      await w.read();
      went[rolling] = Math.hypot(drum.position[0], drum.position[2]);
      w.destroy();
    }
    const ok = went[0.02] < 4.5 && went[0] > went[0.02] + 0.3 && Math.abs(spin[0.02] / spin[0] - 1) < 0.005;
    return { ok, detail: `drum rolled ${went[0].toFixed(2)} m free, ${went[0.02].toFixed(2)} m at 0.02 (under 4.5, and shorter); spin in the air after 1 s ${spin[0.02].toFixed(3)} rad/s at 0.02, ${spin[0].toFixed(3)} free (the same)` };
  },

  // A 1 kg box falling 1.25 m onto the ground: one contact begin, its impulse about m·v (4.95 N·s)
  landing: async (World, device) => {
    const w = await World.create({ device, maxBodies: 8 });
    w.addBox({ size: [20, 1, 20], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
    w.addBox({ size: [1, 1, 1], position: [0, 1.75, 0], reportContacts: true });
    const events = [];
    w.onContact((e) => events.push(e));
    for (let s = 1; s <= 90; s++) {
      w.step();
      if (s % 10 === 0) await w.read();
    }
    await w.read();
    w.destroy();
    const begins = events.filter((e) => e.type === 'begin');
    const ok = begins.length === 1 && Math.abs(begins[0].impulse / 4.95 - 1) < 0.15;
    return { ok, detail: `${begins.length} begin (1), impulse ${begins.map((e) => e.impulse.toFixed(2)).join(', ')} N·s (4.95 within 15%)` };
  },
};

const display = process.env.SHOT_DISPLAY ?? ':99';
if (!existsSync(`/tmp/.X11-unix/X${display.slice(1)}`)) {
  spawn('Xvfb', [display, '-screen', '0', '1920x1080x24', '-nolisten', 'tcp'], { detached: true, stdio: 'ignore' }).unref();
  for (let k = 0; k < 50 && !existsSync(`/tmp/.X11-unix/X${display.slice(1)}`); k++) await new Promise((r) => setTimeout(r, 100));
}
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const only = opt('only', Object.keys(CASES).join(',')).split(',');
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: false,
  ignoreDefaultArgs: ['--ozone-platform=headless'],
  env: { ...process.env, DISPLAY: display },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan', '--ignore-gpu-blocklist', '--ozone-platform=x11', '--enable-dawn-features=skip_validation', '--window-position=0,0', '--window-size=640,450'],
  defaultViewport: { width: 640, height: 360 },
});
let failed = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(`http://127.0.0.1:${opt('port', '5330')}/?world=${opt('world', 'nyc')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.demo, { timeout: 180000, polling: 200 });
  // The demo's own world stops; the cases use its device
  await page.evaluate(() => window.demo.renderer.setAnimationLoop(null));
  for (const name of only) {
    const { ok, detail } = await page.evaluate(`(${CASES[name]})(demo.world.constructor, demo.world.device)`);
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`);
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
