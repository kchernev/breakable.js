#!/usr/bin/env python3
# Builds the plastic market crates as raw models (assets-src/packs/neon/props/raw/<name>/model.glb)
# for process-props.py, with no paid call: image-to-3D gave crates whose unseen sides had the wrong
# colour and no slots, and whose thin walls crumpled when decimated. Crates are simple boxes, so
# here each is a profile (foot, body, lip) swept around a chamfered rectangle, with the slots,
# ribs, hand-holes, scuffs and grime in the textures (an atlas: one row of tiles per colour).
#
#   python3 -I scripts/assets/packs/neon/crates.py
#
#   crates: two stacks of three, end to end, one blue and one red, set down a little unevenly
#   crate:  one open red crate on its own
#
# Units are metres in the glTF frame (y up); the crate's long side runs along x.

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/PIL/scipy live in the user site, which -I leaves out

import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[4]
RAW = ROOT / 'assets-src/packs/neon/props/raw'

# One crate (outside of the body; the lip stands out, the foot is set in so crates nest)
L, W, H = 0.60, 0.40, 0.31
CHAMFER = 0.022
LIP, LIP_OUT = 0.026, 0.006   # lip height and how far it stands out
FOOT, FOOT_IN = 0.014, 0.012  # foot height and how far it is set in
WALL = 0.02                   # wall at the lip, seen inside an open crate
FLOOR = 0.03                  # inside floor height

# The atlas: px per metre, the tiles of one colour row, and the colours (sRGB 0..1)
SIZE = 2048
PPM = 1600
SIDE_L = L - 2 * CHAMFER   # flat length of a long side
SIDE_S = W - 2 * CHAMFER   # flat length of a short side
ROW_H = round(H * PPM)
COLOURS = {'blue': (0.11, 0.33, 0.74), 'red': (0.76, 0.14, 0.12)}
ROWS = {'blue': 0, 'red': 1}


def tiles(row):
  """Pixel rectangles (x0, y0, w, h) of one colour's tiles."""
  y = row * (ROW_H + 16)
  long_w, short_w = round(SIDE_L * PPM), round(SIDE_S * PPM)
  floor_y = 2 * (ROW_H + 16)
  return {
    'long': (0, y, long_w, ROW_H),
    'short': (long_w + 16, y, short_w, ROW_H),
    'plain': (long_w + short_w + 32, y, 64, 64),
    'floor': (row * (round(SIDE_L * PPM) + 32), floor_y, round(SIDE_L * PPM), round(SIDE_S * PPM)),
  }


# --- Textures ------------------------------------------------------------------------------------

def rounded_rect(h, w, cy, cx, hh, hw, r):
  """Mask of a rounded rectangle centred at (cy, cx) with half sizes (hh, hw), corner radius r (px)."""
  y, x = np.mgrid[0:h, 0:w]
  dy = np.maximum(np.abs(y - cy) - (hh - r), 0)
  dx = np.maximum(np.abs(x - cx) - (hw - r), 0)
  return np.clip(r + 0.5 - np.hypot(dx, dy), 0, 1)


def side_height(w, kind):
  """Height field (0 = wall, + raised, − holes) and hole mask of a side tile w px wide."""
  h = ROW_H
  m = lambda v: v * PPM  # metres to px
  height = np.zeros((h, w), np.float32)
  holes = np.zeros((h, w), np.float32)
  # The lip along the top and the foot along the bottom (z measured up from the crate's base)
  zpx = lambda z: h - m(z)
  y = np.arange(h)[:, None]
  height += 0.8 * ((y < zpx(H - LIP)) & (y >= 0))
  height -= 0.6 * ((y >= zpx(H - LIP) - 0) & (y < zpx(H - LIP) + 3))  # the groove under the lip
  height -= 0.3 * (y > zpx(FOOT))
  # Vertical ribs: panels between them
  panels = 3 if kind == 'long' else 2
  rib = m(0.014)
  edges = np.linspace(rib / 2, w - rib / 2, panels + 1)
  x = np.arange(w)[None, :]
  for e in edges:
    height += 0.6 * ((np.abs(x - e) < rib / 2) & (y > zpx(H - LIP)) & (y < zpx(FOOT)))
  # Slots: rows of vertical slots in each panel, and a hand-hole on the short ends
  rows = [0.075, 0.145, 0.215] if kind == 'long' else [0.07, 0.14]
  for i in range(panels):
    x0, x1 = edges[i] + rib, edges[i + 1] - rib
    n = max(2, int((x1 - x0) // m(0.026)))
    xs = np.linspace(x0, x1, n + 2)[1:-1]
    for zc in rows:
      for xc in xs:
        holes = np.maximum(holes, rounded_rect(h, w, zpx(zc), xc, m(0.019), m(0.0048), m(0.0046)))
  if kind == 'short':
    holes = np.maximum(holes, rounded_rect(h, w, zpx(0.235), w / 2, m(0.018), m(0.062), m(0.016)))
  height = height * (1 - holes) - 1.6 * holes
  return height, holes


def floor_height(w, h):
  m = lambda v: v * PPM
  holes = np.zeros((h, w), np.float32)
  for yc in np.linspace(m(0.04), h - m(0.04), 6):
    for xc in np.linspace(m(0.04), w - m(0.04), 14):
      holes = np.maximum(holes, rounded_rect(h, w, yc, xc, m(0.008), m(0.008), m(0.003)))
  return -1.6 * holes, holes


def scuffs(h, w, rng, n):
  """Short pale scuffs, mostly along the crate (from sliding it on and off stacks): a mask 0..1."""
  img = np.zeros((h, w), np.float32)
  for _ in range(n):
    y0, x0 = rng.uniform(0, h), rng.uniform(0, w)
    a = rng.normal(0, 0.35) + (math.pi / 2 if rng.random() < 0.15 else 0)
    length = rng.uniform(5, 28)
    t = np.linspace(0, 1, int(length) * 2)
    ys = np.clip((y0 + np.sin(a) * length * t).astype(int), 0, h - 1)
    xs = np.clip((x0 + np.cos(a) * length * t).astype(int), 0, w - 1)
    img[ys, xs] = rng.uniform(0.3, 1)
  return np.clip(ndimage.gaussian_filter(img, 0.8) * 2, 0, 1)


def paint(tile_h, holes, colour, rng, grime_down=True):
  """Colour and roughness of a tile from its height field and hole mask."""
  h, w = tile_h.shape
  base = np.array(colour, np.float32)
  grain = ndimage.gaussian_filter(rng.normal(0, 1, (h, w)).astype(np.float32), 1.2)
  blotch = ndimage.gaussian_filter(rng.normal(0, 1, (h, w)).astype(np.float32), 40)
  blotch /= np.abs(blotch).max() + 1e-6
  shade = 1 + 0.03 * grain + 0.07 * blotch
  # Raised lip and ribs a little lighter (worn by hands), the hollows beside them darker
  cavity = np.clip(ndimage.gaussian_filter(tile_h, 4) - tile_h, 0, 1)
  shade *= (1 + 0.05 * np.clip(tile_h, 0, 1)) * (1 - 0.35 * cavity)
  col = base[None, None, :] * shade[..., None]
  if grime_down:
    y = np.linspace(0, 1, h)[:, None]
    grime = np.clip((y - 0.55) / 0.45, 0, 1) ** 2 * (0.5 + 0.5 * ndimage.gaussian_filter(rng.random((h, w)).astype(np.float32), 6))
    col = col * (1 - 0.35 * grime[..., None]) + np.array([0.09, 0.08, 0.07]) * 0.35 * grime[..., None]
  sc = scuffs(h, w, rng, int(h * w / 9000))
  pale = np.clip(base * 0.55 + 0.35, 0, 1)
  col = col * (1 - 0.35 * sc[..., None]) + pale * 0.35 * sc[..., None]
  # Holes: the dark inside (and what little shows through)
  col = col * (1 - holes[..., None]) + base * 0.07 * holes[..., None]
  rough = 0.34 + 0.05 * grain + 0.2 * sc + 0.5 * holes
  return np.clip(col, 0, 1), np.clip(rough, 0, 1)


def normals(height, strength=2.5):
  """Tangent-space normal map (OpenGL convention, as glTF) from a height field in px."""
  hy, hx = np.gradient(ndimage.gaussian_filter(height, 0.8))
  n = np.stack([-hx * strength, hy * strength, np.ones_like(height)], -1)
  n /= np.linalg.norm(n, axis=-1, keepdims=True)
  return n * 0.5 + 0.5


def atlas(rng):
  colour = np.zeros((SIZE, SIZE, 3), np.float32)
  rough = np.full((SIZE, SIZE), 0.4, np.float32)
  normal = np.tile(np.array([0.5, 0.5, 1.0], np.float32), (SIZE, SIZE, 1))
  for name, row in ROWS.items():
    t = tiles(row)
    for kind in ('long', 'short', 'floor', 'plain'):
      x0, y0, w, h = t[kind]
      if kind in ('long', 'short'):
        height, holes = side_height(w, kind)
      elif kind == 'floor':
        height, holes = floor_height(w, h)
      else:
        height, holes = np.zeros((h, w), np.float32), np.zeros((h, w), np.float32)
      c, r = paint(height, holes, COLOURS[name], rng, grime_down=kind in ('long', 'short'))
      colour[y0:y0 + h, x0:x0 + w] = c
      rough[y0:y0 + h, x0:x0 + w] = r
      normal[y0:y0 + h, x0:x0 + w] = normals(height)
  mr = np.stack([np.zeros_like(rough), rough, np.zeros_like(rough)], -1)  # glTF: G roughness, B metalness
  return colour, mr, normal


# --- Geometry ------------------------------------------------------------------------------------

def outline(a, b, c):
  """The chamfered rectangle (half sizes a along x, b along z, chamfer c), counter-clockwise seen
  from above (+y; z points down the page), with the kind of the edge that starts at each point."""
  pts = [(a, b - c), (a, -b + c), (a - c, -b), (-a + c, -b), (-a, -b + c), (-a, b - c), (-a + c, b), (a - c, b)]
  kinds = ['short', 'plain', 'long', 'plain', 'short', 'plain', 'long', 'plain']
  return pts, kinds


class Mesh:
  def __init__(self):
    self.pos, self.nrm, self.uv, self.idx = [], [], [], []

  def quad(self, p, uv):
    """A flat quad p0..p3 (counter-clockwise seen from its front) with uvs."""
    p = [np.array(v, np.float64) for v in p]
    n = np.cross(p[1] - p[0], p[2] - p[0])
    if np.linalg.norm(n) < 1e-12:
      n = np.cross(p[2] - p[0], p[3] - p[0])
    n /= np.linalg.norm(n)
    k = len(self.pos)
    self.pos += p
    self.nrm += [n] * 4
    self.uv += uv
    self.idx += [k, k + 1, k + 2, k, k + 2, k + 3]

  def poly(self, p, uv):
    """A flat convex polygon as a fan."""
    for i in range(1, len(p) - 1):
      k = len(self.pos)
      n = np.cross(np.subtract(p[i], p[0]), np.subtract(p[i + 1], p[0]))
      n = n / np.linalg.norm(n)
      self.pos += [np.array(p[0]), np.array(p[i]), np.array(p[i + 1])]
      self.nrm += [n] * 3
      self.uv += [uv[0], uv[i], uv[i + 1]]
      self.idx += [k, k + 1, k + 2]


def px_uv(x, y):
  return (x / SIZE, y / SIZE)


def crate(mesh, colour, frame, open_top):
  """One crate standing at the origin of `frame` (a function local (x, y, z) -> world)."""
  t = tiles(ROWS[colour])
  a, b = L / 2, W / 2
  plain = t['plain']
  pu = lambda: px_uv(plain[0] + 32, plain[1] + 32)

  def ring(off):
    # A parallel offset of the outline: the 45° chamfer grows by (2 - √2) of the offset
    return outline(a + off, b + off, CHAMFER + off * (2 - math.sqrt(2)))

  def band(off, z0, z1, inward=False):
    """Vertical walls at outward offset `off` from z0 up to z1 (facing in when `inward`)."""
    pts, kinds = ring(off)
    for i in range(8):
      p0, p1 = pts[i], pts[(i + 1) % 8]
      q = [(p0[0], z0, p0[1]), (p1[0], z0, p1[1]), (p1[0], z1, p1[1]), (p0[0], z1, p0[1])]
      if kinds[i] == 'plain':
        uv = [pu()] * 4
      else:
        x0, y0, w, h = t[kinds[i]]
        v = lambda z: y0 + (H - z) * PPM
        uv = [px_uv(x0, v(z0)), px_uv(x0 + w, v(z0)), px_uv(x0 + w, v(z1)), px_uv(x0, v(z1))]
      if inward:
        q, uv = q[::-1], uv[::-1]
      mesh.quad([frame(*v) for v in q], uv)

  def step(off0, off1, z, up=True):
    """The horizontal ring at height z between offsets off0 and off1 (facing up or down)."""
    p0s, _ = ring(off0)
    p1s, _ = ring(off1)
    for i in range(8):
      j = (i + 1) % 8
      q = [(p0s[i][0], z, p0s[i][1]), (p0s[j][0], z, p0s[j][1]), (p1s[j][0], z, p1s[j][1]), (p1s[i][0], z, p1s[i][1])]
      # Facing up when the outer ring comes first going counter-clockwise, as seen from above
      n_up = (off0 > off1) == up
      mesh.quad([frame(*v) for v in (q if n_up else q[::-1])], [pu()] * 4)

  def cap(off, z, up):
    pts, _ = ring(off)
    p = [(x, z, zz) for x, zz in pts]
    if not up:
      p = p[::-1]
    mesh.poly([frame(*v) for v in p], [pu()] * len(p))

  cap(-FOOT_IN, 0.0, up=False)
  band(-FOOT_IN, 0.0, FOOT)
  step(-FOOT_IN, 0.0, FOOT, up=False)
  band(0.0, FOOT, H - LIP)
  step(0.0, LIP_OUT, H - LIP, up=False)
  band(LIP_OUT, H - LIP, H)
  if not open_top:
    cap(LIP_OUT, H, up=True)
    return
  step(LIP_OUT, -WALL, H, up=True)
  band(-WALL, FLOOR, H, inward=True)
  # The floor inside, with its own tile
  pts, _ = ring(-WALL)
  x0, y0, w, h = t['floor']
  p = [(x, FLOOR, z) for x, z in pts]
  uv = [px_uv(x0 + (x + a - WALL) / (2 * (a - WALL)) * w, y0 + (z + b - WALL) / (2 * (b - WALL)) * h) for x, _, z in p]
  mesh.poly([frame(*v) for v in p], uv)


def frame_at(dx, dy, dz, yaw_deg):
  c, s = math.cos(math.radians(yaw_deg)), math.sin(math.radians(yaw_deg))
  return lambda x, y, z: (dx + c * x + s * z, dy + y, dz - s * x + c * z)


# --- GLB -----------------------------------------------------------------------------------------

def png(a):
  buf = io.BytesIO()
  Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(buf, 'PNG')
  return buf.getvalue()


def write_glb(path, mesh, images):
  pos = np.array(mesh.pos, np.float32)
  nrm = np.array(mesh.nrm, np.float32)
  uv = np.array(mesh.uv, np.float32)
  idx = np.array(mesh.idx, np.uint32)
  blobs = [pos.tobytes(), nrm.tobytes(), uv.tobytes(), idx.tobytes()] + [png(i) for i in images]
  views, data = [], bytearray()
  for i, b in enumerate(blobs):
    data += b'\0' * (-len(data) % 4)
    v = {'buffer': 0, 'byteOffset': len(data), 'byteLength': len(b)}
    if i < 3:
      v['target'] = 34962
    elif i == 3:
      v['target'] = 34963
    views.append(v)
    data += b
  data += b'\0' * (-len(data) % 4)
  doc = {
    'asset': {'version': '2.0', 'generator': 'neon crates.py'},
    'scene': 0,
    'scenes': [{'nodes': [0]}],
    'nodes': [{'mesh': 0, 'name': path.parent.name}],
    'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
    'materials': [{
      'name': path.parent.name,
      'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 1}, 'metallicFactor': 1.0, 'roughnessFactor': 1.0},
      'normalTexture': {'index': 2},
    }],
    'textures': [{'source': i, 'sampler': 0} for i in range(3)],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
    'images': [{'bufferView': 4 + i, 'mimeType': 'image/png'} for i in range(3)],
    'accessors': [
      {'bufferView': 0, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3', 'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()},
      {'bufferView': 1, 'componentType': 5126, 'count': len(nrm), 'type': 'VEC3'},
      {'bufferView': 2, 'componentType': 5126, 'count': len(uv), 'type': 'VEC2'},
      {'bufferView': 3, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'},
    ],
    'bufferViews': views,
    'buffers': [{'byteLength': len(data)}],
  }
  js = json.dumps(doc, separators=(',', ':')).encode()
  js += b' ' * (-len(js) % 4)
  out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(data))
  out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(data), 0x004E4942) + bytes(data)
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(out)
  print(f'{path.relative_to(ROOT)}: {len(idx) // 3} triangles, {path.stat().st_size / 1e6:.2f} MB')


def main():
  rng = np.random.default_rng(7)
  images = atlas(rng)

  # Two stacks of three, end to end with a small gap, the red one set a little back and turned;
  # each crate sits a few mm off square on the one below, as stacked by hand.
  m = Mesh()
  gap = 0.02
  for colour, cx, cz, turn in (('blue', -(L / 2 + LIP_OUT + gap / 2), 0.0, 0.0), ('red', L / 2 + LIP_OUT + gap / 2, 0.035, -2.0)):
    for k in range(3):
      jitter = [(0, 0, 0), (0.004, -0.003, 0.8), (-0.005, 0.004, -1.4)][k]
      crate(m, colour, frame_at(cx + jitter[0], k * H, cz + jitter[1], turn + jitter[2]), open_top=k == 2)
  write_glb(RAW / 'crates/model.glb', m, images)

  m = Mesh()
  crate(m, 'red', frame_at(0, 0, 0, 0), open_top=True)
  write_glb(RAW / 'crate/model.glb', m, images)


main()
