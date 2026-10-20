// The 3D broadphase's classification of bodies by radius (GpuSolver3D.uploadStatics, and the CPU pair estimate):
// the few largest are tested against everything, the rest go in a grid of levels by size. It runs again whenever a body's
// radius changes (a game resizing a body to carry a falling section does, often), so it finds the median and the
// cut-off by selection rather than sorting: sorting a hundred thousand radii took 13-22 ms of the frame each time.

/**
 * Bodies with radius above LARGE_FACTOR × median radius are tested brute-force against every
 * body instead of sizing the grid cells, up to MAX_LARGE of the largest (each costs a test
 * per body). Showcase balls are ~3x the median brick; at the 2D factor of 4 they set 4 m
 * cells and the wall-smash broadphase took most of an 8 ms step.
 */
export const LARGE_FACTOR = 2;
export const MAX_LARGE = 64;

/**
 * The k-th smallest of `a` (0-based), reordering `a` in place: Wirth's selection, linear on average, and balanced
 * on runs of equal values (a city's voxels are all one radius).
 */
export function select(a: Float64Array, k: number): number {
  let lo = 0;
  let hi = a.length - 1;
  while (lo < hi) {
    const pivot = a[k];
    let i = lo;
    let j = hi;
    do {
      while (a[i] < pivot) i++;
      while (pivot < a[j]) j--;
      if (i <= j) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
        j--;
      }
    } while (i <= j);
    if (j < k) lo = i;
    if (k < i) hi = j;
  }
  return a[k];
}

/**
 * The largest radius still small (it sizes the grid cells): at most LARGE_FACTOR × the median, or past MAX_LARGE
 * larger bodies, the largest left. Reorders `radii`.
 */
export function largestSmall(radii: Float64Array): number {
  const n = radii.length;
  const median = n > 0 ? select(radii, n >> 1) : 1;
  let maxSmall = 0;
  for (let i = 0; i < n; i++) if (radii[i] <= LARGE_FACTOR * median) maxSmall = Math.max(maxSmall, radii[i]);
  // Beyond MAX_LARGE candidates, the rest stay small (and size the cells)
  if (n > MAX_LARGE) maxSmall = Math.max(maxSmall, select(radii, n - MAX_LARGE - 1));
  return maxSmall;
}

/** Most levels of the grid (each level's cells twice the size of the one below). */
export const MAX_LEVELS = 8;

/**
 * The grid's levels: cells from twice `typical` (a radius) doubling up to at least twice `largest`, at most
 * MAX_LEVELS of them (the finest cells grow to fit). Level 0's cell size comes back as an f32 (as the GPU holds
 * it), so gridLevel finds the level the shaders do.
 */
export function gridLevels(typical: number, largest: number): { cell: number; levels: number } {
  const top = Math.max(2 * largest * (1 + 1e-4), 1e-3);
  const base = Math.min(Math.max(2 * typical * (1 + 1e-4), 1e-3), top);
  const levels = Math.min(MAX_LEVELS, 1 + Math.max(0, Math.ceil(Math.log2(top / base) - 1e-9)));
  // Rounded up, so the top level's cells still hold the largest
  return { cell: Math.fround((top / 2 ** (levels - 1)) * (1 + 1e-6)), levels };
}

/** The level of a body of `radius` (the finest whose cells are at least twice it; the top past them all), as the GPU's levelOf. */
export function gridLevel(radius: number, cell: number, levels: number): number {
  const r = Math.fround(radius);
  let level = 0;
  while (level + 1 < levels && r > 0.5 * cell * 2 ** level) level++;
  return level;
}
