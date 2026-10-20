// Where everything is: the plateau and the land round it (one height function, used by the
// terrain mesh, groundAt and the props), the sea, the places of the buildings, and the breakable
// ground's areas. x is east, z is south, y up; the breakable area is flat at y = 0 over x -32..35,
// z -28..26.

/** The sea's surface (what goes over the cliff is taken out under it: index.ts killBelow). */
export const SEA = -62;

/**
 * Where the cliff tops are (the land ends past them): the west coast and the north coast, bending
 * away as they go, in coves and headlands of a few tens of metres (never into the sanctuary).
 */
export const westEdge = (z: number) => -37 - 13 * wave(z * 0.05 + 1.3) - 8 * wave(z * 0.13 + 0.4) - 3 * wave(z * 0.31 + 2.9) - 0.55 * Math.max(0, z - 30);
export const northEdge = (x: number) => -33 - 13 * wave(x * 0.05 + 4.1) - 8 * wave(x * 0.14 + 2.2) - 3 * wave(x * 0.29 + 0.7) - 0.5 * Math.max(0, x - 45);

/** A smooth wave in [0, 1] (a cheap stand-in for 1D noise). */
function wave(t: number): number {
  return 0.5 + 0.25 * Math.sin(t) + 0.15 * Math.sin(t * 2.3 + 1.7) + 0.1 * Math.sin(t * 5.1 + 0.4);
}

/** 2D value noise in [0, 1], smooth. */
export function noise2(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * u;
  const b = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * u;
  return a + (b - a) * v;
}

const fbm = (x: number, z: number, octaves: number) => {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The land without its cliffs: flat on the plateau, falling east and south, then rising into dry
 * hills at 300..1000 m and mountains past them, 1.2..1.7 km out in the haze. Both come down toward
 * the coasts, so the land meets the sea in cliffs of some 40 m, not in walls of hundreds.
 */
function land(x: number, z: number): number {
  const out = Math.hypot(Math.max(0, x - 40), Math.max(0, z - 30));
  if (out <= 0) return 0;
  const inland = Math.min(x - westEdge(z), z - northEdge(x));
  const fall = -22 * smooth(0, 170, out);
  const hills = smooth(230, 520, out) * smooth(30, 350, inland) * (60 + 110 * fbm(x * 0.004 + 3, z * 0.004, 3));
  const mountains = smooth(950, 1450, out) * smooth(150, 700, inland) * (150 + 260 * fbm(x * 0.0017 + 7, z * 0.0017 + 2, 4));
  const roll = smooth(20, 120, out) * (fbm(x * 0.02, z * 0.02, 4) - 0.5) * 10;
  return fall + hills + mountains + roll;
}

/** The terrain's height: the land, cut off by the cliffs into the sea. */
export function terrain(x: number, z: number): number {
  const base = land(x, z);
  // How far past the cliff top (m), and where along the coast (for the cliff's character)
  const west = westEdge(z) - x;
  const north = northEdge(x) - z;
  // The two coasts meet in a rounded point, not a corner (a smooth maximum)
  const k = 10;
  const h = Math.max(k - Math.abs(west - north), 0) / k;
  const past = Math.max(west, north) + (h * h * k) / 4;
  if (past <= -3) return base;
  // A lip that rounds over just before the edge
  if (past < 0) return base - 0.5 * smooth(-3, 0, past);
  const along = west > north ? z : x + 200;
  // The drop: steeper or more broken along the coast, with a ledge part way down
  const width = 12 + 14 * noise2(along * 0.03, 1.3);
  // Where the ledge is wanders along the coast, so its line breaks up
  const ledge = 0.3 + 0.35 * noise2(along * 0.05, 7.1) + 0.12 * (noise2(along * 0.22, 3.3) - 0.5);
  const top = base - 0.5;
  const drop = top + (SEA - 16 - top) * cliffProfile(past / width, ledge);
  // Buttresses and gullies, and rough rock on the face (none at the lip, less at the foot)
  const face = Math.min(1, past / 2.5) * (1 - smooth(width * 0.8, width * 1.4, past));
  const relief = (fbm(x * 0.09, z * 0.09, 3) - 0.5) * 14 + (fbm(x * 0.4, z * 0.4, 3) - 0.5) * 3.5;
  return Math.max(SEA - 18, drop + relief * face);
}

/** 0 at the top of the cliff to 1 at its foot: steep faces between ledges (the rock's beds). */
function cliffProfile(u: number, ledge: number): number {
  if (u >= 1) return 1;
  const t = Math.max(0, u);
  // Three drops, the first and the last sheer, a ledge between each
  const beds = [
    [0, ledge * 0.6, 0.38],
    [ledge * 0.6 + 0.08, ledge + 0.12, 0.3],
    [ledge + 0.2, 0.95, 0.32],
  ];
  let f = 0;
  for (const [a, b, share] of beds) f += share * smooth(a, b, t);
  return Math.min(1, f);
}

/** Breakable structures' places (centres), shared by the builders, the props and the reactions. */
export const PLACES = {
  temple: { x: -4, z: -4 },
  treasury: { x: 2, z: -21 },
  tholos: { x: -21, z: 15 },
  statue: { x: 13, z: 9 },
  altar: { x: 15.5, z: -4 },
  votive: { x: 21, z: -12 },
  propylon: { x: 34, z: 4 },
};

/** An area of the breakable ground seen from above: [x0, z0, x1, z1]. */
export type Area = [number, number, number, number];

/**
 * The breakable ground (ground.ts): the court before the temple, marble flags over a bed of rubble,
 * from the temple's steps (round the ramp) to the gate; and the hilltop where the player walks, its
 * dry earth over the rock, between the temple, the treasury, the stoa and the temenos wall. A strip
 * of the land's own is left at the foot of the steps and the wall, where the tufts grow; what
 * mustn't go (the platforms, the tholos, the propylon, the wall) stands on the plateau itself.
 * Every area's layers rest on the bed, 1 m down.
 */
export const COURT: Area[] = [
  [12, -11.2, 31.4, 5.1],
  [8.7, -11.2, 12, -5.6],
  [8.7, -2.4, 12, 5.1],
];
export const FIELDS: Area[] = [
  [-14, 3.8, 8.7, 23.1],
  [8.7, 5.1, 31.4, 23.1],
  [-16, -16.5, 8.7, -11.8],
  [8.7, -19.6, 33.1, -11.2],
];
export const AREAS = [...COURT, ...FIELDS];
/** The layers' depths (the flags over the rubble, the earth over the rock) and the bed under them all. */
export const LAYERS = { flags: 0.3, earth: 0.45, bed: -1 };

/** Whether (x, z) is in one of the areas, or within `margin` of it. */
export const within = (areas: Area[], x: number, z: number, margin = 0) => areas.some(([x0, z0, x1, z1]) => x >= x0 - margin && x <= x1 + margin && z >= z0 - margin && z <= z1 + margin);
