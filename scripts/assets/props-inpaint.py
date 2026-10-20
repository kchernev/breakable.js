#!/usr/bin/env python3
# Paints small things out of a prop concept image before it goes to image-to-3D (a brand-like badge
# the image model drew despite being told not to): each box is covered with a feathered copy of the
# image from `offset` pixels away (a clone stamp; pick an offset along the pattern, e.g. along a
# grille's bars). Called by generate-props.mjs with the prop's `inpaint` list from props.mjs.
#
#   python3 -I scripts/assets/props-inpaint.py in.png out.png '[{"box":[x0,y0,x1,y1],"offset":[dx,dy]}]'

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/PIL live in the user site, which -I leaves out

import json

import numpy as np
from PIL import Image
from scipy import ndimage

src, dst, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
out = img.copy()
for s in spec:
  x0, y0, x1, y1 = s['box']
  dx, dy = s['offset']
  mask = np.zeros(img.shape[:2], np.float32)
  mask[y0:y1, x0:x1] = 1
  mask = ndimage.gaussian_filter(mask, 3)[..., None]
  mask[y0 + 3:y1 - 3, x0 + 3:x1 - 3] = 1  # solid inside, feathered at the edge
  shifted = np.roll(img, (-dy, -dx), axis=(0, 1))  # shifted[y, x] = img[y + dy, x + dx]
  out = out * (1 - mask) + shifted * mask
Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(dst)
print(f'{dst}: {len(spec)} region(s) painted out')
