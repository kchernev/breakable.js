// The signs' script: a stroke font of made-up glyphs and simple pictograms (a noodle bowl, a fish,
// a cup, a moon and star, a key, an arrow in a circle). Each glyph is a dense block of straight
// strokes put together from two parts, a narrow one beside a wide one or one over another, as a
// radical and a component are, so a row reads as East Asian script without being any real one: no
// lone verticals, rings, arcs or dots that read as letters or digits. The same strokes make the
// neon tubes and the glyph atlas the lightboxes show.

import * as THREE from 'three/webgpu';

/** A stroke from (x0, y0) to (x1, y1), in glyph units: the glyph is 4 × 4, y up. */
export type Stroke = [number, number, number, number];

/** Chords of an arc about (cx, cy) from angle a0 to a1 (radians), in n pieces. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Stroke[] {
  const out: Stroke[] = [];
  for (let i = 0; i < n; i++) {
    const [p, q] = [a0 + ((a1 - a0) * i) / n, a0 + ((a1 - a0) * (i + 1)) / n];
    out.push([cx + r * Math.cos(p), cy + r * Math.sin(p), cx + r * Math.cos(q), cy + r * Math.sin(q)]);
  }
  return out;
}

// Parts, all straight strokes at least 1.1 units long (a neon tube shorter than about 9 cm isn't
// made, and the smallest signs are 0.36 m: 1 unit is 9 cm there). Left parts take x 0.2 … 1.5,
// right parts x 1.9 … 3.9; top parts y 2.3 … 3.9, bottom parts y 0.1 … 1.9.
const LEFT: Stroke[][] = [
  // A post with a slant across its top and one off its foot
  [[0.9, 0.2, 0.9, 3.8], [0.2, 2.6, 1.5, 3.5], [0.9, 1.4, 0.2, 0.3]],
  // Three slants down the side
  [[0.3, 3.8, 1.3, 3.0], [0.2, 2.6, 1.2, 1.7], [0.2, 0.2, 1.4, 1.3]],
  // A post with a chevron off its left, a slant off its foot
  [[1.3, 0.2, 1.3, 3.8], [1.3, 3.6, 0.2, 2.7], [0.2, 2.7, 1.3, 1.8], [1.3, 1.2, 0.2, 0.3]],
  // A post with two hooks: one up off its foot, one down off its middle
  [[0.8, 3.8, 0.8, 0.3], [0.8, 0.3, 1.6, 1.2], [0.8, 2.6, 0.1, 1.7], [0.2, 3.3, 1.5, 3.3]],
  // A post crossed by two falling slants
  [[0.8, 0.2, 0.8, 3.8], [0.1, 3.4, 1.5, 2.5], [0.1, 1.9, 1.5, 1.0]],
];
// The right parts and the bottom ones carry shapes the real scripts don't have (an open frame
// crossed twice, a split triangle with a flag, a diamond on a stand, a pierced zigzag), so no
// pairing makes a real character (nor a Latin letter: no closed box, no plain triangle)
const RIGHT: Stroke[][] = [
  // A frame open on its left, crossed by a slash and a counter-slash that runs out of it
  [[2.0, 3.4, 3.8, 3.4], [3.8, 3.4, 3.8, 0.6], [3.8, 0.6, 2.0, 0.6], [2.3, 2.9, 3.5, 1.1], [1.9, 1.4, 3.3, 3.0]],
  // A triangle split by a mast that carries a flag
  [[2.0, 0.4, 2.9, 2.8], [2.9, 2.8, 3.8, 0.4], [3.8, 0.4, 2.0, 0.4], [2.9, 0.4, 2.9, 2.8], [2.9, 2.8, 2.9, 3.9], [2.9, 3.9, 3.9, 3.3]],
  // A diamond on a stand
  [[2.9, 3.8, 3.8, 2.6], [3.8, 2.6, 2.9, 1.4], [2.9, 1.4, 2.0, 2.6], [2.0, 2.6, 2.9, 3.8], [2.9, 1.4, 2.9, 0.2], [2.1, 0.6, 3.7, 0.6]],
  // A post with a pennant at its top and an arrowhead through its foot
  [[2.9, 3.9, 2.9, 0.2], [2.9, 3.9, 3.9, 3.3], [3.9, 3.3, 2.9, 2.7], [2.0, 1.6, 2.9, 0.6], [2.9, 0.6, 3.8, 1.6]],
  // A bar dropping at its end over a bar, a chevron under them
  [[2.0, 3.6, 3.8, 3.6], [3.8, 3.6, 3.8, 2.4], [1.9, 2.4, 3.9, 2.4], [2.1, 1.8, 2.9, 0.3], [2.9, 0.3, 3.7, 1.8]],
  // Two zigzags stacked, pierced by a post
  [[1.9, 3.6, 3.9, 3.6], [3.9, 3.6, 2.0, 2.0], [2.0, 2.0, 3.9, 2.0], [3.9, 2.0, 2.0, 0.3], [2.9, 3.9, 2.9, 0.2]],
];
const TOP: Stroke[][] = [
  // Two roofs, one under the other
  [[0.3, 2.4, 2.0, 3.9], [2.0, 3.9, 3.7, 2.4], [1.1, 2.3, 2.0, 3.1], [2.0, 3.1, 2.9, 2.3]],
  // A zigzag over a bar
  [[0.3, 3.0, 1.4, 3.8], [1.4, 3.8, 2.6, 3.0], [2.6, 3.0, 3.7, 3.8], [0.6, 2.4, 3.4, 2.4]],
  // A hooked bar over a slanting stroke
  [[0.4, 3.7, 3.4, 3.7], [3.4, 3.7, 2.6, 2.8], [0.6, 2.4, 2.4, 3.1], [2.4, 2.4, 3.8, 2.4]],
];
const BOTTOM: Stroke[][] = [
  // An open frame with a slant inside
  [[0.5, 1.9, 3.5, 1.9], [0.5, 1.9, 0.5, 0.2], [3.5, 1.9, 3.5, 0.2], [1.0, 1.4, 3.0, 0.4]],
  // A diamond beside a cross
  [[0.4, 1.0, 1.2, 1.9], [1.2, 1.9, 2.0, 1.0], [2.0, 1.0, 1.2, 0.1], [1.2, 0.1, 0.4, 1.0], [2.0, 1.0, 3.7, 1.0], [2.9, 1.9, 2.9, 0.1]],
  // Two posts on a base, a slant between them
  [[1.1, 1.9, 1.1, 0.3], [2.9, 1.9, 2.9, 0.3], [0.3, 0.3, 3.7, 0.3], [1.1, 1.6, 2.9, 0.8]],
];

/** Glyph number `i` (any integer): a left and right part, or a top and bottom one; neighbours differ. */
export function glyph(i: number): Stroke[] {
  const lr = LEFT.length * RIGHT.length;
  const n = lr + TOP.length * BOTTOM.length;
  // Spread consecutive numbers over the combinations
  const j = (((i * 37) % n) + n) % n;
  if (j < lr) return [...LEFT[j % LEFT.length], ...RIGHT[Math.floor(j / LEFT.length)]];
  const k = j - lr;
  return [...TOP[k % TOP.length], ...BOTTOM[Math.floor(k / TOP.length)]];
}

export type Pictogram = 'bowl' | 'fish' | 'cup' | 'moon' | 'key' | 'arrow';

/** A wisp of steam: two strokes, rising. */
const wisp = (x: number, y: number, h: number): Stroke[] => [
  [x, y, x + 0.45, y + h / 2],
  [x + 0.45, y + h / 2, x, y + h],
];

export const PICTOGRAMS: Record<Pictogram, Stroke[]> = {
  bowl: [...arc(2, 2.0, 1.7, Math.PI, 2 * Math.PI, 4), [0.3, 2.0, 3.7, 2.0], [1.2, 0.3, 2.8, 0.3], ...wisp(1.0, 2.3, 1.6), ...wisp(2.6, 2.3, 1.6)],
  fish: [[0.4, 2.0, 1.8, 3.0], [1.8, 3.0, 3.0, 2.0], [3.0, 2.0, 1.8, 1.0], [1.8, 1.0, 0.4, 2.0], [3.0, 2.0, 3.8, 3.0], [3.8, 3.0, 3.8, 1.0], [3.8, 1.0, 3.0, 2.0]],
  cup: [[0.6, 2.4, 0.9, 0.2], [0.9, 0.2, 2.7, 0.2], [2.7, 0.2, 3.0, 2.4], [0.4, 2.4, 3.2, 2.4], [2.9, 1.9, 3.9, 1.9], [3.9, 1.9, 3.9, 0.8], [3.9, 0.8, 2.8, 0.8], ...wisp(1.5, 2.6, 1.4)],
  moon: [...arc(1.7, 2.0, 1.6, Math.PI / 3, (5 * Math.PI) / 3, 6), ...arc(2.4, 2.0, 1.15, Math.PI / 2.4, 2 * Math.PI - Math.PI / 2.4, 4), [3.3, 2.4, 3.3, 3.8], [2.6, 3.1, 4.0, 3.1]],
  key: [...arc(1.1, 2.0, 1.0, 0, 2 * Math.PI, 6), [2.1, 2.0, 3.9, 2.0], [3.0, 2.0, 3.0, 0.9], [3.9, 2.0, 3.9, 0.9]],
  arrow: [...arc(2.0, 2.0, 1.8, 0, 2 * Math.PI, 8), [0.8, 2.0, 3.0, 2.0], [3.0, 2.0, 2.2, 2.8], [3.0, 2.0, 2.2, 1.2]],
};

/**
 * The atlas's cells (4 × 4, column-major in texture space, row 0 at the bottom): columns 0 and 1
 * are glyphs; column 2 is glyphs (rows 0, 1) and pictograms (rows 2, 3); column 3 is pictograms.
 * So a column from 0 or 1 reads as a vertical line of script, and a row as a shop name and a sign.
 */
const ATLAS: Array<Array<number | Pictogram>> = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 'cup', 'moon'],
  ['bowl', 'fish', 'key', 'arrow'],
];

let atlasTexture: THREE.CanvasTexture | null = null;

/** The glyph atlas: white rounded strokes with a soft halo on black, 1024², each cell 256 px. */
export function glyphAtlas(): THREE.CanvasTexture {
  if (atlasTexture) return atlasTexture;
  const size = 1024;
  const cell = size / 4;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.lineCap = g.lineJoin = 'round';
  // A glyph's 4 units fill 70 % of its cell
  const unit = (cell * 0.7) / 4;
  const draw = (strokes: Stroke[], col: number, row: number, width: number, style: string, blur: number) => {
    const ox = col * cell + cell * 0.15;
    // Canvas rows run down; texture row 0 is the bottom (flipY)
    const oy = size - row * cell - cell * 0.15;
    g.save();
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    for (const [x0, y0, x1, y1] of strokes) {
      g.moveTo(ox + x0 * unit, oy - y0 * unit);
      g.lineTo(ox + x1 * unit, oy - y1 * unit);
    }
    g.stroke();
    g.restore();
  };
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) {
      const k = ATLAS[col][row];
      const strokes = typeof k === 'number' ? glyph(k) : PICTOGRAMS[k];
      draw(strokes, col, row, 26, 'rgba(255,255,255,0.35)', 10);
      draw(strokes, col, row, 13, '#fff', 0);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  atlasTexture = t;
  return t;
}

/** The palette: cyan and teal 35 %, magenta and pink 30 %, amber and warm white 20 %, red 10 %, acid green and violet 5 %. */
const PALETTE: Array<[number, number]> = [
  [0x22e6ff, 0.2],
  [0x14ffc8, 0.15],
  [0xff2bd6, 0.18],
  [0xff3a7a, 0.12],
  [0xffa62b, 0.12],
  [0xfff1d6, 0.08],
  [0xff2a2a, 0.1],
  [0x7dff4a, 0.025],
  [0x8a5bff, 0.025],
];

/** A neon colour from the palette, other than `not`. */
export function neonColor(rand: () => number, not?: number): number {
  for (;;) {
    let r = rand();
    for (const [c, w] of PALETTE) {
      r -= w;
      if (r <= 0) {
        if (c !== not) return c;
        break;
      }
    }
  }
}
