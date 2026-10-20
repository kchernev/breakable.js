// Headless Chrome with WebGPU: open a page of the dev server, wait, screenshot, print the console.
// node scripts/shot.mjs <path> [--wait ms] [--out file.png] [--size 1280x720] [--eval js]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

// Chrome runs on a virtual X display (Xvfb), never the desktop's: a window there would take the
// focus from whatever you're working in. Started here if it isn't running (SHOT_DISPLAY: another).
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
const path = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? '/';
const wait = Number(opt('wait', 4000));
const out = opt('out', 'shot.png');
const [w, h] = opt('size', '1280x720').split('x').map(Number);
const evals = args.flatMap((a, i) => (a === '--eval' ? [args[i + 1]] : []));
const port = opt('port', '5330');

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  // Headless Chrome on Linux only gets SwiftShader for WebGPU; a headed window on X11 with Vulkan
  // gets the real GPU (on the virtual display above). skip_validation: Dawn's check of each indirect dispatch costs
  // ~0.5 ms on Linux/NVIDIA, and the solver makes ~90 of them a step.
  headless: false,
  ignoreDefaultArgs: ['--ozone-platform=headless'],
  env: { ...process.env, DISPLAY: display },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan', '--ignore-gpu-blocklist', '--ozone-platform=x11', '--enable-dawn-features=skip_validation', '--window-position=0,0', `--window-size=${w},${h + 90}`],
  defaultViewport: { width: w, height: h },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'load' });
const adapter = await page.evaluate(async () => {
  if (!navigator.gpu) return 'navigator.gpu missing';
  const a = await navigator.gpu.requestAdapter();
  return a ? `${a.info?.vendor} ${a.info?.architecture} ${a.info?.description}` : 'no adapter';
});
logs.unshift(`[adapter] ${adapter}`);
let elapsed = 0;
for (const js of evals) {
  const [ms, code] = js.includes('|') ? [Number(js.split('|')[0]), js.slice(js.indexOf('|') + 1)] : [0, js];
  if (ms) await new Promise((r) => setTimeout(r, ms));
  elapsed += ms;
  try {
    const r = await page.evaluate(code);
    if (r !== undefined) logs.push(`[eval] ${typeof r === 'string' ? r : JSON.stringify(r)}`);
  } catch (e) {
    logs.push(`[eval error] ${e.message}`);
  }
}
await new Promise((r) => setTimeout(r, Math.max(0, wait - elapsed)));
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
