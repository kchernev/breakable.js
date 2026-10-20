import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// three-avbd is vendored at a pinned commit (vendor/three-avbd/VENDORED_COMMIT) and compiled from
// source: the npm release (0.3.0) predates the two-level broadphase grid and the fixed-body probe
// skipping that a mostly-static, partly-broken building leans on.
const avbd = (p: string) => fileURLToPath(new URL(`./vendor/three-avbd/src/lib/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // three's addons (the GLTF loader) import 'three': give them the WebGPU build, one copy of three
      { find: /^three$/, replacement: 'three/webgpu' },
      { find: /^three-avbd\/advanced$/, replacement: avbd('advanced.ts') },
      { find: /^three-avbd$/, replacement: avbd('index.ts') },
    ],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: { input: { main: 'index.html', lab: 'lab.html', fx: 'fx-lab.html', sounds: 'sounds.html' } },
  },
  // NO_HMR=1: a server for scripted screenshots, whose pages never reload under them
  server: { fs: { allow: ['.'] }, hmr: process.env.NO_HMR ? false : undefined },
});
