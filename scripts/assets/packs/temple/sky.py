#!/usr/bin/env python3
# Sun Temple's sky: Poly Haven's pizzo_pernice_puresky (CC0, fetched by polyhaven.py) graded toward
# the deep blue of a Mediterranean noon. Above the first few degrees the sky is pulled from slate
# toward ultramarine (less red, more blue, a little darker toward the zenith); the haze low down and
# the sun's disc are left as they are.
#
#   python3 -I scripts/assets/packs/temple/sky.py

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/cv2 live in the user site, which -I leaves out

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[4]
SRC = ROOT / 'public/packs/temple/hdri/pizzo_pernice_puresky_1k.hdr'
OUT = ROOT / 'public/packs/temple/hdri/temple_sky_1k.hdr'

# What the sky is multiplied by at the zenith (linear RGB); none of it at the horizon
ZENITH = np.array([0.62, 0.98, 1.45], np.float32)


def main() -> None:
  bgr = cv2.imread(str(SRC), cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)
  rgb = bgr[..., ::-1].astype(np.float32)
  h, w, _ = rgb.shape
  # Elevation of each row (equirectangular, top row up): sin of it
  up = np.sin((0.5 - (np.arange(h) + 0.5) / h) * np.pi)[:, None, None]
  t = np.clip((up - 0.03) / (0.45 - 0.03), 0, 1)
  t = t * t * (3 - 2 * t)
  gain = 1 + (ZENITH - 1) * t
  lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
  # The sun and its glare stay as they are
  keep = np.clip((lum - 4) / 20, 0, 1)[..., None]
  out = rgb * (gain * (1 - keep) + keep)
  cv2.imwrite(str(OUT), np.ascontiguousarray(out[..., ::-1], dtype=np.float32))
  zen = out[: h // 16].reshape(-1, 3).mean(0)
  print(f'{OUT.name}: {w}x{h}, zenith {zen.round(3)} (was {rgb[: h // 16].reshape(-1, 3).mean(0).round(3)})')


if __name__ == '__main__':
  main()
