#!/usr/bin/env python3
# Market Town's free sets and skies from Poly Haven (CC0): fetches each texture set's 1k colour,
# OpenGL normal and packed AO/roughness/metalness maps (the lossless PNGs, so the WebP is encoded
# once), writes them as public/packs/medieval/textures/<set>_<map>_1k.webp like the generated sets,
# with 2x2 previews in assets-src/packs/medieval/textures/previews, and fetches the sky into
# public/packs/medieval/hdri. Where each came from is written to assets-src/packs/medieval/polyhaven.json.
# Some sets are touched up on the way (FIXES); medieval_wall_01 is only the source of the limewash
# (not shipped). Name sets to fetch only those (and not the sky).
#
#   python3 -I scripts/assets/packs/medieval/polyhaven.py [set ...]

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/cv2 live in the user site, which -I leaves out

import json
import shutil
import tempfile
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'public/packs/medieval/textures'
HDRI = ROOT / 'public/packs/medieval/hdri'
PREVIEWS = ROOT / 'assets-src/packs/medieval/textures/previews'
RECORD = ROOT / 'assets-src/packs/medieval/polyhaven.json'

# Set -> what it is in the town (Poly Haven's tile size is in the record)
SETS = {
  'cobblestone_floor_001': 'the ground',
  'rocky_trail_02': 'the dirt roads out of the gate and the south-west gap (scenery)',
  'roof_09': 'tile (plain peg tiles; clay_roof_tiles_03 before it had a moulded diamond on each tile)',
  'castle_wall_slates': 'rubble',
  'medieval_wall_01': 'the source of medieval_limewash (not shipped: the plaster as photographed is beige)',
  'old_planks_02': 'boards',
}
MAPS = {'diff': 'Diffuse', 'nor_gl': 'nor_gl', 'arm': 'arm'}
# Sets made from another by regrading its colour (normals and arm as they are): the plaster's photo is
# beige with orange stains, and the houses' washes multiply it, so the wash needs a near-white base
LIMEWASH = {'name': 'medieval_limewash', 'from': 'medieval_wall_01', 'mean': (0.86, 0.85, 0.81), 'saturation': 0.3, 'contrast': 0.85, 'dark_marks': 3}



def dark_marks(col, pct, keep=0.25):
  """Pixels darker than the `pct` percentile of brightness pulled most of the way to the median
  (softened at the edges): a few dark marks repeat as a grid."""
  L = col @ np.array([0.2126, 0.7152, 0.0722], np.float32)
  med = np.median(L)
  t = np.percentile(L, pct)
  mask = np.clip(blur(np.clip((t - L) / max(t - L.min(), 1e-3) * 4, 0, 1), 3) * 2, 0, 1)[..., None]
  target = col * (med + keep * (L - med))[..., None] / np.maximum(L, 1e-3)[..., None]
  return np.clip(col + mask * (target - col), 0, 1)


def blur(x, sigma):
  """A Gaussian blur of a tile, wrapping round its edges."""
  p = int(sigma * 4) + 1
  pad = ((p, p), (p, p)) + ((0, 0),) * (x.ndim - 2)
  return cv2.GaussianBlur(np.pad(x, pad, mode='wrap'), (0, 0), sigma)[p:-p, p:-p]


def fix_rubble(maps):
  """The town wall's rubble: its few pale and coloured stones (a lattice of light squares every
  1.25 m on the wall's face) repainted at the wall's median colour, keeping their own grain; and
  never glossy (it looked wet in the low sun)."""
  col = maps['diff']
  L = col @ np.array([0.2126, 0.7152, 0.0722], np.float32)
  Lb = blur(L, 4)
  sat = blur(np.abs(col - col.mean(-1, keepdims=True)).sum(-1), 4)
  odd = ((Lb > np.percentile(Lb, 96)) | (sat > np.percentile(sat, 98.5))).astype(np.uint8)
  odd = cv2.dilate(np.pad(odd, 16, mode='wrap'), np.ones((9, 9), np.uint8))[16:-16, 16:-16].astype(np.float32)
  mask = np.clip(blur(odd, 3) * 1.4, 0, 1)[..., None]
  grain = np.clip(L / np.maximum(blur(L, 12), 1e-3), 0.5, 1.5)[..., None]
  target = np.median(col.reshape(-1, 3), 0) * grain * 0.95
  maps['diff'] = np.clip(col + mask * (target - col), 0, 1)
  maps['arm'][..., 1] = np.maximum(maps['arm'][..., 1], 0.8)


def fix_tile(maps):
  """Plain tiles: the photo's brown moved toward fired clay, which the roofs' tints then vary."""
  maps['diff'] = regrade(maps['diff'], (0.5, 0.3, 0.22), 1.25, 1.0)


# Fixes applied to a set's maps before they're written
FIXES = {'castle_wall_slates': fix_rubble, 'roof_09': fix_tile}
# The sky: the design's alternative (its pick, kloppenheim_06_puresky, a pale evening sky with only
# a faint glow, made the square look overcast)
SKIES = [('syferfontein_6d_clear_puresky', '1k')]


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


def regrade(col, mean, saturation, contrast):
  """The colour moved to `mean`, keeping `saturation` of its colourfulness and `contrast` of its
  brightness variation (stains read as dirt, not as a hue)."""
  grey = col @ np.array([0.2126, 0.7152, 0.0722], np.float32)
  g = grey.mean() + contrast * (grey - grey.mean())
  out = g[..., None] + saturation * (col - grey[..., None])
  return np.clip(out * (np.asarray(mean, np.float32) / out.reshape(-1, 3).mean(0)), 0, 1)


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


def main(only):
  OUT.mkdir(parents=True, exist_ok=True)
  HDRI.mkdir(parents=True, exist_ok=True)
  record = json.loads(RECORD.read_text()) if only and RECORD.exists() else {}
  with tempfile.TemporaryDirectory() as tmp:
    for name, use in SETS.items():
      if only and name not in only:
        continue
      info, files = api(f'info/{name}'), api(f'files/{name}')
      maps, sources = {}, {}
      for tag, key in MAPS.items():
        src = files[key]['1k']['png']
        maps[tag] = load(fetch(src['url'], Path(tmp) / f'{name}_{tag}.png'))
        if tag == 'arm' and maps[tag][..., 0].mean() < 0.05:
          maps[tag][..., 0] = 1  # some older sets ship no occlusion (black): neutral instead
        sources[tag] = {'url': src['url'], 'md5': src['md5']}
      if name in FIXES:
        FIXES[name](maps)
      # A set that's only the source of another is written where the build doesn't look
      out = Path(tmp) if name == LIMEWASH['from'] else OUT
      for tag in MAPS:
        sources[tag]['webp_quality'] = save_webp(maps[tag], out / f'{name}_{tag}_1k.webp')
      sizes = [round((out / f'{name}_{t}_1k.webp').stat().st_size / 1024) for t in MAPS]
      print(f'{name}: {maps["diff"].shape[1]}x{maps["diff"].shape[0]}, sizes {sizes} KB')
      previews(name, maps['diff'], lit(maps['diff'], maps['nor_gl'], maps['arm'][..., 0]))
      record[name] = {
        'use': use,
        'tile_m': [round(d / 1000, 3) for d in info['dimensions']],
        'authors': info['authors'],
        'license': 'CC0',
        'page': f'https://polyhaven.com/a/{name}',
        'maps': sources,
        **({'fixed': FIXES[name].__doc__.strip()} if name in FIXES else {}),
      }
      if name == LIMEWASH['from']:
        w = LIMEWASH['name']
        # The photo's dark crack marks repeat every 2 m and read as veins in marble: toned down
        col = dark_marks(regrade(maps['diff'], LIMEWASH['mean'], LIMEWASH['saturation'], LIMEWASH['contrast']), LIMEWASH['dark_marks'])
        save_webp(col, OUT / f'{w}_diff_1k.webp')
        for tag in ('nor_gl', 'arm'):
          shutil.copyfile(out / f'{name}_{tag}_1k.webp', OUT / f'{w}_{tag}_1k.webp')
        previews(w, col, lit(col, maps['nor_gl'], maps['arm'][..., 0]))
        record[w] = {**record[name], 'use': 'plaster (the wash tints it)', 'derived': {k: v for k, v in LIMEWASH.items() if k != 'name'}}
        print(f'{w}: from {name}, mean {np.round(col.reshape(-1, 3).mean(0), 3).tolist()}')
  for name, res in [] if only else SKIES:
    files, info = api(f'files/{name}'), api(f'info/{name}')
    src = files['hdri'][res]['hdr']
    path = fetch(src['url'], HDRI / f'{name}_{res}.hdr')
    print(f'{path.name}: {round(path.stat().st_size / 1024)} KB')
    record[f'{name}_{res}'] = {'authors': info['authors'], 'license': 'CC0', 'page': f'https://polyhaven.com/a/{name}', 'url': src['url'], 'md5': src['md5']}
  RECORD.write_text(json.dumps(record, indent=2) + '\n')


if __name__ == '__main__':
  main(set(sys.argv[1:]))
