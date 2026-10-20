# Neon Alley's texture sets: how each raw image (scripts/assets/packs/neon/textures.mjs) is made to
# tile and turned into maps. Runs inside scripts/assets/process-textures.py, with its helpers in
# scope:
#
#   PACK=neon python3 -I scripts/assets/process-textures.py [set ...]


def joints(dark, lo, hi):
  """Centres of the joints along a profile that is darkest on them (the grout is a few pixels wide
  and can show as two lines, so the profile is smoothed first)."""
  p = ndimage.gaussian_filter1d(dark - ndimage.uniform_filter1d(dark, 301), 2.5)
  return comb(p, period(p, lo, hi), refine=0.15)


def grid_crop(a, js_x, js_y, n):
  """The n x n cells around the image's centre, from joint centre to joint centre both ways, laid
  on an exact grid of SIZE / n: each cell is stretched to fit, so joints that are a pixel or two off
  come out straight and evenly spaced, and the wrap falls in the middle of a joint."""
  def pick(js, length):
    i = min(range(len(js) - n), key=lambda i: abs((js[i] + js[i + n]) / 2 - length / 2))
    return np.array(js[i:i + n + 1])
  jx, jy = pick(js_x, a.shape[1]), pick(js_y, a.shape[0])
  # At about the image's own scale first (remap doesn't filter), then shrunk
  full = int(round(max(jx[-1] - jx[0], jy[-1] - jy[0])))
  k = (np.arange(full) + 0.5) / full * n
  sx = np.interp(k, np.arange(n + 1), jx) - 0.5
  sy = np.interp(k, np.arange(n + 1), jy) - 0.5
  mx, my = np.meshgrid(sx, sy)
  return resize(cv2.remap(a, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR), SIZE, SIZE)


def streaks(a, strength, sigma=(48, 10)):
  """Tones down vertical streaks (rain, stains, mould) that would mark out the repeat: evens out
  the light over a tall, narrow window, leaving the fine grain and small marks alone."""
  low = ndimage.gaussian_filter(lum(a), sigma, mode='wrap')
  return np.clip(a * ((low.mean() / np.maximum(low, 1e-3)) ** strength)[..., None], 0, 1)


def tile(a):
  """Glazed wall tiles, 10 x 10 cut from the 12 x 12 asked for: a 1 m set of 10 cm tiles."""
  L = lum(a)
  js_x = joints(-L.mean(0), 80, 200)
  js_y = joints(-L.mean(1), 80, 200)
  print(f'    joints x {np.round(js_x).astype(int).tolist()}')
  print(f'    joints y {np.round(js_y).astype(int).tolist()}')
  col = delight(grid_crop(a, js_x, js_y, 10), 256, 0.5)
  # Distance to the nearest joint centre, in pixels (joints at the wrap and every SIZE / 10)
  cell = SIZE / 10
  u = (np.arange(SIZE) + 0.5) / cell
  d = np.abs(u - np.round(u)) * cell
  dist = np.minimum(d[None, :], d[:, None])
  # Each tile's shade halfway to the typical one: a few much darker tiles would mark out the repeat
  idx = np.floor(u).astype(int)
  cid = idx[:, None] * 10 + idx[None, :]
  inner = dist > 6
  means = np.array([col[(cid == c) & inner].mean(0) for c in range(100)])
  shift = (np.median(means, 0) - means) * 0.5
  col = np.clip(col + shift[cid] * smoothstep(3, 6, dist)[..., None], 0, 1)
  L = lum(col)
  # The grout's half width, from the colour: where the averaged cross-section turns tile-bright
  prof = np.array([L[:, (np.round(np.arange(1, 10) * cell) + o).astype(int) % SIZE].mean() for o in range(-12, 13)])
  face, floor = np.median(L), prof.min()
  half = max(2.0, np.count_nonzero(prof < floor + 0.5 * (face - floor)) / 2)
  grout = smoothstep(half + 1.0, half - 1.0, dist)
  # A rounded edge on each tile: rising over 2.5 px from the grout to the flat glaze
  edge = smoothstep(half - 0.5, half + 2.5, dist)
  print(f'    grout half width {half:.1f} px')
  # Dirt on the glaze: darker than the tile around it (streaks, grime), not the tile's own shade
  shade = ndimage.median_filter(L, size=21, mode='wrap')
  grime = smoothstep(0.02, 0.10, shade - L) * (1 - grout)
  h = 3.0 * np.sqrt(edge) + 0.15 * norm(highpass(blur(L, 0.8), 3)) * grout - 0.3 * grime
  rough = 0.16 + 0.15 * grime + (0.8 - 0.16) * grout
  return col, h, rough, 0, 0.5, 0.95


def concrete(a):
  """Weathered cast concrete: water stains are smoother (wet), efflorescence rougher (powdery). The
  streaks and patches are toned down a little, as they mark out the repeat."""
  col = streaks(resize(wrap_cut(delight(a, 160, 0.6), 96), SIZE, SIZE), 0.6, (24, 5))
  L = lum(col)
  around = blur(L, 24)
  stain = smoothstep(0.0, 0.08, around.mean() - around)
  bloom = smoothstep(0.04, 0.12, blur(L, 3) - around)
  pits = smoothstep(0.08, 0.16, blur(L, 6) - L)
  h = 0.6 * norm(highpass(blur(L, 0.7), 4)) + 0.25 * norm(highpass(L, 24)) - 2.0 * blur(pits, 0.7)
  rough = 0.86 - 0.12 * stain + 0.06 * bloom + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.93


def render(a):
  """Painted render: the trowelled grain, with the flaked patches below the paint around them. The
  mould streaks are toned down a little, as they mark out the repeat."""
  col = streaks(resize(wrap_cut(delight(a, 160, 0.6), 96), SIZE, SIZE), 0.45)
  L = lum(col)
  r, g, b = col[..., 0], col[..., 1], col[..., 2]
  # Bare cement: grey and a step darker than the paint, in small patches with sharp edges
  bare = smoothstep(0.06, 0.12, blur(L, 20) - blur(L, 1.5)) * smoothstep(0.03, 0.0, np.abs(r - b))
  bare = blur(ndimage.grey_opening(bare, size=(3, 3), mode='wrap'), 0.8)
  mould = smoothstep(0.01, 0.04, g - b) * smoothstep(0.05, 0.15, blur(L, 20) - L)
  h = 0.8 * norm(highpass(blur(L, 0.7), 3)) * (1 - bare) + 0.2 * norm(highpass(L, 20)) - 1.5 * bare
  rough = 0.88 - 0.06 * mould + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.93


def wet(a):
  """The asphalt made to tile, and where its puddles are: where the image is plain (low local
  variance) and a little dark."""
  t = resize(wrap_cut(a, 96), SIZE, SIZE)
  L = lum(t)
  m = blur(L, 4)
  sd = np.sqrt(np.maximum(blur(L * L, 4) - m * m, 0))
  puddle = smoothstep(0.035, 0.018, blur(sd, 3)) * smoothstep(0.32, 0.25, blur(L, 12))
  puddle = smoothstep(0.2, 0.8, blur(ndimage.grey_opening(puddle, size=(5, 5), mode='wrap'), 2))
  return t, L, puddle


def asphalt_dry(a):
  """The asphalt with its puddles filled in, for puddles placed by the shader (the mask at another
  scale, times a noise), since puddles that repeat every 4 m read as a pattern down the alley. Each
  puddle is filled with asphalt copied from elsewhere in the image: from the offset where the
  puddle's shape covers the fewest puddles and dark repair patches, feathered in. The puddle mask is
  saved on its own (neon_asphalt_puddle_1k.webp). The raw is neon_asphalt's (a link): the asphalt
  with its puddles in the maps repeated every 4 m down the alley, so only the mask of it is used."""
  t, L, puddle = wet(a)
  print(f'    puddles cover {puddle.mean():.0%}')
  OUT.mkdir(parents=True, exist_ok=True)
  save_webp(np.repeat(puddle[..., None], 3, -1), OUT / 'neon_asphalt_puddle_1k.webp')
  bad = np.maximum(puddle, smoothstep(0.25, 0.23, blur(L, 10)))
  hole = ndimage.binary_dilation(puddle > 0.1, iterations=8)
  labels, n = ndimage.label(hole)
  col = t.copy()
  steps = range(0, SIZE, 16)
  for i in range(1, n + 1):
    mask = labels == i
    ys, xs = np.nonzero(mask)
    score = lambda d: bad[(ys + d[0]) % SIZE, (xs + d[1]) % SIZE].mean()
    dy, dx = min(((y, x) for y in steps for x in steps if (y, x) != (0, 0)), key=score)
    w = blur(mask.astype(np.float32), 3)[..., None]
    col = col * (1 - w) + np.roll(col, (-dy, -dx), (0, 1)) * w
    bad = bad * (1 - w[..., 0])  # filled: a good source from now on
  print(f'    {n} puddles filled')
  col = delight(col, 200, 0.5)
  Ls = blur(lum(col), 0.6)
  h = 0.8 * norm(highpass(Ls, 3)) + 0.4 * norm(highpass(Ls, 12))
  rough = 0.42 + 0.03 * norm(highpass(Ls, 3)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.92


def shutter(a):
  """A roller shutter: slats re-laid seam to seam (as boards, turned on their side), wrapped along
  their length, the baked shading of the corrugation mostly taken out (the normals put it back),
  and the height from the slat's shape rather than from the colour."""
  t = a.transpose(1, 0, 2)  # slats run down the columns now
  L = lum(t)
  dark = -L.mean(0)
  gaps = peaks(ndimage.gaussian_filter1d(dark, 2.5), period(dark - ndimage.uniform_filter1d(dark, 201), 50, 200))
  print(f'    slat seams at {np.round(gaps).astype(int).tolist()}')
  n = len(gaps) - 1  # whole slats only: a part-slat at the edge would be stretched
  t = lay_boards(t, gaps, n)
  t = wrap_rows(t, 96, closed=True)
  t = resize(t, SIZE, SIZE).transpose(1, 0, 2)  # slats across again
  # Position within a slat, 0 at a seam to 1 at the next (seams at the wrap and every SIZE / n)
  s = ((np.arange(SIZE) + 0.5) / SIZE * n) % 1
  L = lum(t)
  shade = L.mean(1)
  shade = np.array([shade[np.abs(s - v) < 0.5 / (SIZE / n)].mean() for v in s])  # the mean slat, repeated
  col = np.clip(t * ((shade.mean() / shade) ** 0.7)[:, None, None], 0, 1)
  col = delight(col, 160, 0.5)
  L = lum(col)
  r, g, b = col[..., 0], col[..., 1], col[..., 2]
  rust = blur(smoothstep(0.05, 0.14, r - b) * smoothstep(0.08, 0.2, L), 0.8)
  paint = blur(smoothstep(0.008, 0.022, g - (r + b) / 2), 1.5) * (1 - rust)
  seam = smoothstep(0.06, 0.02, np.minimum(s, 1 - s))  # the hook, a dark groove
  bulge = np.sin(np.pi * s) ** 0.5
  h = (5.0 * bulge - 4.0 * seam)[:, None] + 0.25 * norm(highpass(blur(L, 0.6), 2)) - 0.6 * rust
  rough = 0.5 + 0.3 * rust + 0.08 * paint + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  metal = 0.35 * (1 - rust) * (1 - paint)
  return col, h, rough, metal, 0.6, 0.9


SETS = {
  'neon_tile': tile,
  'neon_concrete': concrete,
  'neon_render': render,
  # Made from neon_asphalt's raw: raw/neon_asphalt_dry/0.png is a link to raw/neon_asphalt/0.png
  'neon_asphalt_dry': asphalt_dry,
  'neon_shutter': shutter,
  'neon_metal': iron_painted,  # light grey enamel, rust and scratches found as on the base set's black
}

TAKES = {}
