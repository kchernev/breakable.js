// The painted signs, drawn on a canvas: weathered boards with a pictogram in the middle and rows of
// brush strokes either side that read as lettering from the street but aren't letters. One atlas
// for the signboards on the false fronts (a row per sign) and the hanging signs' boards.

import * as THREE from 'three/webgpu';
import type { Pose, Q, V3 } from '../../../lib/index.ts';
import { multiply, random, rotate, sub } from '../../../lib/index.ts';
import { type Frame, qy } from './frame.ts';

export type Picto = 'tankard' | 'razor' | 'coins' | 'bed' | 'goods' | 'star' | 'horseshoe' | 'anvil';

interface SignStyle {
  picto: Picto;
  board: string;
  paint: string;
  /** The board's length (m) on the atlas row (at most ATLAS.width). */
  length: number;
}

/**
 * The atlas: `rows` rows of signboards `height` m tall and `width` m long, `px` pixels across; over
 * them, the hanging signs' boards (`hang`: their size), two to a row, `tall` m in all.
 */
export const ATLAS = { width: 7.2, height: 0.9, rows: 8, px: 2048, hang: [1.0, 0.45], tall: 8 * 0.9 + 4 * 0.45 };

/** The rows, in order. */
export const SIGNS: SignStyle[] = [
  { picto: 'tankard', board: '#6e2e24', paint: '#efe2c4', length: 7.0 },
  { picto: 'razor', board: '#e9e1cf', paint: '#7a2a24', length: 4.6 },
  { picto: 'coins', board: '#2f4434', paint: '#d8b86a', length: 6.4 },
  { picto: 'bed', board: '#45586a', paint: '#ece2c8', length: 7.0 },
  { picto: 'goods', board: '#c9a24e', paint: '#3a2a1e', length: 7.0 },
  { picto: 'star', board: '#24221f', paint: '#d9b25e', length: 6.4 },
  { picto: 'horseshoe', board: '#8a7a64', paint: '#2a2420', length: 5.0 },
  { picto: 'anvil', board: '#4a4642', paint: '#e6dcc8', length: 4.4 },
];

/** The atlas row of a sign by its pictogram. */
export const signRow = (p: Picto): number => SIGNS.findIndex((s) => s.picto === p);

/** Draw one board into a rect of a canvas: weathered paint, a border, the pictogram, stroke rows. */
function board(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: SignStyle, seed: number): void {
  const rand = random(seed);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = s.board;
  g.fillRect(x, y, w, h);
  // Board seams and grain along the board
  const planks = Math.max(2, Math.round(h / 70));
  for (let i = 1; i < planks; i++) {
    g.fillStyle = 'rgba(20,12,6,0.45)';
    g.fillRect(x, y + (i * h) / planks - 1.5, w, 3);
  }
  for (let i = 0; i < h * 0.8; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '255,245,225' : '30,20,10'},${0.03 + rand() * 0.06})`;
    g.fillRect(x + rand() * w, y + rand() * h, 30 + rand() * w * 0.3, 1 + rand() * 1.5);
  }
  // Border
  const bw = Math.max(4, h * 0.035);
  g.strokeStyle = s.paint;
  g.lineWidth = bw;
  g.strokeRect(x + bw * 1.6, y + bw * 1.6, w - bw * 3.2, h - bw * 3.2);
  // Pictogram in the middle
  g.fillStyle = s.paint;
  g.strokeStyle = s.paint;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = h * 0.34;
  picto(g, s.picto, cx, cy, r);
  // Rows of brush marks either side, grouped like words: blobs, stems with a ball, waves, crescents,
  // dot pairs. From the street they read as lettering; none of them is a letter
  const strokes = (x0: number, x1: number, yc: number, size: number) => {
    let px = x0;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.22;
    let word = 2 + Math.floor(rand() * 4);
    while (px < x1 - size * 0.7) {
      const k = Math.floor(rand() * 5);
      const w = size * (0.45 + rand() * 0.25);
      g.beginPath();
      if (k === 0) {
        // A lozenge
        g.moveTo(px + w / 2, yc - size / 2);
        g.lineTo(px + w, yc);
        g.lineTo(px + w / 2, yc + size / 2);
        g.lineTo(px, yc);
        g.closePath();
        g.fill();
      } else if (k === 1) {
        // A stem with a ball on top
        g.moveTo(px + w / 2, yc + size / 2);
        g.lineTo(px + w / 2, yc - size * 0.1);
        g.stroke();
        g.beginPath();
        g.arc(px + w / 2, yc - size * 0.3, size * 0.2, 0, Math.PI * 2);
        g.fill();
      } else if (k === 2) {
        // A wave
        g.moveTo(px, yc);
        g.bezierCurveTo(px + w * 0.3, yc - size * 0.6, px + w * 0.6, yc + size * 0.6, px + w, yc);
        g.stroke();
      } else if (k === 3) {
        // A crescent, open upward
        g.arc(px + w / 2, yc - size * 0.05, w / 2, Math.PI * 0.1, Math.PI * 0.9);
        g.stroke();
      } else {
        // Two dots stacked
        g.arc(px + w / 2, yc - size * 0.25, size * 0.16, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(px + w / 2, yc + size * 0.25, size * 0.16, 0, Math.PI * 2);
        g.fill();
      }
      px += w + size * 0.18;
      if (--word === 0) {
        px += size * 0.5;
        word = 2 + Math.floor(rand() * 4);
      }
    }
  };
  const gap = r * 1.5;
  const big = h * 0.3;
  const small = h * 0.14;
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [x + bw * 4, cx - gap] : [cx + gap, x + w - bw * 4];
    if (b - a < big) continue;
    strokes(a, b, cy - h * 0.1, big);
    strokes(a + (b - a) * 0.15, b - (b - a) * 0.15, cy + h * 0.25, small);
  }
  // Weathering: paint flaked to bare grey wood, and fine speckle
  for (let i = 0; i < (w * h) / 900; i++) {
    const fx = x + rand() * w;
    const fy = y + rand() * h;
    g.fillStyle = `rgba(${150 + rand() * 40},${140 + rand() * 35},${125 + rand() * 30},${0.5 + rand() * 0.4})`;
    g.beginPath();
    g.ellipse(fx, fy, 2 + rand() * 9, 1 + rand() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  const img = g.getImageData(x, y, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, x, y);
  // Sun-bleached toward the top
  const fade = g.createLinearGradient(0, y, 0, y + h);
  fade.addColorStop(0, 'rgba(240,230,210,0.22)');
  fade.addColorStop(1, 'rgba(240,230,210,0.0)');
  g.fillStyle = fade;
  g.fillRect(x, y, w, h);
  g.restore();
}

/** A simple pictogram centred at (cx, cy), about 2r across. */
function picto(g: CanvasRenderingContext2D, p: Picto, cx: number, cy: number, r: number): void {
  g.lineWidth = r * 0.14;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  switch (p) {
    case 'tankard': {
      g.fillRect(cx - r * 0.55, cy - r * 0.6, r * 0.9, r * 1.5);
      g.beginPath();
      g.arc(cx + r * 0.38, cy + r * 0.1, r * 0.38, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      // Froth
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(cx - r * 0.45 + i * r * 0.25, cy - r * 0.62, r * 0.18, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'razor': {
      g.save();
      g.translate(cx - r * 0.3, cy);
      g.rotate(-0.6);
      g.fillRect(-r * 0.12, -r * 0.9, r * 0.24, r * 0.9);
      g.beginPath();
      g.moveTo(-r * 0.12, 0);
      g.lineTo(r * 0.32, 0);
      g.lineTo(r * 0.22, r * 0.85);
      g.lineTo(-r * 0.12, r * 0.85);
      g.fill();
      g.restore();
      // Comb
      g.save();
      g.translate(cx + r * 0.45, cy);
      g.rotate(0.5);
      g.fillRect(-r * 0.5, -r * 0.15, r, r * 0.18);
      for (let i = 0; i < 8; i++) g.fillRect(-r * 0.48 + i * r * 0.13, r * 0.03, r * 0.05, r * 0.32);
      g.restore();
      break;
    }
    case 'coins': {
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse(cx - r * 0.25, cy + r * 0.6 - i * r * 0.32, r * 0.55, r * 0.17, 0, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.ellipse(cx + r * 0.6, cy + r * 0.6 - i * r * 0.32, r * 0.45, r * 0.14, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'bed': {
      g.fillRect(cx - r, cy - r * 0.1, r * 2, r * 0.35);
      g.fillRect(cx - r, cy - r * 0.7, r * 0.15, r * 1.4);
      g.fillRect(cx + r * 0.85, cy - r * 0.35, r * 0.15, r * 1.05);
      g.beginPath();
      g.ellipse(cx - r * 0.55, cy - r * 0.3, r * 0.3, r * 0.17, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'goods': {
      // A sack and a barrel
      g.beginPath();
      g.moveTo(cx - r * 0.95, cy + r * 0.8);
      g.quadraticCurveTo(cx - r * 1.1, cy - r * 0.2, cx - r * 0.6, cy - r * 0.55);
      g.lineTo(cx - r * 0.25, cy - r * 0.55);
      g.quadraticCurveTo(cx + r * 0.1, cy - r * 0.2, cx - r * 0.05, cy + r * 0.8);
      g.fill();
      g.beginPath();
      g.ellipse(cx + r * 0.55, cy + r * 0.1, r * 0.45, r * 0.75, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'star': {
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.5 : r;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      break;
    }
    case 'horseshoe': {
      g.lineWidth = r * 0.32;
      g.beginPath();
      g.arc(cx, cy - r * 0.05, r * 0.65, Math.PI * 0.8, Math.PI * 2.2);
      g.stroke();
      break;
    }
    case 'anvil': {
      g.beginPath();
      g.moveTo(cx - r, cy - r * 0.4);
      g.lineTo(cx + r * 0.7, cy - r * 0.4);
      g.lineTo(cx + r * 0.7, cy - r * 0.05);
      g.lineTo(cx + r * 0.3, cy + r * 0.1);
      g.lineTo(cx + r * 0.35, cy + r * 0.45);
      g.lineTo(cx + r * 0.6, cy + r * 0.7);
      g.lineTo(cx - r * 0.6, cy + r * 0.7);
      g.lineTo(cx - r * 0.35, cy + r * 0.45);
      g.lineTo(cx - r * 0.3, cy + r * 0.1);
      g.quadraticCurveTo(cx - r * 0.8, cy, cx - r, cy - r * 0.4);
      g.fill();
      break;
    }
  }
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * The atlas: each sign's board on its row, drawn at its own length from the row's start, and its
 * hanging board over them, where both of that board's faces read (hangFrame).
 */
export function signAtlas(): THREE.CanvasTexture {
  const perM = ATLAS.px / ATLAS.width;
  const c = document.createElement('canvas');
  c.width = ATLAS.px;
  c.height = Math.round(ATLAS.tall * perM);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  // Off the boards: plain weathered paint (the boards' ends and edges show it)
  g.fillStyle = '#b8ab94';
  g.fillRect(0, 0, c.width, c.height);
  const rowPx = Math.round(ATLAS.height * perM);
  const [w, h] = ATLAS.hang.map((m) => Math.round(m * perM));
  SIGNS.forEach((s, r) => {
    // Row r is v from r rows up (the canvas is flipped: row 0 at the bottom)
    board(g, 0, c.height - (r + 1) * rowPx, Math.round(s.length * perM), rowPx, s, 101 + r);
    // The hanging board: on the middle, or across the wrap (drawn at both ends)
    const y = c.height - ATLAS.rows * rowPx - (Math.floor(r / 2) + 1) * h;
    for (const x of r % 2 ? [-w / 2, c.width - w / 2] : [c.width / 2 - w / 2]) board(g, Math.round(x), y, w, h, s, 7 + r);
  });
  return canvasTexture(c);
}

/**
 * The texture frame of a hanging board (its middle at `position`, turned by `rotation`: its length
 * along its z, its faces toward its ±x) that shows its board from the atlas on both faces. A box's
 * two faces see the map mirrored about the frame's origin along u, so the boards are drawn where
 * that leaves them in place: centred on u = 0 (across the wrap) or on the middle.
 */
export function hangFrame(p: Picto, position: V3, rotation: Q): Pose {
  const r = signRow(p);
  const u = r % 2 ? 0 : ATLAS.width / 2;
  const v = ATLAS.rows * ATLAS.height + (Math.floor(r / 2) + 0.5) * ATLAS.hang[1];
  // The frame's x along the board, so its faces are the frame's ±z
  const turn = multiply(rotation, qy(-Math.PI / 2));
  return { position: sub(position, rotate(turn, [u, v, 0])), rotation: turn };
}

/**
 * The texture frame that lands a signboard's street face on its atlas row: its left end as seen
 * from the street (the higher x of the frame) at `x1`, its foot at `y`, its face at `z` (facing -z).
 */
export function signFrame(f: Frame, p: Picto, x1: number, y: number, z: number): Pose {
  const at: V3 = f.at(x1, y - signRow(p) * ATLAS.height, z);
  // Turned half round, so the face toward -z is the texture frame's +z: read left to right
  return { position: at, rotation: multiply(f.q, qy(Math.PI)) };
}
