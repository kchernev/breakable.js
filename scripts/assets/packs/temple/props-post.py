#!/usr/bin/env python3
# Second pass over Sun Temple's processed props (public/packs/temple/models, written by
# process-props.py), with no paid calls: a prop's `grade` (props.mjs) pulls its colour map toward the
# world's bronze palette (DESIGN.md: bronze 0x8a6a3e, verdigris 0x5f9c86) and gives the bare bronze
# some metalness. Tripo bakes these castings as a flat olive-grey with no metal at all, which next to
# the temple's metallic bronze doors and shields reads as another material.
#
# Per texel, how much it is verdigris rather than bare bronze is how far green and blue rise over
# red. The bronze texels get the `bronze` hue, the verdigris the `patina` hue; saturation is scaled
# (`sat`, `satAdd`, capped at `satMax`), value scaled by `value`, and the result is mixed with the
# original by `mix`. Metalness (the blue channel of the metal/rough map) becomes `metal`, blended
# between the two by the same weight.
#
#   PACK=temple python3 -I scripts/assets/packs/temple/props-post.py [name ...] [--out dir]
#
# Run it after every process-props.py run (that rewrites the GLBs it starts from). A graded GLB is
# marked in asset.extras and left alone by a rerun.

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
LIST = ROOT / 'scripts/assets/packs/temple/props.mjs'
MODELS = ROOT / 'public/packs/temple/models'


def load_props():
  js = 'import(process.argv[1]).then((m) => process.stdout.write(JSON.stringify(m.props)))'
  out = subprocess.run(['node', '-e', js, str(LIST)], check=True, capture_output=True, text=True)
  return json.loads(out.stdout)


# --- GLB in and out ------------------------------------------------------------------------------

def read_glb(path):
  data = path.read_bytes()
  (n,) = struct.unpack_from('<I', data, 12)
  doc = json.loads(data[20:20 + n])
  (m,) = struct.unpack_from('<I', data, 20 + n)
  blob = data[28 + n:28 + n + m]
  views = [bytes(blob[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]) for v in doc['bufferViews']]
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


def image_of(doc, tex):
  """The image index a texture uses (plain or EXT_texture_webp)."""
  t = doc['textures'][tex]
  return t.get('extensions', {}).get('EXT_texture_webp', {}).get('source', t.get('source'))


def load_image(doc, views, img):
  return np.asarray(Image.open(io.BytesIO(views[doc['images'][img]['bufferView']])).convert('RGB'), np.float32) / 255


def store_image(doc, views, img, a):
  buf = io.BytesIO()
  Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(buf, 'WEBP', quality=86, method=6)
  views[doc['images'][img]['bufferView']] = buf.getvalue()
  doc['images'][img]['mimeType'] = 'image/webp'


# --- Colour ----------------------------------------------------------------------------------------

def rgb_to_hsv(a):
  """(h in degrees, s, v) of an RGB array in 0..1."""
  v = a.max(-1)
  c = v - a.min(-1)
  s = np.where(v > 0, c / np.maximum(v, 1e-6), 0)
  r, g, b = a[..., 0], a[..., 1], a[..., 2]
  cc = np.maximum(c, 1e-6)
  h = np.where(v == r, ((g - b) / cc) % 6, np.where(v == g, (b - r) / cc + 2, (r - g) / cc + 4))
  return np.where(c > 0, h * 60, 0), s, v


def hsv_to_rgb(h, s, v):
  c = v * s
  x = c * (1 - np.abs((h / 60) % 2 - 1))
  k = (h // 60).astype(int) % 6
  z = np.zeros_like(c)
  r = np.choose(k, [c, x, z, z, x, c])
  g = np.choose(k, [x, c, c, x, z, z])
  b = np.choose(k, [z, z, x, c, c, x])
  return np.stack([r, g, b], -1) + (v - c)[..., None]


def toward(s, v, rule, hue_shape):
  sat = np.minimum(s * rule['sat'] + rule['satAdd'], rule['satMax'])
  return hsv_to_rgb(np.full(hue_shape, float(rule['hue'])), sat, np.clip(v * rule['value'], 0, 1))


def grade(path, out, g):
  doc, views = read_glb(path)
  if doc['asset'].get('extras', {}).get('graded'):
    print(f'  {path.name}: already graded, left alone')
    return
  for m in doc['materials']:
    pbr = m['pbrMetallicRoughness']
    base = image_of(doc, pbr['baseColorTexture']['index'])
    a = load_image(doc, views, base)
    # Verdigris rather than bare bronze: green and blue over red
    w = np.clip(((a[..., 1] + a[..., 2]) / 2 - a[..., 0] + 0.01) / 0.06, 0, 1)
    _, s, v = rgb_to_hsv(a)
    graded = toward(s, v, g['bronze'], s.shape) * (1 - w[..., None]) + toward(s, v, g['patina'], s.shape) * w[..., None]
    store_image(doc, views, base, a + (graded - a) * g['mix'])
    if 'metallicRoughnessTexture' in pbr:
      mr_img = image_of(doc, pbr['metallicRoughnessTexture']['index'])
      mr = load_image(doc, views, mr_img)
      if mr.shape[:2] != w.shape:
        w = np.asarray(Image.fromarray((w * 255).astype(np.uint8)).resize(mr.shape[1::-1], Image.BILINEAR), np.float32) / 255
      mr[..., 2] = g['bronze']['metal'] * (1 - w) + g['patina']['metal'] * w
      store_image(doc, views, mr_img, mr)
    print(f'  {path.name}: {m.get("name")}: {float((w > 0.5).mean()) * 100:.1f}% verdigris; mean colour '
          f'{np.round(a.reshape(-1, 3).mean(0) * 255).astype(int).tolist()} -> '
          f'{np.round((a + (graded - a) * g["mix"]).reshape(-1, 3).mean(0) * 255).astype(int).tolist()}')
  doc['asset'].setdefault('extras', {})['graded'] = True
  write_glb(out, doc, views)


def main():
  argv = sys.argv[1:]
  out_dir = MODELS
  if '--out' in argv:
    i = argv.index('--out')
    out_dir = Path(argv[i + 1])
    del argv[i:i + 2]
  for p in load_props():
    if 'grade' not in p or (argv and p['name'] not in argv):
      continue
    src = MODELS / f'{p["name"]}.glb'
    print(f'[{p["name"]}] grade')
    grade(src, out_dir / src.name, p['grade'])


main()
