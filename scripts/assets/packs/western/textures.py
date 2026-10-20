# Dust Town's texture sets (scripts/assets/packs/western/textures.mjs): how each raw image becomes a
# tiling set. Runs inside scripts/assets/process-textures.py (PACK=western), with its helpers in scope.
#
# Each set's mean colour is the colour it shows untinted (the material's `color` and the per-piece
# tints multiply it), so it is set here on purpose rather than left to the image model.

# Which take of each set to use (assets-src/packs/western/textures/raw/<set>/<take>.png)
TAKES = {
  # Take 0 peeled every board the same way, in long runs: tiled, it read as brick
  'western_siding': 1,
}


def set_mean(col, rgb, shoulder=0.8):
  """Scales each channel in linear light so the mean colour is `rgb` (sRGB, 0-255), keeping every
  variation relative to it; what would pass `shoulder` rolls off instead of clipping."""
  lin = srgb_to_linear(col)
  target = srgb_to_linear(np.array(rgb, np.float32) / 255)
  lin = lin * (target / lin.reshape(-1, 3).mean(0))
  over = np.maximum(lin - shoulder, 0)
  lin = np.minimum(lin, shoulder) + over / (1 + over / (1 - shoulder))
  return linear_to_srgb(lin)


def waves(shape, sigma, seed):
  """Smooth random relief that tiles (white noise blurred round the wrap), unit deviation."""
  return norm(blur(np.random.default_rng(seed).standard_normal(shape).astype(np.float32), sigma))


def nz_of(h):
  """The mean normal z of a height in true pixel units, so fit_normal keeps it at strength 1."""
  return float(normal_map(h, 1.0)[..., 2].mean())


def siding(a):
  """Lap siding, 6 boards of 15 cm in a 0.90 m tile. The boards are cut out lap line to lap line and
  stacked; the boards' length wraps where the outer columns of nails meet; then each board slides
  along by its own amount, so whatever pattern the peeling has doesn't line up down the wall.
  Height in pixels (0.88 mm each): each board's face rises 12 px from its top to its thick lower
  edge, which drops onto the next board (the lit face and the shadowed lap), plus paint and grain.
  The raw is narrower than its 6 boards are tall, so they come out ~1.3x stretched along their length."""
  w_raw = a.shape[1]
  L = lum(a)
  dark = -L.mean(1)
  laps = peaks(dark, period(dark - ndimage.uniform_filter1d(dark, 101), 120, 260))
  s = (len(laps) - 7) // 2  # the middle 6 boards
  print(f'    lap lines at {np.round(laps).astype(int).tolist()}, boards {s}..{s + 6}')
  t = lay_boards(a.transpose(1, 0, 2), laps[s:s + 7], 6).transpose(1, 0, 2)
  # The outermost nail columns (the rust drips under the nails)
  rust = ndimage.uniform_filter1d(np.clip(a[..., 0] - a[..., 2], 0, 1).mean(0), 5)
  hot = np.nonzero(rust > np.median(rust) + 0.5 * (rust.max() - np.median(rust)))[0]
  x0 = hot[0] + int(np.argmax(rust[hot[0]:hot[0] + 16]))
  x1 = hot[-1] - 15 + int(np.argmax(rust[hot[-1] - 15:hot[-1] + 1]))
  print(f'    nail columns at {x0}, {x1}')
  t = wrap_rows(t.transpose(1, 0, 2), w_raw - (x1 - x0), closed=True).transpose(1, 0, 2)
  col = delight(resize(t, SIZE, SIZE), 300, 0.3)
  col = set_mean(col, (184, 178, 171))
  w = SIZE / 6
  shifts = (np.array([0, 2, 4, 1, 5, 3]) / 6 + np.random.default_rng(3).uniform(-0.04, 0.04, 6)) * SIZE
  for i in range(6):
    r0, r1 = int(round(i * w)), int(round((i + 1) * w))
    col[r0:r1] = np.roll(col[r0:r1], int(shifts[i]), axis=1)
  L = lum(col)
  # Where the lower edge is: the steepest fall into the lap's shadow, just above the cut
  y = np.arange(SIZE)
  f = (y + 0.5) % w  # pixels below the cut above
  fold = np.array([L[(f >= k) & (f < k + 1)].mean() for k in range(int(w))])
  tail = np.diff(fold[-14:])
  edge = int(w) - 14 + int(np.argmin(tail)) + 0.5
  print(f'    lower edge {int(w) - edge:.1f} px above the cut')
  face = np.where(f < edge, f / edge, 1 - smoothstep(edge, edge + 2.5, f))
  paint = smoothstep(0.52, 0.66, blur(L, 0.7))
  # Where the paint is, for the siding's tint mask (the building's colour there, bare boards grey):
  # the flakes, brighter than the grey wood they've come off. Softened, and some colour left in the
  # bare wood: crisp coloured flakes on grey, 3-8 cm in rows, read as brick from across the street
  mask = 0.35 + 0.65 * blur(smoothstep(0.63, 0.72, blur(L, 1.2)), 5)
  save_webp(np.repeat(mask[..., None], 3, -1), OUT / 'western_siding_paint_1k.webp')
  grain = ndimage.gaussian_filter(highpass(L, 6), (0.6, 3), mode='wrap')  # along the boards (x)
  crack = smoothstep(0.03, 0.09, -highpass(blur(L, 0.6), 2)) * paint  # the dark lines between paint flakes
  h = 12 * face[:, None] + 0.8 * paint + 0.35 * norm(grain) * (1 - paint) - 0.5 * crack
  shadow = 1 - smoothstep(0, 4, np.minimum(f, w - f))[:, None]
  rough = 0.8 + 0.08 * (1 - paint) + 0.1 * shadow
  return col, h, rough, 0, 0.4, nz_of(h)


def tin(a):
  """Corrugated iron, 9 ridges in a tile (the model drew ~10 in the frame instead of 13, so 13 won't
  fit): every row is resampled so the crests fall exactly 1/9 of the tile apart, which also takes
  out any drift. The corrugations' baked shading is divided out of the colour, since the height (a
  true cosine profile) does that now. At 7.6 cm a ridge, 1 px is 0.67 mm: 18 mm deep is 27 px."""
  h_raw, w_raw = a.shape[:2]
  L = lum(a)
  per = period(L.mean(0) - L.mean(0).mean(), 100, 240)
  # The crests (the light bands, where the nails are) along bands of rows, matched to the first
  # band's; rust spots throw single bands off by 10-20 px, so each crest is a straight line fitted
  # without the outliers
  bands = np.arange(0, h_raw - 192, 128)
  crests = []
  for y0 in bands:
    p = blur(L[y0:y0 + 256], 2, False).mean(0)
    crests.append(comb(p - ndimage.uniform_filter1d(p, int(per)), per, refine=0.15))
  ref = np.array(crests[0])
  xs = np.full((len(bands), len(ref)), np.nan)
  for i, c in enumerate(crests):
    for x in c:
      k = int(np.argmin(np.abs(ref - x)))
      if abs(ref[k] - x) < per / 3:
        xs[i, k] = x
  xs = xs[:, ~np.isnan(xs).any(0)]
  yc = bands + 128
  fits = []
  for k in range(xs.shape[1]):
    good = np.abs(xs[:, k] - np.median(xs[:, k])) < 8
    fits.append(np.polyfit(yc[good], xs[good, k], 1))
  lean = max(abs(f[0]) for f in fits) * h_raw
  print(f'    ridge {per:.1f} px, {xs.shape[1]} crests followed, most lean {lean:.1f} px over the image')
  q = SIZE / 9  # output pixels a ridge
  scale = per / q  # raw pixels an output pixel, both ways
  rows = int(h_raw / scale)
  kx = np.array([[np.polyval(c, (r + 0.5) * scale) for c in fits] for r in range(rows)])
  sl, sr = kx[:, 1] - kx[:, 0], kx[:, -1] - kx[:, -2]  # spacing at either end, to go past the outer crests
  last = kx.shape[1] - 1
  ph0 = float(np.max(-(kx[:, 0] - 2) / sl))  # the first phase (from crest 0) inside the image in every row
  ph1 = float(np.min(last + (w_raw - 3 - kx[:, -1]) / sr))
  print(f'    {ph1 - ph0:.2f} ridges inside, {ph1 - ph0 - 9:.2f} to overlap')
  ph = ph0 + (np.arange(int((ph1 - ph0) * q)) + 0.5) / q
  mx = np.stack([np.where(ph < 0, kx[r, 0] + ph * sl[r], np.where(ph > last, kx[r, -1] + (ph - last) * sr[r], np.interp(ph, np.arange(last + 1), kx[r])))
                 for r in range(rows)]).astype(np.float32)
  my = np.repeat(((np.arange(rows) + 0.5) * scale - 0.5)[:, None], mx.shape[1], 1).astype(np.float32)
  t = cv2.remap(blur(a, 0.5 * scale, False), mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)
  # Wrap across over exactly 9 ridges (the overlap is then in phase), then down
  t = wrap_rows(t.transpose(1, 0, 2), t.shape[1] - SIZE, closed=False).transpose(1, 0, 2)
  t = wrap_rows(t, t.shape[0] - SIZE, closed=True)
  rust = blur(smoothstep(0.05, 0.16, t[..., 0] - t[..., 2]), 0.8)
  # The zinc's brightness by ridge phase (the baked shading), divided out
  phase = (ph0 + (np.arange(SIZE) + 0.5) / q) % 1  # 0 on a crest
  bins = np.minimum((phase * 48).astype(int), 47)
  Lt = lum(t)
  zinc = rust < 0.2
  prof = np.array([np.median(Lt[:, bins == k][zinc[:, bins == k]]) for k in range(48)])
  prof = ndimage.gaussian_filter1d(prof, 1.5, mode='wrap')
  col = delight(np.clip(t / ((prof / prof.mean()) ** 0.9)[bins][None, :, None], 0, 1), 300, 0.4)
  L = lum(col)
  ridge = 13.5 * np.cos(2 * np.pi * phase)
  h = ridge[None, :] + 1.2 * blur(rust, 2) + 0.6 * norm(highpass(blur(L, 0.6), 3)) * rust + 0.15 * norm(highpass(L, 2)) * (1 - rust)
  rough = 0.45 + 0.4 * rust + 0.05 * norm(highpass(L, 6)).clip(-2, 2) / 2
  metal = 0.85 - 0.75 * rust
  return col, h, rough, metal, 0.35, nz_of(h)


def timber(a):
  """Rough-sawn weathered timber, grain top to bottom (along v): the overlap cut only, so the grain
  keeps its direction; checks and cracks deep, raised grain along the wood."""
  col = resize(wrap_cut(delight(a, 240, 0.6), 192), SIZE, SIZE)
  col = set_mean(col, (158, 146, 130))
  L = lum(col)
  grain = ndimage.gaussian_filter(highpass(L, 8), (3, 0.6), mode='wrap')  # smoothed along the grain
  check = smoothstep(0.04, 0.14, -highpass(blur(L, 0.6), 3))  # dark slits: the checks and cracks
  h = 0.8 * norm(highpass(L, 24)) + 0.7 * norm(grain) - 1.5 * check
  rough = 0.82 + 0.06 * check + 0.04 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.9


# The eroded patches on take 0 (x0, y0, x1, y1 in the 1536 raw), each with the corner of a plain
# area of the same size to fill it from. Any patch kept repeats as a grid of spots across a wall.
ADOBE_FILL = {0: [
  ((195, 125, 470, 395), (640, 760)),
  ((1030, 1060, 1355, 1370), (470, 380)),
  ((1115, 445, 1360, 625), (650, 120)),
  ((190, 1150, 405, 1270), (560, 1280)),
]}


def adobe(a):
  """Mud plaster: the eroded patches filled from plain plaster (a Poisson clone, so the fill takes
  the colour round it), then the overlap cut. Height in pixels (1.7 mm each): the hand-smoothed
  wall's undulation (made up: the colour doesn't show it), with the plaster's grain, cracks and pits
  on it. Without the undulation it looks like card in the sun."""
  img = to_srgb8(a)
  for (x0, y0, x1, y1), (sx, sy) in ADOBE_FILL.get(TAKES.get('western_adobe', 0), []):
    pw, ph = x1 - x0, y1 - y0
    mask = np.zeros(img.shape[:2], np.uint8)
    cv2.ellipse(mask, (sx + pw // 2, sy + ph // 2), (pw // 2 + 20, ph // 2 + 20), 0, 0, 360, 255, -1)
    img = cv2.seamlessClone(img, img, mask, ((x0 + x1) // 2, (y0 + y1) // 2), cv2.NORMAL_CLONE)
  a = img.astype(np.float32) / 255
  col = resize(wrap_cut(delight(a, 240, 0.6), 192), SIZE, SIZE)
  col = set_mean(col, (198, 160, 118))
  L = lum(col)
  crack = smoothstep(0.03, 0.1, -highpass(blur(L, 0.6), 3))
  fine = norm(highpass(L, 24)) + 0.4 * norm(highpass(L, 4)) - 1.2 * crack
  h = 0.35 * fine + 5 * waves(L.shape, 40, 1) + 1.2 * waves(L.shape, 14, 2)
  return col, h, np.full(h.shape, 0.92, np.float32), 0, 0.5, nz_of(h)


def dirt(a):
  """Packed dirt. Its mean is the design's dirt colour (0xc9a77c): the street's paler 0xd3b994 came
  out nearly white under the noon sun. Pebbles and crumbs stand up, cracks go down."""
  col = resize(wrap_cut(delight(a, 320, 0.7), 256), SIZE, SIZE)
  col = set_mean(col, (201, 167, 124))
  L = lum(col)
  crack = smoothstep(0.03, 0.09, -highpass(blur(L, 0.6), 2))
  h = norm(highpass(L, 16)) + 0.4 * norm(highpass(L, 3)) - 0.8 * crack
  rough = 0.95 - 0.03 * norm(highpass(L, 4)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.94


def earth(a):
  """Dug earth under the street, a crater's floor and sides: a little darker and redder than the
  street's dirt (the red earth out in the desert, in shade). Clods and stones stand up, the gaps
  between them go deep."""
  col = resize(wrap_cut(delight(a, 240, 0.6), 192), SIZE, SIZE)
  col = set_mean(col, (164, 122, 90))
  L = lum(col)
  gap = smoothstep(0.03, 0.12, -highpass(blur(L, 0.8), 6))
  h = 1.2 * norm(highpass(blur(L, 1.0), 24)) + 0.5 * norm(highpass(L, 4)) - 1.0 * gap
  rough = 0.95 - 0.03 * norm(highpass(L, 4)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.6, 0.9


def dirt_broken(a):
  """The street's packed dirt where it breaks: a little deeper than its sunlit crust (the dirt's
  0xc9a77c), crumbled. Lumps stand up, the hollows between them go deep."""
  col = resize(wrap_cut(delight(a, 240, 0.6), 192), SIZE, SIZE)
  col = set_mean(col, (192, 156, 112))
  L = lum(col)
  gap = smoothstep(0.03, 0.12, -highpass(blur(L, 0.8), 6))
  h = 1.2 * norm(highpass(blur(L, 1.0), 24)) + 0.4 * norm(highpass(L, 4)) - 1.0 * gap
  rough = 0.96 - 0.03 * norm(highpass(L, 4)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.55, 0.9


def splinter(a):
  """Broken pine, for broken faces (insideTexture). The library multiplies it by the material's
  `inside` colour, so it carries the colour itself (mean about 0xd9c69d, near the design's inside
  colour 0xe0caa0) and `inside` should be white or near it. Fibres stand up, the gaps between them go deep."""
  col = resize(wrap_cut(delight(a, 160, 0.5), 96), SIZE, SIZE)
  col = set_mean(col, (222, 200, 158), shoulder=0.7)
  L = lum(col)
  fibre = ndimage.gaussian_filter(highpass(L, 10), (2.5, 0.6), mode='wrap')
  h = norm(highpass(L, 20)) + 0.6 * norm(fibre)
  rough = 0.78 + 0.05 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.55, 0.88


SETS = {
  'western_siding': siding,
  'western_timber': timber,
  'western_tin': tin,
  'western_adobe': adobe,
  'western_dirt': dirt,
  'western_earth': earth,
  'western_dirt_broken': dirt_broken,
  'western_splinter': splinter,
}
