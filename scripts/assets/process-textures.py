#!/usr/bin/env python3
# Turns the raw generations of the texture sets (assets-src/textures/raw, made by
# generate-textures.mjs from textures.mjs) into tiling 1k PBR maps in public/textures, the way the
# Poly Haven sets there are laid out: <set>_diff_1k.webp (sRGB colour), <set>_nor_gl_1k.webp
# (OpenGL tangent-space normal, green up) and <set>_arm_1k.webp (R occlusion, G roughness,
# B metalness). Also writes 2x2 previews (colour, and lit by the normal map) to
# assets-src/textures/previews, and prints how much each wrap seam stands out.
#
#   python3 -I scripts/assets/process-textures.py [set ...]
#
# Making them tile: the image model only gets close, so each set is made to wrap exactly by what
# suits its structure. Bricks are cut into cells (a brick and half the mortar round it) and laid out
# again on an exact running-bond grid, so every join is in the middle of a mortar joint; boards are
# cut from gap to gap; the sidewalk is cropped from joint to joint; loose textures (rubble, concrete,
# paint) overlap their opposite edges and cut between them where they agree (a min-cut, as in image
# quilting).

import site
import sys

sys.path.insert(0, site.getusersitepackages())  # numpy/scipy/cv2 live in the user site, which -I leaves out

import json
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
# PACK=<name>: a world's own pack (scripts/assets/pack.mjs has the layout)
PACK = os.environ.get('PACK') or None
BASE = ROOT / f'assets-src/packs/{PACK}/textures' if PACK else ROOT / 'assets-src/textures'
RAW = BASE / 'raw'
PREVIEWS = BASE / 'previews'
OUT = ROOT / f'public/packs/{PACK}/textures' if PACK else ROOT / 'public/textures'
SIZE = 1024


# --- Helpers ---------------------------------------------------------------------------------------

def load(path):
  return np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255


def lum(a):
  return a @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def blur(a, sigma, wrap=True):
  """Gaussian blur over the image plane; wraps around by default, since the maps tile."""
  s = (sigma, sigma) + (0,) * (a.ndim - 2)
  return ndimage.gaussian_filter(a, s, mode='wrap' if wrap else 'reflect')


def highpass(a, sigma):
  return a - blur(a, sigma)


def norm(a):
  return (a - a.mean()) / (a.std() + 1e-6)


def smoothstep(e0, e1, x):
  t = np.clip((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)


def resize(a, w, h):
  shrink = w < a.shape[1] or h < a.shape[0]
  return cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA if shrink else cv2.INTER_LANCZOS4)


def to_srgb8(a):
  return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


def srgb_to_linear(a):
  return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(a):
  a = np.clip(a, 0, 1)
  return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def save_webp(a, path, max_kb=450):
  """WebP at quality 90, or a little less if that comes out much bigger than the Poly Haven maps."""
  img = Image.fromarray(to_srgb8(a))
  for q in (90, 88, 86, 84, 82, 80):
    img.save(path, 'WEBP', quality=q, method=6)
    if path.stat().st_size <= max_kb * 1024:
      break
  return q


def delight(a, sigma, strength):
  """Evens out the image's lowest frequencies (lighting, big blotches), which would show as a
  pattern once it repeats; strength 1 flattens them completely."""
  low = blur(lum(a), sigma)
  return np.clip(a * ((low.mean() / np.maximum(low, 1e-3)) ** strength)[..., None], 0, 1)


def seam_score(a):
  """How much each wrap (x, y) stands out. First: 0 when the step across it is like the average step
  between two neighbouring columns/rows, 1 when it is like two unrelated ones. But a wrap that runs
  along a joint should step like a joint, so second: the step across it over the biggest step
  between any two neighbouring lines inside (above 1: it stands out from everything in the tile)."""
  g = lum(a)
  out, edge = [], []
  for axis in (1, 0):
    steps = np.abs(np.diff(g, axis=axis)).mean(1 - axis)
    wrap = np.abs(np.take(g, 0, axis) - np.take(g, -1, axis)).mean()
    far = np.abs(g - np.roll(g, g.shape[axis] // 3, axis)).mean()
    out.append(round(float((wrap - steps.mean()) / (far - steps.mean())), 3))
    edge.append(round(float(wrap / steps.max()), 2))
  return out, edge


# --- Finding a regular structure (joints, gaps) ----------------------------------------------------

def parabola(p, i):
  """Sub-sample position of the peak of p at i."""
  if 0 < i < len(p) - 1:
    d = p[i - 1] - 2 * p[i] + p[i + 1]
    if d < 0:
      return i + 0.5 * (p[i - 1] - p[i + 1]) / d
  return float(i)


def period(profiles, lo, hi):
  """The period of one or more 1-D profiles: the strongest autocorrelation peak in [lo, hi]."""
  ac = 0
  for p in np.atleast_2d(profiles):
    p = p - p.mean()
    ac = ac + np.fft.irfft(np.abs(np.fft.rfft(p, 2 * len(p))) ** 2)[: len(p)]
  i = lo + int(np.argmax(ac[lo:hi]))
  return parabola(ac, i)


def peaks(p, per):
  """Positions of a profile's peaks one period apart: from the strongest, step a period at a time
  each way and take the highest point within a quarter period of where the next one should be."""
  n = len(p)
  start = int(np.argmax(p))
  found = [parabola(p, start)]
  for sign in (1, -1):
    x = found[0]
    while True:
      lo, hi = int(round(x + sign * per - per / 4)), int(round(x + sign * per + per / 4))
      if lo < 0 or hi >= n:
        break
      i = lo + int(np.argmax(p[lo:hi + 1]))
      x = parabola(p, i)
      found.append(x)
  return sorted(found)


def comb(p, per, refine=0.1):
  """Peaks of a profile that repeats every `per`: the comb of that period that fits it best (all the
  teeth at once, so a few faint or stray peaks don't throw it), each tooth then moved to the highest
  point within refine * per of where it fell."""
  n = len(p)
  phases = np.arange(0, per, 0.5)
  score = [np.interp(np.arange(ph, n, per), np.arange(n), p).mean() for ph in phases]
  out = []
  for t in np.arange(phases[int(np.argmax(score))], n, per):
    lo, hi = int(round(t - refine * per)), int(round(t + refine * per))
    if lo >= 0 and hi < n:
      out.append(parabola(p, lo + int(np.argmax(p[lo:hi + 1]))))
  return out


# --- Making it tile: overlap and cut (loose textures) ----------------------------------------------

def min_path(err, closed):
  """A path across the columns of err (rows x cols), moving at most one row per column, through the
  lowest total error. closed: it must also end within a row of where it started, so that it joins up
  when the columns wrap around. Keeps 3 rows clear of both edges, for the feathering."""
  rows, cols = err.shape
  big = 1e9
  err = err.copy()
  err[:3] = err[-3:] = big
  starts = np.arange(3, rows - 3, 2) if closed else [None]
  best = (np.inf, None)
  for s in starts:
    cost = err[:, 0].copy()
    if s is not None:
      cost[:] = big
      cost[s] = err[s, 0]
    back = np.zeros((rows, cols), np.int8)
    for x in range(1, cols):
      up = np.r_[big, cost[:-1]]
      down = np.r_[cost[1:], big]
      stack = np.stack([up, cost, down])
      k = np.argmin(stack, 0)
      back[:, x] = k - 1
      cost = stack[k, np.arange(rows)] + err[:, x]
    if s is None:
      end = int(np.argmin(cost))
    else:
      ends = [r for r in (s - 1, s, s + 1) if 0 <= r < rows]
      end = min(ends, key=lambda r: cost[r])
    if cost[end] < best[0]:
      best = (cost[end], (back, end))
  back, r = best[1]
  path = np.zeros(cols, int)
  for x in range(cols - 1, -1, -1):
    path[x] = r
    r += back[r, x]
  return path


def wrap_rows(a, overlap, closed):
  """Makes `a` wrap from bottom to top, losing `overlap` rows: its last rows are laid over its
  first ones, and each column switches from one to the other along a min-error cut."""
  h = a.shape[0]
  p = h - overlap
  top, bottom = a[:overlap], a[p:]  # bottom follows the last kept row; top leads into the rest
  err = ((blur(top, 1, False) - blur(bottom, 1, False)) ** 2).sum(2)
  cut = min_path(err, closed)
  m = (np.arange(overlap)[:, None] >= cut[None, :]).astype(np.float32)
  m = ndimage.gaussian_filter(m, (1.2, 1.0), mode=('nearest', 'wrap' if closed else 'nearest'))[..., None]
  out = a[:p].copy()
  out[:overlap] = m * top + (1 - m) * bottom
  return out


def wrap_cut(a, overlap):
  """Both ways: across first (cut along a free path), then down (along a path that closes on itself,
  since the image already wraps across)."""
  a = wrap_rows(a.transpose(1, 0, 2), overlap, closed=False).transpose(1, 0, 2)
  return wrap_rows(a, overlap, closed=True)


# --- Making it tile: bricks ------------------------------------------------------------------------

def brick_cells(a, joints, course_range, brick_range):
  """Finds the bricks of a running-bond wall: the bed joints, then the head joints along each
  course. Returns the cells (x0, x1, y0, y1: mortar centre to mortar centre) and the periods."""
  rows = joints.mean(1)
  py = period(rows - ndimage.uniform_filter1d(rows, 151), *course_range)
  beds = peaks(rows, py)
  courses = []
  for y0, y1 in zip(beds, beds[1:]):
    h = y1 - y0
    c = joints[int(y0 + 0.3 * h):int(y1 - 0.3 * h)].mean(0)
    courses.append(c - ndimage.uniform_filter1d(c, 301))
  px = period(np.array(courses), *brick_range)
  cells = []
  for (y0, y1), c in zip(zip(beds, beds[1:]), courses):
    heads = comb(c, px)
    floor, top = np.median(c), np.percentile(c, 98)
    strong = [x for x in heads if c[int(round(x))] > floor + 0.35 * (top - floor)]
    for x0, x1 in zip(strong, strong[1:]):
      if 0.85 * px < x1 - x0 < 1.15 * px:
        cells.append((x0, x1, y0, y1))
  return cells, px, py


def refine_cell(joints, cell):
  """The bed joints right above and below this brick (courses wander a little across the wall)."""
  x0, x1, y0, y1 = cell
  h = y1 - y0
  xs = slice(int(x0 + 0.15 * (x1 - x0)), int(x1 - 0.15 * (x1 - x0)))
  out = []
  for y in (y0, y1):
    lo, hi = max(0, int(y - h / 4)), min(joints.shape[0] - 1, int(y + h / 4))
    p = joints[lo:hi + 1, xs].mean(1)
    out.append(lo + parabola(p, int(np.argmax(p))))
  return x0, x1, out[0], out[1]


def face_extent(p):
  """Where the face is along a profile across a cell (a joint at both ends), as fractions: inside
  the last rise above halfway (between the face's level and the joints') in the outer third at
  either end, so marks on the face itself don't count."""
  n = len(p)
  k = n // 3
  face = np.median(p[int(0.35 * n):int(0.65 * n)])
  t = face + 0.5 * (min(p[:k].max(), p[-k:].max()) - face)
  left, right = np.nonzero(p[:k] >= t)[0], np.nonzero(p[-k:] >= t)[0]
  return (left.max() + 1 if len(left) else 0) / n, (n - k + right.min() if len(right) else n) / n


def brick_faces(edges, cells, each):
  """Where each brick's face is within its cell, (u0, u1, v0, v1): found in each cell (each), or
  once from all of them averaged, for a regular wall whose faces are too marked to measure singly."""
  profiles = []
  for x0, x1, y0, y1 in cells:
    c = edges[int(y0):int(np.ceil(y1)) + 1, int(x0):int(np.ceil(x1)) + 1]
    h, w = c.shape
    profiles.append((c[int(0.2 * h):int(0.8 * h)].mean(0), c[:, int(0.2 * w):int(0.8 * w)].mean(1)))
  if each:
    return [face_extent(pu) + face_extent(pv) for pu, pv in profiles]
  common = [np.mean([np.interp(np.linspace(0, len(p) - 1, 128), np.arange(len(p)), p) for p in ps], 0) for ps in zip(*profiles)]
  return [face_extent(common[0]) + face_extent(common[1])] * len(cells)


def lay_bricks(a, cells, faces, nx, ny, seed, flip, margin=2.5):
  """Lays the cells out again as an exact running bond of nx bricks by ny courses that wraps both
  ways (odd courses shifted half a brick; a brick across the edge continues on the other side).
  Cells are picked at random, the least used first, never the same as a neighbour, and (flip) flipped
  at random for variety: only right if the joints were found at their middle and the light is even.
  Joins are feathered over `margin` pixels each side, in the mortar. Returns
  the colour and a mask of the brick faces (0 on mortar) as placed by `faces` (see brick_faces)."""
  rng = np.random.default_rng(seed)
  cw, ch = SIZE / nx, SIZE / ny
  num = np.zeros((SIZE, SIZE, 3), np.float32)
  den = np.zeros((SIZE, SIZE), np.float32)
  face = np.zeros((SIZE, SIZE), np.float32)
  used = np.zeros(len(cells))
  # The bricks that stand out (a big bare patch, an odd colour) are recognised when they come round
  # again: use the tenth that differ most from the typical brick only once
  means = np.array([a[int(y0):int(y1), int(x0):int(x1)].reshape(-1, 3).mean(0) for x0, x1, y0, y1 in cells])
  odd = np.abs(means - np.median(means, 0)).sum(1)
  cap = np.where(odd > np.percentile(odd, 90), 1, np.inf)
  grid = {}
  for r in range(ny):
    for col in range(nx):
      # Its neighbours so far, including those across the wrap (row 0 is below the last row)
      near = {grid.get((r, (col - 1) % nx)), grid.get((r, (col + 1) % nx)), grid.get(((r - 2) % ny, col))}
      for rr in ((r - 1) % ny, (r + 1) % ny):
        near |= {grid.get((rr, col)), grid.get((rr, (col + (r % 2)) % nx)), grid.get((rr, (col - 1 + (r % 2)) % nx))}
      order = np.lexsort((rng.random(len(cells)), used))
      k = next(int(i) for i in order if int(i) not in near and used[i] < cap[i])
      grid[(r, col)] = k
      used[k] += 1
      x0, x1, y0, y1 = cells[k]
      fu0, fu1, fv0, fv1 = faces[k]
      flip_u, flip_v = (rng.random() < 0.5, rng.random() < 0.5) if flip else (False, False)
      tx0, ty0 = (col + 0.5 * (r % 2)) * cw, r * ch
      xs = np.arange(int(np.floor(tx0 - margin)), int(np.ceil(tx0 + cw + margin)) + 1)
      ys = np.arange(int(np.floor(ty0 - margin)), int(np.ceil(ty0 + ch + margin)) + 1)
      u = (xs + 0.5 - tx0) / cw
      v = (ys + 0.5 - ty0) / ch
      su, sv = (1 - u if flip_u else u), (1 - v if flip_v else v)
      mx, my = np.meshgrid(x0 + su * (x1 - x0) - 0.5, y0 + sv * (y1 - y0) - 0.5)
      patch = cv2.remap(a, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)
      # Tent weights: 1 inside, falling to 0 over the joins, where the neighbour's rise
      wx = np.clip((xs + 0.5 - tx0 + margin) / (2 * margin), 0, 1) * np.clip((tx0 + cw + margin - xs - 0.5) / (2 * margin), 0, 1)
      wy = np.clip((ys + 0.5 - ty0 + margin) / (2 * margin), 0, 1) * np.clip((ty0 + ch + margin - ys - 0.5) / (2 * margin), 0, 1)
      w = wy[:, None] * wx[None, :]
      fu = (1 - fu1, 1 - fu0) if flip_u else (fu0, fu1)
      fv = (1 - fv1, 1 - fv0) if flip_v else (fv0, fv1)
      fx = np.clip((u - fu[0]) * cw + 0.5, 0, 1) * np.clip((fu[1] - u) * cw + 0.5, 0, 1)
      fy = np.clip((v - fv[0]) * ch + 0.5, 0, 1) * np.clip((fv[1] - v) * ch + 0.5, 0, 1)
      at = np.ix_(ys % SIZE, xs % SIZE)
      num[at] += w[..., None] * patch
      den[at] += w
      face[at] += w * (fy[:, None] * fx[None, :])
  print(f'    {len(cells)} cells for {nx * ny} places, most used {int(used.max())}x')
  return num / den[..., None], face / den


# --- Making it tile: other structures ----------------------------------------------------------------

def lay_boards(a, gaps, n):
  """Cuts the boards out from gap centre to gap centre and lays n of them side by side, at the same
  width, so the image wraps across in a gap. Uses each board once, in the order they were."""
  cuts = list(zip(gaps, gaps[1:]))[:n]
  w = SIZE / n
  out = np.zeros((a.shape[0], SIZE, 3), np.float32)
  bounds = [int(round(i * w)) for i in range(n + 1)]
  for (x0, x1), b0, b1 in zip(cuts, bounds, bounds[1:]):
    u = (np.arange(b0, b1) + 0.5 - b0) / (b1 - b0)
    mx = np.tile((x0 + u * (x1 - x0) - 0.5).astype(np.float32), (a.shape[0], 1))
    my = np.tile(np.arange(a.shape[0], dtype=np.float32)[:, None], (1, b1 - b0))
    out[:, b0:b1] = cv2.remap(a, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)
  if gaps[0] < 3 or gaps[n] > a.shape[1] - 3:
    # The outer gap was (partly) outside the image: give the wrap a copy of a gap from the middle
    mid = bounds[n // 2]
    d = np.arange(-6, 7)
    alpha = smoothstep(6, 2.5, np.abs(d))[None, :, None]
    out[:, d % SIZE] = alpha * out[:, mid + d] + (1 - alpha) * out[:, d % SIZE]
  return out


# --- Maps ------------------------------------------------------------------------------------------

def normal_map(h, strength):
  """OpenGL tangent-space normals of the height field (in pixels): x right, y up (image rows go
  down, hence the sign), wrapping round the edges like the texture will."""
  gx = ndimage.sobel(h, 1, mode='wrap') / 8
  gy = ndimage.sobel(h, 0, mode='wrap') / 8
  n = np.stack([-gx * strength, gy * strength, np.ones_like(h)], -1)
  return n / np.linalg.norm(n, axis=-1, keepdims=True)


def fit_normal(h, nz):
  """The strength that gives the normals a mean z of nz (how bumpy it looks overall), so sets made
  from different heights come out comparable with the Poly Haven ones (their brick: 0.88)."""
  lo, hi = 0.0, 1e4
  for _ in range(40):
    mid = (lo + hi) / 2
    if normal_map(h, mid)[..., 2].mean() > nz:
      lo = mid
    else:
      hi = mid
  return (lo + hi) / 2


def occlusion(h, amount):
  """Ambient occlusion from the height: how far a point is below its surroundings, at two scales."""
  cav = 0
  for sigma, wgt in ((3, 0.5), (12, 0.5)):
    c = np.maximum(blur(h, sigma) - h, 0)
    cav = cav + wgt * c / (np.percentile(c, 99.5) + 1e-6)
  return np.clip(1 - amount * np.clip(cav, 0, 1.5) ** 0.8, 0, 1)


# --- The sets --------------------------------------------------------------------------------------
# Each turns the raw image into (colour, height, roughness, metalness, occlusion amount, normal mean
# z). Heights are in pixel-ish units; only their shape matters, as the normal strength is fitted.

def rubble(a, overlap):
  """Loose, random textures: overlap-and-cut to wrap, then evened out."""
  t = wrap_cut(a, overlap)
  return delight(resize(t, SIZE, SIZE), 96, 0.7)


def brick_broken(a):
  col = rubble(a, 96)
  L = lum(col)
  # Light crumbs of mortar and brick faces catch the light, pores and gaps between chips are dark
  Ls = blur(L, 0.7)  # pixel noise would only make the normals glitter
  h = 1.0 * norm(highpass(Ls, 24)) + 0.6 * norm(highpass(Ls, 4))
  rough = 0.86 + 0.06 * norm(highpass(L, 8)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.55, 0.88


def concrete_broken(a):
  col = rubble(a, 96)
  L = lum(col)
  h = 1.0 * norm(highpass(blur(L, 0.7), 20)) + 0.5 * norm(highpass(blur(L, 0.7), 3))
  voids = smoothstep(0.25, 0.1, L)  # the air voids: deep, whatever the stone around them
  h = h - 2.5 * voids
  rough = 0.88 + 0.05 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.9


def iron_painted(a):
  col = rubble(a, 96)
  r, g, b = col[..., 0], col[..., 1], col[..., 2]
  L = lum(col)
  # Rust: orange-brown, where the paint has flaked off (so lower than the paint film around it)
  rust = smoothstep(0.04, 0.14, r - b) * smoothstep(0.08, 0.2, L)
  rust = blur(rust, 1)
  # Small bright things on the paint: highlights on its bubbles, and scratches through to bare metal
  sat = col.max(-1) - col.min(-1)
  bright = (L - ndimage.grey_opening(L, size=(7, 7), mode='wrap')) * smoothstep(0.12, 0.04, sat)
  # Scratches are the long ones: what survives opening along a line, at some angle
  lines = 0
  for angle in range(0, 180, 15):
    k = np.zeros((15, 15), np.uint8)
    t = np.deg2rad(angle)
    cv2.line(k, (int(round(7 - 7 * np.cos(t))), int(round(7 - 7 * np.sin(t)))), (int(round(7 + 7 * np.cos(t))), int(round(7 + 7 * np.sin(t)))), 1)
    lines = np.maximum(lines, ndimage.grey_opening(bright, footprint=k.astype(bool), mode='wrap'))
  scratch = smoothstep(0.06, 0.16, lines)
  h = -2.0 * rust + 0.5 * norm(highpass(blur(L, 0.6), 3)) * (1 - rust) + 0.3 * norm(highpass(L, 12))
  # The bubbles' highlights are the light of the photo, not the colour of the paint: the normals and
  # the gloss make them now
  col = np.clip(col - 0.8 * np.clip(bright - lines, 0, None)[..., None] * (1 - rust[..., None]), 0, 1)
  rough = 0.52 + 0.33 * rust - 0.12 * scratch + 0.04 * norm(highpass(L, 6)).clip(-2, 2) / 2
  metal = 0.85 * scratch
  return col, h, rough, metal, 0.5, 0.95


def wood_painted(a):
  L = lum(a)
  dark = -L.mean(0)
  gaps = peaks(dark, period(dark - ndimage.uniform_filter1d(dark, 201), 60, 400))
  print(f'    board gaps at {np.round(gaps).astype(int).tolist()}')
  # The outermost boards run off the image a few pixels short of their outer gaps: take them anyway,
  # a board's width out (lay_boards puts a gap back on the wrap)
  span = np.diff(gaps).mean()
  if gaps[0] > 0.1 * span:
    gaps = [gaps[0] - span] + gaps
  if gaps[-1] < a.shape[1] - 0.1 * span:
    gaps = gaps + [gaps[-1] + span]
  boards = len(gaps) - 1
  t = lay_boards(a, gaps, boards)
  t = wrap_rows(t, 96, closed=True)
  col = delight(resize(t, SIZE, SIZE), 128, 0.6)
  L = lum(col)
  paint = smoothstep(0.55, 0.7, blur(L, 0.7))
  # The gaps between the boards, now at known places: the wrap and every 1/boards across
  x = (np.arange(SIZE) + 0.5) / SIZE * boards
  edge = np.abs(x - np.round(x)) * SIZE / boards  # pixels from the nearest gap centre
  gap = smoothstep(7, 2, edge)[None, :] * np.ones((SIZE, 1))
  grain = ndimage.gaussian_filter(highpass(L, 6), (3, 0.6), mode='wrap')  # along the grain
  h = 1.2 * paint + 0.4 * norm(grain) * (1 - paint) - 4 * gap + 0.15 * norm(highpass(L, 2)) * paint
  rough = 0.68 + 0.14 * (1 - paint) + 0.1 * gap
  return col, h, rough, 0, 0.55, 0.93


def bricks(a, kind, seed, flip):
  """Brick walls: re-laid as an exact running bond, 9 bricks by 28 courses (a 2 m tile of 21.5 x
  6.5 cm bricks with 1 cm joints: 22.2 x 7.1 cm a brick)."""
  a = delight(a, 160, 0.8)  # so cells from either end of the wall match where they meet
  L = lum(a)
  if kind == 'light':  # light mortar between dark bricks
    joints = edges = blur(norm(highpass(L, 20)), 1.5, False)
  else:
    # Painted over: the mortar is the colour of the faces, the joint shows as the shade under the
    # brick above and the lit edge of the one below. Neither is the middle of the joint, but the
    # band where the wall differs from a flat face is centred on it.
    joints = norm(blur(np.abs(highpass(L, 20)), 4, False))
    edges = norm(blur(np.abs(highpass(L, 20)), 1.2, False))  # sharper, for where the faces end
  cells, px, py = brick_cells(a, joints, (20, 160), (60, 400))
  cells = [refine_cell(joints, c) for c in cells]
  print(f'    brick {px:.1f} px, course {py:.1f} px, {px / py:.2f}:1')
  faces = brick_faces(edges, cells, each=kind == 'light')
  col, face = lay_bricks(a, cells, faces, 9, 28, seed, flip)
  col = delight(col, 128, 0.4)
  return col, face


def brick_brown(a):
  col, face = bricks(a, 'light', 5, flip=True)  # joints found at the middle of the light mortar
  L = lum(col)
  bevel = blur(face, 1.2)
  h = 5 * bevel ** 0.6 + 0.35 * norm(highpass(L, 3)) + 0.3 * norm(highpass(L, 10)) * bevel
  rough = 0.82 + 0.08 * (1 - face) + 0.04 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.6, 0.89


def brick_painted(a):
  col, face = bricks(a, 'shaded', 6, flip=False)  # its light comes from above: no flipping
  L = lum(col)
  chip = smoothstep(0.08, 0.2, col[..., 0] - col[..., 2]) * face  # bare brick where paint chipped off
  bevel = blur(face, 1.2)
  h = 5 * bevel ** 0.6 - 0.8 * blur(chip, 0.8) + 0.25 * norm(highpass(L, 3)) * (1 - chip)
  rough = 0.7 + 0.15 * chip + 0.15 * (1 - face)
  return col, h, rough, 0, 0.6, 0.9


def sidewalk(a):
  """Cropped from one joint to the joint two flags further on, both ways: 2 x 2 flags, 3 m."""
  L = lum(a)
  crop = []
  for axis in (0, 1):  # profile down the columns (x), then along the rows (y)
    dark = -L.mean(axis)
    js = peaks(dark, period(dark - ndimage.uniform_filter1d(dark, 301), 200, 1200))
    print(f'    joints {"xy"[axis]}: {np.round(js).astype(int).tolist()}')
    # The two-flag span furthest from the image's edges
    mid = len(a) / 2
    i = min(range(len(js) - 2), key=lambda i: abs((js[i] + js[i + 2]) / 2 - mid))
    crop.append((js[i], js[i + 2]))
  (x0, x1), (y0, y1) = crop
  mx, my = np.meshgrid(x0 + (np.arange(SIZE) + 0.5) / SIZE * (x1 - x0) - 0.5, y0 + (np.arange(SIZE) + 0.5) / SIZE * (y1 - y0) - 0.5)
  t = cv2.remap(a, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR)  # about 1:1, no shrinking to filter
  col = delight(t, 128, 0.6)
  L = lum(col)
  # Joints at the wrap and through the middle, both ways
  x = (np.arange(SIZE) + 0.5) / SIZE * 2
  d = np.abs(x - np.round(x)) * SIZE / 2  # pixels from the nearest joint centre
  joint = np.maximum(smoothstep(9, 2, d)[None, :], smoothstep(9, 2, d)[:, None])
  gum = smoothstep(0.32, 0.22, L) * (1 - joint)
  h = -6 * joint + 0.25 * norm(highpass(L, 2)) + 0.3 * norm(highpass(L, 12)) + 0.8 * blur(gum, 1)
  rough = 0.86 - 0.18 * gum + 0.04 * joint + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.965


SETS = {
  'gen_brick_broken': brick_broken,
  'gen_concrete_broken': concrete_broken,
  'gen_iron_painted': iron_painted,
  'gen_wood_painted': wood_painted,
  'gen_brick_brown': brick_brown,
  'gen_brick_painted': brick_painted,
  'gen_sidewalk': sidewalk,
}

# Which take of each set to use (assets-src/textures/raw/<set>/<take>.png)
TAKES = {}


# --- Previews --------------------------------------------------------------------------------------

def lit(col, n, ao):
  """A quick render: lit from the upper left, a little ambient, in linear light."""
  l = np.array([-0.55, 0.55, 0.63], np.float32)
  l /= np.linalg.norm(l)
  shade = 0.18 * ao + 0.95 * np.clip(n @ l, 0, 1) / l[2]
  return linear_to_srgb(srgb_to_linear(col) * shade[..., None] * 0.75)


def previews(name, col, lit_img):
  PREVIEWS.mkdir(parents=True, exist_ok=True)
  for tag, img in (('2x2', col), ('lit_2x2', lit_img)):
    tiled = np.tile(resize(img, SIZE // 2, SIZE // 2), (2, 2, 1))
    Image.fromarray(to_srgb8(tiled)).save(PREVIEWS / f'{name}_{tag}.jpg', quality=88)
  # Full size, where four tiles meet: colour and lit side by side
  c = SIZE // 4
  crops = [np.tile(img, (2, 2, 1))[SIZE - c:SIZE + c, SIZE - c:SIZE + c] for img in (col, lit_img)]
  Image.fromarray(to_srgb8(np.concatenate(crops, 1))).save(PREVIEWS / f'{name}_seam.jpg', quality=90)


def process(name):
  take = TAKES.get(name, 0)
  print(f'{name} (take {take})')
  raw = RAW / name / f'{take}.png'
  a = load(raw)
  print(f'    raw {a.shape[1]}x{a.shape[0]}, seams {seam_score(a)}')
  col, h, rough, metal, ao_amount, nz = SETS[name](a)
  assert col.shape[:2] == (SIZE, SIZE), col.shape
  h = np.asarray(h, np.float32)
  strength = fit_normal(h, nz)
  n = normal_map(h, strength)
  ao = occlusion(h, ao_amount)
  arm = np.stack([ao, np.clip(rough, 0.04, 1), np.clip(np.broadcast_to(metal, h.shape), 0, 1)], -1)
  OUT.mkdir(parents=True, exist_ok=True)
  qs = [save_webp(col, OUT / f'{name}_diff_1k.webp'), save_webp(n * 0.5 + 0.5, OUT / f'{name}_nor_gl_1k.webp'), save_webp(arm, OUT / f'{name}_arm_1k.webp')]
  sizes = [round((OUT / f'{name}_{m}_1k.webp').stat().st_size / 1024) for m in ('diff', 'nor_gl', 'arm')]
  print(f'    seams {seam_score(col)}, normal strength {strength:.2f}, ao {ao.mean():.2f}, rough {arm[..., 1].mean():.2f}, '
        f'metal {arm[..., 2].mean():.3f}, sizes {sizes} KB (q {qs})')
  previews(name, col, lit(col, n, ao))
  (PREVIEWS / f'{name}.json').write_text(json.dumps({'take': take, 'normal_strength': round(strength, 3)}, indent=2))


def generic(a, overlap=96, rough=0.85, metal=0.0, ao_amount=0.5, nz=0.93, delit=(160, 0.6)):
  """Any set that's a texture without a pattern to keep (stone, plaster, ground, rust): the wrap
  joined where the opposite edges match, the light evened out, maps from the colour."""
  col = wrap_cut(delight(a, *delit), overlap)
  col = resize(col, SIZE, SIZE)
  h = norm(highpass(lum(col), 24))
  return col, h, np.full(h.shape, rough, np.float32), metal, ao_amount, nz


if PACK:
  # A pack's own processing: scripts/assets/packs/<pack>/textures.py runs with everything above in
  # scope and sets SETS (name -> function of the raw image, as above; `generic` for plain sets)
  # and TAKES
  plugin = ROOT / f'scripts/assets/packs/{PACK}/textures.py'
  SETS = {}
  if plugin.exists():
    exec(compile(plugin.read_text(), str(plugin), 'exec'), globals())


if __name__ == '__main__':
  for name in sys.argv[1:] or SETS:
    process(name)
