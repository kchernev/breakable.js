#!/usr/bin/env python3
# Sun Temple's free sets and sky from Poly Haven (CC0): fetches each texture set's 1k colour,
# OpenGL normal and packed AO/roughness/metalness maps (the lossless PNGs, so the WebP is encoded
# once), writes them as public/packs/temple/textures/<set>_<map>_1k.webp like the generated sets,
# with 2x2 previews in assets-src/packs/temple/textures/previews, and fetches the sky into
# public/packs/temple/hdri. Where each came from is written to assets-src/packs/temple/polyhaven.json.
#
#   python3 -I scripts/assets/packs/temple/polyhaven.py

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/cv2 live in the user site, which -I leaves out

import json
import tempfile
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'public/packs/temple/textures'
HDRI = ROOT / 'public/packs/temple/hdri'
PREVIEWS = ROOT / 'assets-src/packs/temple/textures/previews'
RECORD = ROOT / 'assets-src/packs/temple/polyhaven.json'

# Set -> what it is in the sanctuary (Poly Haven's tile size is in the record)
SETS = {
  # Pale worn rock with fine cracks, the colour of the design's bedrock: the one to use underfoot
  'marble_rock_02': 'bedrock patches in the ground, scenery rocks',
  'marble_rock_01': "the design's first pick for bedrock: greyer, darker, strong black cracks",
  # Cream with dark vertical fractures: paler than marble_cliff_03, so it reads as limestone in the haze
  'marble_cliff_01': 'the sea cliffs',
  'marble_cliff_03': "the design's first pick for the cliffs: orange-tan, blocky strata",
  # Jointless weathered grain: the plank sets' dark gaps would stripe a 0.22 m rafter
  'rough_wood': 'timber (rafters, tie beams, wall plates)',
  'bark_willow_02': 'bark (olive and cypress trunks and limbs)',
}
MAPS = {'diff': 'Diffuse', 'nor_gl': 'nor_gl', 'arm': 'arm'}
# The midday sky the design picked. 1k is enough: a smooth gradient, the few small clouds on the
# horizon are barely sharper at 2k, and the fog covers the horizon anyway
SKIES = [('pizzo_pernice_puresky', '1k')]


def api(path):
  req = urllib.request.Request(f'https://api.polyhaven.com/{path}', headers={'User-Agent': 'breakable-assets'})
  with urllib.request.urlopen(req) as r:
    return json.load(r)


def fetch(url, path):
  req = urllib.request.Request(url, headers={'User-Agent': 'breakable-assets'})
  with urllib.request.urlopen(req) as r:
    path.write_bytes(r.read())
  return path


def load(path):
  """An 8- or 16-bit PNG as RGB floats 0-1."""
  a = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
  scale = 65535 if a.dtype == np.uint16 else 255
  return cv2.cvtColor(a[..., :3], cv2.COLOR_BGR2RGB).astype(np.float32) / scale


def to8(a):
  return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


def save_webp(a, path, max_kb=450):
  """Quality 90, or a little less if that comes out much bigger than the other sets' maps."""
  img = Image.fromarray(to8(a))
  for q in (90, 88, 86, 84, 82, 80):
    img.save(path, 'WEBP', quality=q, method=6)
    if path.stat().st_size <= max_kb * 1024:
      break
  return q


def lit(col, nor, ao):
  """The base script's quick render: lit from the upper left, a little ambient, in linear light."""
  n = nor * 2 - 1
  l = np.array([-0.55, 0.55, 0.63], np.float32)
  l /= np.linalg.norm(l)
  shade = 0.18 * ao + 0.95 * np.clip(n @ l, 0, 1) / l[2]
  lin = np.where(col <= 0.04045, col / 12.92, ((col + 0.055) / 1.055) ** 2.4) * shade[..., None] * 0.75
  lin = np.clip(lin, 0, 1)
  return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)


def previews(name, col, lit_img):
  PREVIEWS.mkdir(parents=True, exist_ok=True)
  for tag, img in (('2x2', col), ('lit_2x2', lit_img)):
    small = cv2.resize(img, (512, 512), interpolation=cv2.INTER_AREA)
    Image.fromarray(to8(np.tile(small, (2, 2, 1)))).save(PREVIEWS / f'{name}_{tag}.jpg', quality=88)


def main():
  OUT.mkdir(parents=True, exist_ok=True)
  HDRI.mkdir(parents=True, exist_ok=True)
  record = {}
  with tempfile.TemporaryDirectory() as tmp:
    for name, use in SETS.items():
      info, files = api(f'info/{name}'), api(f'files/{name}')
      maps, sources = {}, {}
      for tag, key in MAPS.items():
        src = files[key]['1k']['png']
        maps[tag] = load(fetch(src['url'], Path(tmp) / f'{name}_{tag}.png'))
        q = save_webp(maps[tag], OUT / f'{name}_{tag}_1k.webp')
        sources[tag] = {'url': src['url'], 'md5': src['md5'], 'webp_quality': q}
      sizes = [round((OUT / f'{name}_{t}_1k.webp').stat().st_size / 1024) for t in MAPS]
      mean = [round(float(m), 3) for m in maps['diff'].reshape(-1, 3).mean(0)]
      print(f'{name}: {maps["diff"].shape[1]}x{maps["diff"].shape[0]}, colour mean {mean}, sizes {sizes} KB')
      previews(name, maps['diff'], lit(maps['diff'], maps['nor_gl'], maps['arm'][..., 0]))
      record[name] = {
        'use': use,
        'tile_m': [round(d / 1000, 3) for d in info['dimensions']],
        'colour_mean': mean,
        'authors': info['authors'],
        'license': 'CC0',
        'page': f'https://polyhaven.com/a/{name}',
        'maps': sources,
      }
  for name, res in SKIES:
    files, info = api(f'files/{name}'), api(f'info/{name}')
    src = files['hdri'][res]['hdr']
    path = fetch(src['url'], HDRI / f'{name}_{res}.hdr')
    print(f'{path.name}: {round(path.stat().st_size / 1024)} KB')
    record[f'{name}_{res}'] = {'authors': info['authors'], 'license': 'CC0', 'page': f'https://polyhaven.com/a/{name}', 'url': src['url'], 'md5': src['md5']}
  RECORD.write_text(json.dumps(record, indent=2) + '\n')


if __name__ == '__main__':
  main()
