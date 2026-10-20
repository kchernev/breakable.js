# Sun Temple's processing (run by scripts/assets/process-textures.py with PACK=temple, which execs
# this with its helpers in scope): each raw image (textures.mjs) made to wrap, evened out, brought to
# the colour the design asks for, and its maps derived. One tile is the frame size in textures.mjs,
# except the roof, which is re-laid as 4 x 3 tiles (2.2 m).
#
#   PACK=temple python3 -I scripts/assets/process-textures.py [set ...]


def lift(col, target, deep=False):
  """A curve per channel that brings its mean to `target` (sRGB 0-1) without clipping the
  highlights, as scaling would: a gamma, or (deep) 1 - (1 - x)^p, which raises the mid-tones as much
  but keeps the darkest shade dark (the gaps between leaves have no occlusion map to darken them)."""
  curve = (lambda x, p: 1 - (1 - x) ** p) if deep else (lambda x, p: x ** (1 / p))
  out = np.empty_like(col)
  for c in range(3):
    x = np.clip(col[..., c], 1e-4, 1 - 1e-4)
    lo, hi = 0.2, 5.0
    for _ in range(40):
      p = np.sqrt(lo * hi)
      if curve(x[::4, ::4], p).mean() < target[c]:
        lo = p
      else:
        hi = p
    out[..., c] = curve(x, np.sqrt(lo * hi))
  return out


def regrade(col, target, keep, deep=False):
  """Keeps `keep` of the colour's saturation and moves its mean to `target`: the image model's colours
  drift, and the sun and the material's colour warm it further."""
  grey = lum(col)[..., None]
  return lift(np.clip(grey + keep * (col - grey), 0, 1), target, deep)


def loose(a, overlap, sigma, strength):
  """Made to wrap (overlap and cut at the image's own size), shrunk to the tile, evened out."""
  return delight(resize(wrap_cut(a, overlap), SIZE, SIZE), sigma, strength)


def dips(x, sigma, lo, hi):
  """Small spots darker than what's round them (pits, pores, gaps between leaves), 0..1."""
  return smoothstep(lo, hi, blur(x, sigma) - x)


def marble(a):
  """Weathered Pentelic marble: sugary grain, pits, honey patina. Close to neutral white: the
  material's colour and the sun warm it, and much warmer reads as limestone. The patina and veins
  are colour only, so the height comes from the brightest channel, which they barely darken."""
  col = regrade(loose(a, 144, 160, 0.45), (0.865, 0.86, 0.84), 0.55)
  m = blur(col.max(-1), 0.6)
  pits = dips(m, 3, 0.03, 0.1)
  # Smoother than the limestone, so the two read apart: shallow pits, little grain
  h = 0.5 * norm(highpass(m, 3)) + 0.4 * norm(highpass(m, 20)) - 1.0 * blur(pits, 0.6)
  patina = smoothstep(0.08, 0.2, col[..., 0] - col[..., 2])
  rough = 0.6 + 0.12 * pits + 0.05 * patina + 0.03 * norm(highpass(m, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.4, 0.965


def marble_broken(a):
  """Fresh fracture of marble (and, tinted ochre, of limestone): facets at two scales; the bright
  crystal faces a little glossier."""
  col = regrade(loose(a, 96, 80, 0.6), (0.9, 0.9, 0.895), 0.25)
  Ls = blur(lum(col), 0.7)
  h = 1.0 * norm(highpass(Ls, 24)) + 0.6 * norm(highpass(Ls, 4))
  glint = smoothstep(0.03, 0.1, highpass(Ls, 3))
  rough = 0.5 - 0.1 * glint
  return col, h, rough, 0, 0.5, 0.88


def limestone(a):
  """Poros: a porous shelly limestone, its pores and holes deep."""
  col = regrade(loose(a, 144, 160, 0.55), (0.84, 0.775, 0.635), 0.8)
  L = lum(col)
  pits = dips(L, 4, 0.05, 0.16)
  h = 0.5 * norm(highpass(L, 24)) + 0.5 * norm(highpass(blur(L, 0.7), 3)) - 1.8 * blur(pits, 0.7)
  rough = 0.86 + 0.08 * pits + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.92


def ground(a):
  """Dry grass, thyme, soil and pebbles from above: lighter than it came, a straw and ochre ground
  under a high sun. Pebbles stand up, the shade between tufts is low."""
  col = regrade(loose(a, 192, 100, 0.5), (0.67, 0.585, 0.41), 1.0)
  sat = col.max(-1) - col.min(-1)
  pale = smoothstep(0.58, 0.72, blur(lum(col), 0.7)) * smoothstep(0.14, 0.06, sat)
  # The few bigger pale rock spots come round every 4 m as a lattice: most of their contrast with the
  # ground round them goes (pebbles are too small to be caught; the scenery mixes in real bedrock)
  spots = smoothstep(0.15, 0.4, blur(pale, 8))[..., None]
  col = np.clip(col - 0.6 * spots * (blur(col, 2) - blur(col, 40)), 0, 1)
  L = lum(col)
  Ls = blur(L, 0.7)
  sat = col.max(-1) - col.min(-1)
  pebbles = smoothstep(0.58, 0.72, Ls) * smoothstep(0.14, 0.06, sat)
  # Little of the finest scale: thin raised stalks light up as a web of cracks
  h = 0.45 * norm(highpass(Ls, 3)) + 0.8 * norm(highpass(Ls, 16)) + 1.5 * blur(pebbles, 1)
  rough = 0.95 - 0.1 * pebbles
  return col, h, rough, 0, 0.6, 0.9


def earth(a):
  """Terra rossa under the dry grass, as a crater's sides and a clod's breaks show it: dry crumbs and
  clods of soil (take 1), the red taken down toward a dusty brown (in the noon sun the image's red
  read as broken roof tiles), the clods standing up and the gaps between them deep."""
  col = regrade(loose(a, 96, 100, 0.5), (0.5, 0.4, 0.31), 0.55)
  Ls = blur(lum(col), 0.7)
  gaps = dips(Ls, 3, 0.03, 0.12)
  h = 0.6 * norm(highpass(Ls, 3)) + 0.9 * norm(highpass(Ls, 12)) - 1.2 * blur(gaps, 0.7)
  rough = 0.95 + 0.03 * gaps
  return col, h, rough, 0, 0.6, 0.9


def fill(a):
  """The rubble bed under the court's flags: marble and limestone chips in lime, the chips proud and
  the voids between them deep."""
  col = regrade(loose(a, 96, 100, 0.5), (0.72, 0.69, 0.62), 0.8)
  Ls = blur(lum(col), 0.7)
  voids = dips(Ls, 3, 0.08, 0.2)
  h = 0.9 * norm(highpass(Ls, 10)) + 0.4 * norm(highpass(Ls, 3)) - 1.5 * blur(voids, 0.7)
  rough = 0.9 + 0.05 * voids
  return col, h, rough, 0, 0.6, 0.9


def foliage(a):
  """Olive leaves, lifted to a light, slightly blue grey-green that the trees' tints turn dark green
  (cypress) or silvery (olive; the tint is yellowish and the sun warm, so the map leans cool). The
  gaps between clumps stay dark and deep: that is what reads as leaves."""
  col = regrade(loose(a, 96, 96, 0.4), (0.52, 0.58, 0.54), 0.6, deep=True)
  Ls = blur(lum(col), 0.7)
  gaps = smoothstep(0.3, 0.12, blur(Ls, 1.5))
  h = 1.0 * norm(highpass(Ls, 10)) + 0.5 * norm(highpass(Ls, 2)) - 1.2 * gaps
  rough = 0.78 + 0.2 * gaps
  return col, h, rough, 0, 0.8, 0.85


# --- The roof: pan and cover tiles, re-laid on an exact grid -------------------------------------

ROOF = (4, 3)  # tiles across (0.55 m) and courses down (0.733 m) in the 2.2 m tile


def extend(xs, per, length):
  """Lines one period apart, kept inside the image and carried on to its edges a period at a time
  (the outermost fall too near the edge to be found; each cell finds its own lines again)."""
  xs = [x for x in xs if 4 <= x <= length - 5]
  while xs[0] - per >= 4:
    xs.insert(0, xs[0] - per)
  while xs[-1] + per <= length - 5:
    xs.append(xs[-1] + per)
  return xs


def darkest(profile, x, reach):
  """The darkest point of a profile within `reach` of x (a gap or shadow line), to the sub-pixel."""
  lo, hi = max(0, int(round(x - reach))), min(len(profile) - 1, int(round(x + reach)))
  p = -ndimage.gaussian_filter1d(profile, 1.0)
  return lo + parabola(p[lo:hi + 1], int(np.argmax(p[lo:hi + 1])))


def roof_cells(a):
  """Finds the tiles: the gap lines down both sides of each cover tile, and the shadow line under the
  end of each course. A cell runs from the gap where a pan begins (the right of one cover tile) to
  the right of the next cover tile, and from course line to course line: one pan, one cover tile.
  Returns the cells (x0, x1, y0, y1), the period across and down, and the cover tile's width."""
  L = lum(a)
  h, w = L.shape
  # The cover tiles' edges are the strongest vertical edges
  edges = ndimage.gaussian_filter1d(np.abs(ndimage.sobel(L, 1)).mean(0), 25)
  px = period(edges - ndimage.uniform_filter1d(edges, 301), 200, 700)
  xs = extend(comb(edges, px, 0.15), px, w)
  # The averaged cross-section round those: its two darkest lines are the gaps either side of a
  # cover tile, and the cover tile is the narrower stretch between them (around the period)
  off = np.arange(-int(px / 2), int(px / 2) + 1)
  prof = ndimage.gaussian_filter1d(np.mean([L[:, np.clip(np.round(x + off).astype(int), 0, w - 1)].mean(0) for x in xs], 0), 1.5)
  i = int(np.argmin(prof))
  j = int(np.argmin(np.where(np.abs(off - off[i]) > 0.15 * px, prof, np.inf)))
  left, right = sorted((float(off[i]), float(off[j])))
  if right - left > px / 2:
    left, right = right, left + px
  cover = right - left
  starts = extend([x + right for x in xs], px, w)
  # The course lines: dark across the pans (the cover tiles' own joints are a little off them)
  pans = np.zeros(w, bool)
  for x in starts:
    pans[max(0, int(x + 0.1 * px)):min(w, int(x + px - cover - 0.1 * px))] = True
  rows = ndimage.gaussian_filter1d(L[:, pans].mean(1), 2)
  py = period(-rows + ndimage.uniform_filter1d(rows, 301), 200, 700)
  ys = extend(comb(-rows, py, 0.15), py, h)
  print(f'    pan {px:.1f} px across, course {py:.1f} px, cover tile {cover:.1f} px; {len(starts) - 1} x {len(ys) - 1} cells')
  cells = []
  for x0, x1 in zip(starts, starts[1:]):
    if not 0.85 * px < x1 - x0 < 1.15 * px:
      continue
    # Each line again where this tile is (rows and gaps wander a little)
    down = L[:, int(x0 + 0.1 * px):int(x1 - cover - 0.1 * px)].mean(1)
    for y0, y1 in zip(ys, ys[1:]):
      across = L[int(y0 + 0.2 * (y1 - y0)):int(y1 - 0.2 * (y1 - y0))].mean(0)
      cells.append((darkest(across, x0, 12), darkest(across, x1, 12), darkest(down, y0, 15), darkest(down, y1, 15)))
  return cells, px, py, cover


def lay_grid(a, cells, nx, ny, shift, seed, margin=2.0):
  """Lays one cell in each place of an nx x ny grid that wraps both ways (the grid moved `shift`
  pixels right), each cell stretched to fit and used once, joins feathered over `margin` pixels each
  side. The cells that differ most from the typical one are left out, and the rest drawn halfway to
  it: in a 2.2 m tile a dark tile would come round as a lattice of dark tiles."""
  rng = np.random.default_rng(seed)
  cw, ch = SIZE / nx, SIZE / ny
  means = np.array([a[int(y0) + 8:int(y1) - 8, int(x0) + 8:int(x1) - 8].reshape(-1, 3).mean(0) for x0, x1, y0, y1 in cells])
  typical = np.median(means, 0)
  odd = np.abs(means - typical).sum(1)
  keep = np.argsort(odd)[:max(nx * ny, int(0.7 * len(cells)))]
  pick = rng.permutation(keep)[:nx * ny]
  num = np.zeros((SIZE, SIZE, 3), np.float32)
  den = np.zeros((SIZE, SIZE), np.float32)
  for k, (r, c) in zip(pick, [(r, c) for r in range(ny) for c in range(nx)]):
    x0, x1, y0, y1 = cells[k]
    tx0, ty0 = c * cw + shift, r * ch
    xs = np.arange(int(np.floor(tx0 - margin)), int(np.ceil(tx0 + cw + margin)) + 1)
    ys = np.arange(int(np.floor(ty0 - margin)), int(np.ceil(ty0 + ch + margin)) + 1)
    u = (xs + 0.5 - tx0) / cw
    v = (ys + 0.5 - ty0) / ch
    mx, my = np.meshgrid(x0 + u * (x1 - x0) - 0.5, y0 + v * (y1 - y0) - 0.5)
    patch = cv2.remap(a, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)
    patch = patch + 0.5 * (typical - means[k])
    wx = np.clip((xs + 0.5 - tx0 + margin) / (2 * margin), 0, 1) * np.clip((tx0 + cw + margin - xs - 0.5) / (2 * margin), 0, 1)
    wy = np.clip((ys + 0.5 - ty0 + margin) / (2 * margin), 0, 1) * np.clip((ty0 + ch + margin - ys - 0.5) / (2 * margin), 0, 1)
    wgt = wy[:, None] * wx[None, :]
    at = np.ix_(ys % SIZE, xs % SIZE)
    num[at] += wgt[..., None] * patch
    den[at] += wgt
  print(f'    {len(cells)} cells, {len(keep)} kept, {nx * ny} laid')
  return np.clip(num / den[..., None], 0, 1)


def roof_tiles(a):
  """Greek terracotta roof, 4 tiles across by 3 courses (2.2 m): cover tiles centred on the wrap and
  every quarter across, course lines on the wrap and every third down, so the 1.1 x 0.733 m panels
  (two tiles, one course) start and end where the real tiles do. The image's top is up the slope.
  The height is built from that layout: a gabled cover tile, and each course rising toward its
  lower end, which lies on the course below, then dropping at the course line."""
  a = delight(a, 300, 0.5)
  cells, px, py, cover = roof_cells(a)
  nx, ny = ROOF
  cw, ch = SIZE / nx, SIZE / ny
  # Shrunk to about the grid's own scale first (remap doesn't filter), then laid
  sx, sy = cw / px, ch / py
  small = resize(a, int(round(a.shape[1] * sx)), int(round(a.shape[0] * sy)))
  cells = [(x0 * sx, x1 * sx, y0 * sy, y1 * sy) for x0, x1, y0, y1 in cells]
  half = cover * sx / 2
  col = lay_grid(small, cells, nx, ny, half, seed=3)
  L = lum(col)
  # Distance across to the nearest cover tile's centre, and how far down its course each row is
  x = np.arange(SIZE) + 0.5
  d = np.abs(x - cw * np.round(x / cw))
  t = ((np.arange(SIZE) + 0.5) % ch) / ch
  ridge = 0.85 * cover * sx / 2 * np.clip(1 - d / half, 0, 1)  # about 40 degree sides
  gap = smoothstep(4, 1, np.abs(d - half))
  step = 0.03 * ch * smoothstep(0, 0.012, t) * t  # a tile's thickness over its length, then the drop
  h = ridge[None, :] + step[:, None] - 3 * gap[None, :]
  h = blur(h, 1.2) + 0.5 * norm(highpass(blur(L, 0.6), 3)) + 0.4 * norm(highpass(L, 12))
  sat = col.max(-1) - col.min(-1)
  lichen = smoothstep(0.25, 0.12, sat) * smoothstep(0.3, 0.45, L)
  rough = 0.8 + 0.1 * lichen + 0.08 * gap[None, :]
  # Physical normals for the layout's heights (pixels both ways), whatever the detail adds
  nz = float(normal_map(h, 1.0)[..., 2].mean())
  return col, h, rough, 0, 0.6, nz


SETS = {
  'temple_marble': marble,
  'temple_marble_broken': marble_broken,
  'temple_limestone': limestone,
  'temple_roof_tiles': roof_tiles,
  'temple_ground': ground,
  'temple_earth': earth,
  'temple_fill': fill,
  'temple_foliage': foliage,
}

# The earth's take 1: take 0's stony soil read as speckled stone (textures.mjs)
TAKES = {'temple_earth': 1}
