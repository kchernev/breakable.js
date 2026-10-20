#!/usr/bin/env python3
# Second pass over Neon Alley's processed props (public/packs/neon/models, written by
# process-props.py), with no paid calls:
#
#   blank:    a prop's `blank` UV rectangles (props.mjs) are filled with their own light ground colour,
#             and their normal map flattened: made-up lettering on a plate, where process-props.py's
#             paintOut would take the dark parts around it for the paint.
#   spokes:   a prop's `spokes` wheels (props.mjs: centre, axis, radius, ...) get a dark disc with
#             steel spokes, hub and rim painted by each texel's 3D position: image-to-3D turns open
#             spoked wheels into solid pale discs with a few spokes drawn on.
#
#   python3 -I scripts/assets/packs/neon/props-post.py
#
# Run it after every process-props.py run (that rewrites the GLBs it starts from). A GLB it has
# already been over is marked (asset.extras.post) and left alone, so a second run doesn't encode
# its maps again. (The glow and the tintable paint are process-props.py's own now.)

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/PIL live in the user site, which -I leaves out

import io
import json
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
LIST = ROOT / 'scripts/assets/packs/neon/props.mjs'
OUT = ROOT / 'public/packs/neon/models'
STEEL = np.array([0.55, 0.56, 0.58], np.float32)
THROUGH = np.array([0.04, 0.04, 0.045], np.float32)


def load_list():
  js = 'import(process.argv[1]).then((m) => process.stdout.write(JSON.stringify(m.props)))'
  out = subprocess.run(['node', '-e', js, str(LIST)], check=True, capture_output=True, text=True)
  return json.loads(out.stdout)


# --- GLB in and out ------------------------------------------------------------------------------

def read_glb(path):
  data = path.read_bytes()
  (n,) = struct.unpack_from('<I', data, 12)
  doc = json.loads(data[20:20 + n])
  (m,) = struct.unpack_from('<I', data, 20 + n)
  bin_ = data[28 + n:28 + n + m]
  views = [bytes(bin_[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]) for v in doc['bufferViews']]
  return doc, views


def write_glb(path, doc, views):
  """Lays the buffer views out again (4-byte aligned) and writes the GLB."""
  blob = bytearray()
  for v, b in zip(doc['bufferViews'], views):
    blob += b'\0' * (-len(blob) % 4)
    v['byteOffset'] = len(blob)
    v['byteLength'] = len(b)
    blob += b
  blob += b'\0' * (-len(blob) % 4)
  doc['buffers'] = [{'byteLength': len(blob)}]
  js = json.dumps(doc, separators=(',', ':')).encode()
  js += b' ' * (-len(js) % 4)
  out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(blob))
  out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
  path.write_bytes(out)


def accessor(doc, views, i):
  a = doc['accessors'][i]
  kind = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a['componentType']]
  width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
  v = doc['bufferViews'][a['bufferView']]
  raw = views[a['bufferView']]
  stride = v.get('byteStride', 0) or np.dtype(kind).itemsize * width
  start = a.get('byteOffset', 0)
  rows = np.ndarray((a['count'], width), kind, raw, start, (stride, np.dtype(kind).itemsize))
  return rows.copy()


def image_of(doc, tex):
  """The image index a texture uses (plain or EXT_texture_webp)."""
  t = doc['textures'][tex]
  return t.get('extensions', {}).get('EXT_texture_webp', {}).get('source', t.get('source'))


def load_image(doc, views, img):
  """RGB, or RGBA when it has alpha (a colour map's alpha is its paint mask: process-props.py's `paint`)."""
  pil = Image.open(io.BytesIO(views[doc['images'][img]['bufferView']]))
  return pil.convert('RGBA' if 'A' in pil.getbands() else 'RGB')


def store_image(doc, views, img, pil):
  buf = io.BytesIO()
  pil.save(buf, 'WEBP', quality=86, method=6)
  views[doc['images'][img]['bufferView']] = buf.getvalue()
  doc['images'][img]['mimeType'] = 'image/webp'


def primitives(doc, views):
  """Each primitive's (material index, positions, uvs, triangles)."""
  for n in doc['nodes']:
    if any(k in n for k in ('matrix', 'rotation', 'scale', 'translation')):
      raise SystemExit('expected the processed props to have no node transforms')
  for mesh in doc['meshes']:
    for p in mesh['primitives']:
      pos = accessor(doc, views, p['attributes']['POSITION'])
      uv = accessor(doc, views, p['attributes']['TEXCOORD_0'])
      tris = accessor(doc, views, p['indices']).reshape(-1, 3)
      yield p.get('material', 0), pos, uv, tris


# --- Blank ---------------------------------------------------------------------------------------

def blank(path, rects):
  doc, views = read_glb(path)
  for m in doc['materials']:
    base = image_of(doc, m['pbrMetallicRoughness']['baseColorTexture']['index'])
    normal = image_of(doc, m['normalTexture']['index']) if 'normalTexture' in m else None
    col = np.asarray(load_image(doc, views, base), np.float32)
    w, h = col.shape[1], col.shape[0]
    nrm = np.asarray(load_image(doc, views, normal), np.float32) if normal is not None else None
    for u0, v0, u1, v1 in rects:
      x0, y0, x1, y1 = round(u0 * w), round(v0 * h), round(u1 * w), round(v1 * h)
      patch = col[y0:y1, x0:x1, :3]
      lum = patch.mean(-1)
      ground = np.median(patch[lum >= np.percentile(lum, 70)], axis=0)
      col[y0:y1, x0:x1, :3] = ground
      if nrm is not None:
        nrm[y0:y1, x0:x1] = (128, 128, 255)
      print(f'  {path.name}: blanked {x1 - x0}x{y1 - y0} px with {np.round(ground).astype(int).tolist()}')
    store_image(doc, views, base, Image.fromarray(col.clip(0, 255).astype(np.uint8)))
    if nrm is not None:
      store_image(doc, views, normal, Image.fromarray(nrm.astype(np.uint8)))
  write_glb(path, doc, views)


# --- Spokes --------------------------------------------------------------------------------------

def texels(p, P, size):
  """The texels of UV triangle p (3x2, px) with a texel of slack, and the 3D point of each
  (interpolated from the corners P, 3x3): (ys, xs, points)."""
  h, w = size
  x0, y0 = np.floor(p.min(0)).astype(int) - 1
  x1, y1 = np.ceil(p.max(0)).astype(int) + 1
  x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
  (ax, ay), (bx, by), (cx, cy) = p
  d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  if x1 <= x0 or y1 <= y0 or abs(d) < 1e-9:
    return None
  gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
  l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
  l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
  l3 = 1 - l1 - l2
  e = 1.0 / max(1.0, np.ptp(p[:, 0]) + np.ptp(p[:, 1]))
  ok = (l1 >= -e) & (l2 >= -e) & (l3 >= -e)
  return gy[ok].astype(int), gx[ok].astype(int), l1[ok, None] * P[0] + l2[ok, None] * P[1] + l3[ok, None] * P[2]


def spokes(path, wheels):
  doc, views = read_glb(path)
  parts = {}
  for mat, pos, uv, tris in primitives(doc, views):
    parts.setdefault(mat, []).append((pos, uv, tris))
  for mat, prims in parts.items():
    m = doc['materials'][mat]
    pbr = m['pbrMetallicRoughness']
    maps = {'color': image_of(doc, pbr['baseColorTexture']['index'])}
    if 'metallicRoughnessTexture' in pbr:
      maps['mr'] = image_of(doc, pbr['metallicRoughnessTexture']['index'])
    if 'normalTexture' in m:
      maps['normal'] = image_of(doc, m['normalTexture']['index'])
    px = {k: np.asarray(load_image(doc, views, i), np.float32) / 255 for k, i in maps.items()}
    h, w = px['color'].shape[:2]
    for wh in wheels:
      c, n = np.array(wh['centre']), np.array(wh['axis'], np.float64)
      n /= np.linalg.norm(n)
      a = np.cross(n, [0, 1, 0]) if abs(n[1]) < 0.9 else np.cross(n, [1, 0, 0])
      a /= np.linalg.norm(a)
      b = np.cross(n, a)
      radius, depth = wh['radius'], wh.get('depth', 0.05)
      ys, xs, pts = [], [], []
      for pos, uv, tris in prims:
        P = pos[tris]
        rel = P.mean(1) - c
        d = rel @ n
        r = np.linalg.norm(rel - d[:, None] * n, axis=1)
        for t in np.nonzero((np.abs(d) < depth + 0.03) & (r < radius + 0.05))[0]:
          got = texels(uv[tris[t]] * (w, h), P[t], (h, w))
          if got:
            ys.append(got[0]); xs.append(got[1]); pts.append(got[2])
      ys, xs, pts = np.concatenate(ys), np.concatenate(xs), np.concatenate(pts)
      rel = pts - c
      d = rel @ n
      x, y = rel @ a, rel @ b
      r = np.hypot(x, y)
      sel = (np.abs(d) < depth) & (r < radius)
      ys, xs, r, ang = ys[sel], xs[sel], r[sel], np.arctan2(y[sel], x[sel])
      # Coverage (antialiased over 3 mm) of the spokes, the hub and the rim's inner lip
      cover = lambda dist: np.clip(0.5 - dist / 0.003, 0, 1)
      k = wh['count']
      gap = np.abs((ang * k / (2 * np.pi) + 0.5) % 1 - 0.5) * 2 * np.pi / k * r  # metres to the nearest spoke
      metal = np.maximum.reduce([cover(gap - wh['width'] / 2), cover(r - wh['hub']), cover(radius - 0.012 - r)])
      shade = 0.85 + 0.15 * np.cos(ang - 0.6)  # a little light catching one side of the hub
      # Between the spokes, the shadow seen through the wheel
      px['color'][ys, xs, :3] = STEEL * shade[:, None] * metal[:, None] + THROUGH * (1 - metal[:, None])
      if 'mr' in px:
        px['mr'][ys, xs, 1] = 0.85 - 0.5 * metal
        px['mr'][ys, xs, 2] = 0.9 * metal
      if 'normal' in px:
        px['normal'][ys, xs, :3] = (0.5, 0.5, 1.0)
      print(f'  {path.name}: spokes on {len(ys)} texels of a wheel at {c.tolist()}')
    for k, i in maps.items():
      store_image(doc, views, i, Image.fromarray((px[k] * 255 + 0.5).clip(0, 255).astype(np.uint8)))
  write_glb(path, doc, views)


def main():
  for p in load_list():
    glb = OUT / f'{p["name"]}.glb'
    if not glb.exists() or not any(p.get(k) for k in ('blank', 'spokes')):
      continue
    doc, views = read_glb(glb)
    if doc['asset'].get('extras', {}).get('post'):
      print(f'  {glb.name}: done before (process it again to redo)')
      continue
    if p.get('blank'):
      blank(glb, p['blank'])
    if p.get('spokes'):
      spokes(glb, p['spokes'])
    doc, views = read_glb(glb)
    doc['asset'].setdefault('extras', {})['post'] = True
    write_glb(glb, doc, views)


main()
