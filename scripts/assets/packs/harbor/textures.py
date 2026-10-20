# Harbor Yard's texture sets (PACK=harbor): run by scripts/assets/process-textures.py with its
# helpers in scope. The ribbed sets (container sheet, cladding, roller door) are cut rib to rib and
# laid out at an exact period, their height drawn from the real profile rather than from the image's
# shading (which is divided out of the colour); the yard concrete is re-laid slab by slab with
# thinner joints drawn in. Whatever a tint colours comes out neutral and pale.


def fold(p, per, phase=0.0, bins=128):
  """A periodic profile averaged over its periods: its mean at each phase (0..1 from `phase`)."""
  ph = ((np.arange(len(p)) - phase) / per) % 1
  k = np.minimum((ph * bins).astype(int), bins - 1)
  return np.array([p[k == i].mean() for i in range(bins)])


def dips(f, count=2):
  """The phases (0..1) of the `count` deepest local minima of a folded profile."""
  g = ndimage.gaussian_filter1d(f, len(f) / 80, mode='wrap')
  lows = [i for i in range(len(g)) if g[i] <= g[i - 1] and g[i] <= g[(i + 1) % len(g)]]
  lows.sort(key=lambda i: g[i])
  return [(i + 0.5) / len(g) for i in lows[:count]]


def fit_dip(prof, per, f, d, t):
  """Where the dip expected at t really is: the shift (up to an eighth of a rib) at which the
  profile around it best matches the folded one (f, its dip at phase d)."""
  ph = (np.arange(len(f)) + 0.5) / len(f)
  x = np.arange(max(0, int(t - per / 2)), min(len(prof), int(t + per / 2)))
  shifts = np.arange(-per / 8, per / 8, 0.5)
  err = [np.mean((prof[x] - np.interp(((x - t - s) / per + d) % 1, ph, f, period=1)) ** 2) for s in shifts]
  return t + shifts[int(np.argmin(err))]


def ribs(a, count=2):
  """Finds the ribs of a sheet ribbed across (its profile varies along x) and lays it out again
  rib to rib, as many whole ribs as the image has, so that it wraps across in the middle of one
  of the profile's two dips (a sloping face), and down where the rows agree. Returns the colour
  (SIZE x SIZE) and the number of ribs in it."""
  prof = lum(a).mean(0)
  w = a.shape[1]
  per = period(prof - ndimage.uniform_filter1d(prof, w // 3), w // 16, w // 3)
  f = fold(prof, per)
  best = []
  for d in dips(f, count):
    cuts = [fit_dip(prof, per, f, d, t) for t in np.arange(d * per, w, per)]
    cuts = [c for c in cuts if 0 <= c <= w - 1]
    if len(cuts) > len(best):
      best = cuts
  n = len(best) - 1
  print(f'    rib {per:.1f} px, {w / per:.2f} in the image; {n} whole ribs, cut at {np.round(best).astype(int).tolist()}')
  t = wrap_rows(lay_boards(a, best, n), 96, closed=True)
  return resize(t, SIZE, SIZE), n


def deshade(col, n, keep=0.1):
  """Divides out the light the image has baked into the ribs (the same at each phase of every
  rib), all but `keep` of it. Returns the colour and the folded luminance it found."""
  f = fold(lum(col).mean(0), SIZE / n)
  shade = np.interp((np.arange(SIZE) + 0.5) / (SIZE / n) % 1, (np.arange(len(f)) + 0.5) / len(f), f, period=1)
  shade = (shade / np.median(f)) ** (1 - keep)
  return np.clip(col / shade[None, :, None], 0, 1), f


def trapezoid(f, n, web, depth, narrow=False):
  """A trapezoidal rib profile across the tile (x), from the folded luminance f: the sloping
  faces centred on its two dips, `web` (of a rib) wide, and the crest `depth` pixels above the
  other flat. The crest is the brighter flat between them (it sees more sky), or the narrower
  one (narrow: a box profile, whose pans are wide)."""
  d1, d2 = sorted(dips(f))
  m = len(f)
  inner = f[int(d1 * m):int(d2 * m)].mean()
  outer = np.r_[f[int(d2 * m):], f[:int(d1 * m)]].mean()
  inside = d2 - d1 < 0.5 if narrow else inner > outer
  res = 1024  # phases across a rib
  ph = (np.arange(res) + 0.5) / res
  crest = ((ph > d1) & (ph < d2)) if inside else ((ph < d1) | (ph > d2))
  # A box of the crest, its edges ramped across the webs
  box = ndimage.uniform_filter1d(crest.astype(np.float32), int(round(web * res)), mode='wrap')
  x = (np.arange(SIZE) + 0.5) / (SIZE / n) % 1
  p = np.interp(x, ph, box, period=1)
  print(f'    dips at {d1:.3f} and {d2:.3f} of a rib, crest {"inside" if inside else "outside"} ({inner:.3f} inside, {outer:.3f} outside)')
  return depth * ndimage.gaussian_filter1d(p, 1.5, mode='wrap')


def neutral(col, keep, target):
  """Takes the colour out of everything but `keep` (rust: 0..1) so a tint can colour it, and
  scales the colour so the median of the rest has `target` linear luminance."""
  g = lum(col)[..., None]
  col = g + (col - g) * (0.06 + 0.94 * keep[..., None])
  lin = srgb_to_linear(col)
  rest = lum(lin)[keep < 0.2]
  return linear_to_srgb(lin * target / np.median(rest))


def rust_mask(col):
  """Orange-brown rust (red well over blue, not too dark), softened a little."""
  r, b = col[..., 0], col[..., 2]
  return blur(smoothstep(0.04, 0.13, r - b) * smoothstep(0.08, 0.2, lum(col)), 0.8)


def container(a):
  """Container side sheet: trapezoidal ribs (~28.5 cm, 36 mm deep), as many whole ones as the
  image has. Also writes the rust mask (harbor_container_rust), for keeping rust its own colour
  under a tint."""
  col, n = ribs(delight(a, 200, 0.5))
  rust = rust_mask(col)
  col, f = deshade(col, n)
  L = lum(col)
  depth = 0.126 * SIZE / n  # 36 mm on a 285 mm rib
  h = trapezoid(f, n, 0.13, depth)[None, :] * np.ones((SIZE, 1))
  # Dents and rust blooms from the image (its shading is gone from the ribs, not from the dents);
  # the paint itself is smooth
  h = h + 0.35 * norm(highpass(blur(L, 2), 20)) + 0.08 * norm(highpass(blur(L, 0.7), 3)) + 0.8 * rust
  grime = smoothstep(0.02, 0.1, blur(L, 2) - L) * (1 - rust)
  rough = 0.58 + 0.25 * rust + 0.1 * grime + 0.04 * norm(highpass(L, 30)).clip(-2, 2) / 2
  col = neutral(col, rust, 0.7)
  OUT.mkdir(parents=True, exist_ok=True)
  save_webp(np.repeat(rust[..., None], 3, -1), OUT / 'harbor_container_rust_1k.webp')
  return col, h, rough, 0, 0.45, float(normal_map(h, 1)[..., 2].mean())


def cladding(a):
  """Warehouse wall sheeting, box profile: narrow ribs 35 mm high every 25 cm, wide flat pans."""
  a = delight(a, 160, 0.5)
  # Its dirt streaks hang from the top of the image: even the rows out, or every tile repeats a band
  rows = ndimage.gaussian_filter1d(lum(a).mean(1), 40, mode='nearest')
  a = np.clip(a * (rows.mean() / rows)[:, None, None], 0, 1)
  col, n = ribs(a)
  rust = rust_mask(col)
  col, f = deshade(col, n)
  L = lum(col)
  h = trapezoid(f, n, 0.06, 0.14 * SIZE / n, narrow=True)[None, :] * np.ones((SIZE, 1))
  h = h + 0.3 * norm(highpass(blur(L, 2), 20)) + 0.05 * norm(highpass(blur(L, 0.7), 3)) + 0.5 * rust
  grime = smoothstep(0.02, 0.1, blur(L, 2) - L) * (1 - rust)
  rough = 0.5 + 0.25 * rust + 0.1 * grime + 0.03 * norm(highpass(L, 30)).clip(-2, 2) / 2
  col = neutral(col, rust, 0.7)
  return col, h, rough, 0, 0.45, float(normal_map(h, 1)[..., 2].mean())


def roller_door(a):
  """Galvanised roller shutter: slats down the frame (laid out like the container's ribs, turned),
  each a shallow convex face, hinge grooves between them."""
  t, n = ribs(delight(a, 160, 0.5).transpose(1, 0, 2), count=1)
  t, f = deshade(t, n, keep=0.15)
  # Across a slat (0 at the groove, which the cut is in the middle of): bulging ~7 mm on 83 mm,
  # the groove ~5 mm deep
  slat = SIZE / n
  x = (np.arange(SIZE) + 0.5) / slat % 1
  edge = np.minimum(x, 1 - x) * slat  # pixels from the groove
  profile = 0.08 * slat * 4 * x * (1 - x) - 0.06 * slat * smoothstep(4, 1, edge)
  col = t.transpose(1, 0, 2)
  L = lum(col)
  h = profile[:, None] * np.ones((1, SIZE)) + 0.2 * norm(highpass(blur(L, 0.7), 3)) + 0.3 * norm(highpass(blur(L, 2), 16))
  # Grime: what's darker than the slat around it (in the grooves, the streaks)
  grime = smoothstep(0.03, 0.15, blur(L, 6) - blur(L, 1))
  rough = 0.55 + 0.25 * grime + 0.03 * norm(highpass(L, 3)).clip(-2, 2) / 2
  metal = 0.6 * (1 - grime)
  col = neutral(col, np.zeros_like(L), 0.6)
  print(f'    {n} slats a tile')
  return col, h, rough, metal, 0.5, float(normal_map(h, 1)[..., 2].mean())


def fade_specks(col, mask, area, amount):
  """Fades the blobs of `mask` smaller than `area` pixels toward the colour around them; returns
  the colour and how much each pixel was faded."""
  lab, n = ndimage.label(mask > 0.3)
  sizes = ndimage.sum(np.ones_like(mask), lab, index=np.arange(1, n + 1))
  small = np.isin(lab, np.nonzero(sizes < area)[0] + 1)
  fade = amount * blur(ndimage.binary_dilation(small, iterations=2).astype(np.float32), 1)
  keep = 1 - blur((mask > 0.1).astype(np.float32), 1)
  around = blur(col * keep[..., None], 6) / (blur(keep, 6)[..., None] + 1e-4)
  return col * (1 - fade[..., None]) + np.clip(around, 0, 1) * fade[..., None], fade


def steel_painted(a):
  """Pale painted steel plate, chipped to primer and rust: 1 m."""
  col = resize(wrap_cut(delight(a, 160, 0.6), 96), SIZE, SIZE)
  rust = rust_mask(col)
  L = lum(col)
  # Chips: sharply darker than the paint around them and not orange (the primer under it)
  chip = blur(smoothstep(0.12, 0.25, blur(L, 8) - L), 0.7) * (1 - rust)
  bare = np.maximum(rust, chip)
  # The many small ones speckle the paint from any distance (a sponge on the crane, terrazzo on
  # the tanks): keep the big chips and blooms, mostly paint over the rest
  col, fade = fade_specks(col, bare, 60, 0.8)
  rust, chip, bare = rust * (1 - fade), chip * (1 - fade), bare * (1 - fade)
  L = lum(col)
  h = -1.5 * blur(bare, 1) + 0.05 * norm(highpass(blur(L, 0.7), 3)) * (1 - bare) + 0.05 * norm(highpass(blur(L, 2), 24))
  rough = 0.55 + 0.25 * rust + 0.1 * chip + 0.04 * norm(highpass(L, 30)).clip(-2, 2) / 2
  col = neutral(col, rust, 0.7)
  return col, h, rough, 0, 0.45, 0.985


def pallet_wood(a):
  """Rough-sawn spruce, grain along x: 1 m."""
  col = resize(wrap_cut(delight(a, 160, 0.5), 96), SIZE, SIZE)
  L = lum(col)
  # The grain: ridges along x, so smoothed along x much more than across
  grain = ndimage.gaussian_filter(highpass(L, 6), (0.7, 4), mode='wrap')
  h = 0.9 * norm(grain) + 0.35 * norm(highpass(blur(L, 0.6), 2)) + 0.3 * norm(highpass(L, 24))
  rough = 0.84 + 0.05 * norm(highpass(L, 8)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.5, 0.9


def joint_centres(L, axis):
  """The joints of a slab grid across `axis` (0: the joints are columns), each at the middle of
  its dark band, and the half-width of the bands; plus the joints a slab beyond either edge."""
  prof = L.mean(axis)
  dark = -prof
  js = peaks(dark, period(dark - ndimage.uniform_filter1d(dark, 301), 200, 1200))
  slab = np.median(prof)
  out, half = [], []
  for j in js:
    lo, hi = int(j) - 24, int(j) + 25
    p = prof[lo:hi]
    band = np.nonzero(p < (slab + p.min()) / 2)[0]
    out.append(lo + (band.min() + band.max() + 1) / 2)
    half.append((band.max() + 1 - band.min()) / 2)
  per = np.diff(out).mean()
  return [out[0] - per] + out + [out[-1] + per], float(np.mean(half))


def noise1(n, sigma, rng):
  """Smooth random values along a line that wraps, scaled to unit spread."""
  return norm(ndimage.gaussian_filter1d(rng.standard_normal(n), sigma, mode='wrap'))


# The yard's slabs, (row, column) of the image's 4 x 4: its top-left 2 x 2 (tyre marks, a crack, one
# big puddle, a plain one), neighbours there, so the tracks run on across their joints
SLABS = ((0, 0), (0, 1), (1, 0), (1, 1))


def yard_concrete(a):
  """Port pavement of 4 m slabs: 2 x 2 slabs (an 8 m tile), the image's SLABS cut inside their
  joints and laid edge to edge, with narrower joints drawn over where they meet (the image's are
  ~9 cm; sawn and sealed ones ~3 cm)."""
  L = lum(a)
  jx, hx = joint_centres(L, 0)
  jy, hy = joint_centres(L, 1)
  m = max(hx, hy) + 2  # cut this far from a joint's middle: clear of it
  print(f'    joints x {np.round(jx).astype(int).tolist()}, y {np.round(jy).astype(int).tolist()}, half-width {hx:.1f}, {hy:.1f} px')
  half = SIZE // 2
  col = np.zeros((SIZE, SIZE, 3), np.float32)
  for k, (r, c) in enumerate(SLABS):
    x0, x1, y0, y1 = jx[c] + m, jx[c + 1] - m, jy[r] + m, jy[r + 1] - m
    u = (np.arange(half) + 0.5) / half
    mx, my = np.meshgrid(x0 + u * (x1 - x0) - 0.5, y0 + u * (y1 - y0) - 0.5)
    at = (slice(half * (k // 2), half * (k // 2 + 1)), slice(half * (k % 2), half * (k % 2 + 1)))
    col[at] = cv2.remap(a, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)
  L = lum(col)
  # Wet: darker than the slab's dry concrete (the bright part of it), in broad patches
  dry = np.zeros_like(L)
  for i in (0, 1):
    for j in (0, 1):
      q = (slice(half * i, half * (i + 1)), slice(half * j, half * (j + 1)))
      dry[q] = np.percentile(L[q], 85)
  damp = smoothstep(0.06, 0.2, dry - blur(L, 8))
  puddle = smoothstep(0.35, 0.75, damp)  # standing water: only the broad, much darker patches
  # The joints: a sealed sawn cut, its width wandering a little
  rng = np.random.default_rng(7)
  joint = np.zeros_like(L)
  for axis in (0, 1):
    for at in (0, half):
      d = np.abs((np.arange(SIZE) + 0.5 - at + half) % SIZE - half)  # pixels from this joint
      w = 1.5 + 0.3 * noise1(SIZE, 12, rng).clip(-2, 2)
      j = smoothstep(w[:, None] + 1.2, w[:, None] - 0.3, d[None, :])  # rows: along the joint
      joint = np.maximum(joint, j if axis == 0 else j.T)
  edge = blur(joint, 2.5) * (1 - joint)  # grime along its edges
  seal = 0.09 + 0.03 * blur(rng.standard_normal((SIZE, SIZE)).astype(np.float32), 3)
  col = col * (1 - 0.25 * edge[..., None])
  col = col * (1 - joint[..., None]) + seal[..., None] * joint[..., None]
  # Dry concrete at ~0.6 (sRGB), a little less warm
  g = lum(col)[..., None]
  col = g + 0.7 * (col - g)
  col = linear_to_srgb(srgb_to_linear(col) * srgb_to_linear(0.6) / srgb_to_linear(np.median(dry)))
  L = lum(col)
  # Standing water is flat: the puddles lose the surface's grain
  h = (0.12 * norm(highpass(blur(L, 0.7), 3)) + 0.35 * norm(highpass(L, 16))) * (1 - 0.8 * puddle) - 0.6 * puddle - 4 * joint
  # All of it damp after rain (no shine), the puddles glossy enough to reflect
  rough = 0.74 - 0.08 * damp - 0.58 * puddle + 0.1 * joint
  return col, h, rough, 0, 0.45, 0.975



def gravel(a):
  """Crushed stone under the yard's slabs: 1 m. The stones stand out of the grit between them."""
  col = resize(wrap_cut(delight(a, 160, 0.6), 96), SIZE, SIZE)
  L = lum(col)
  h = norm(highpass(blur(L, 1), 24)) + 0.3 * norm(highpass(blur(L, 0.6), 4))
  rough = 0.9 - 0.04 * norm(highpass(L, 8)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.6, 0.9


# The slabs' reinforcement: two mats of bars 0.2 m apart (drawn 22 mm across, a little over a real
# one's 16-20, to read), the top one 0.065 m under the slab's top and the bottom one 0.235 m. The
# broken faces' map is laid at 1 m a tile with v from the slab's top, down, so the bars' ends come
# out in two rows at those depths on any upright broken face.
BARS = {'spacing': 0.2, 'depths': (0.065, 0.235), 'radius': 0.011}


def slab_broken(a):
  """The yard slabs' broken faces: the base pack's fractured concrete (gen_concrete_broken's take,
  copied as this set's raw) with the reinforcement's bar ends in it, rusty, a stain running down
  from each."""
  col, h, rough, metal, ao_amount, nz = concrete_broken(a)
  rng = np.random.default_rng(11)
  yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
  bar = np.zeros((SIZE, SIZE), np.float32)
  rust = np.zeros((SIZE, SIZE), np.float32)
  r = BARS['radius'] * SIZE
  n = round(1 / BARS['spacing'])
  for depth in BARS['depths']:
    for k in range(n):
      cx = (k + 0.5) * SIZE / n + rng.uniform(-3, 3)
      cy = depth * SIZE + rng.uniform(-4, 4)
      dx = (xx - cx + SIZE / 2) % SIZE - SIZE / 2
      dy = (yy - cy + SIZE / 2) % SIZE - SIZE / 2
      d = np.hypot(dx, dy)
      bar = np.maximum(bar, smoothstep(r + 1, r - 1, d))
      # A rust halo, and a stain run down the face from it
      run = smoothstep(r * 1.4, r * 0.4, np.abs(dx)) * smoothstep(-2, 4, dy) * smoothstep(r * 4 + rng.uniform(0, 30), 0, dy)
      rust = np.maximum(rust, np.maximum(smoothstep(r * 2.6, r, d), 0.6 * run))
  rust = blur(rust, 1.5) * (1 - bar)
  steel = np.array([0.22, 0.17, 0.14], np.float32)
  oxide = np.array([0.45, 0.26, 0.13], np.float32)
  col = col * (1 - 0.75 * rust[..., None]) + oxide * 0.75 * rust[..., None]
  col = col * (1 - bar[..., None]) + steel * bar[..., None]
  # The bar ends stand a little proud of the broken concrete, which spalled round them
  h = h * (1 - bar) + 1.5 * bar - 0.8 * rust * (1 - bar)
  rough = rough * (1 - bar) + 0.6 * bar
  print(f'    {n} bars a row at depths {BARS["depths"]} m')
  return col, h, rough, metal, ao_amount, nz


SETS = {
  'harbor_container': container,
  'harbor_cladding': cladding,
  'harbor_steel_painted': steel_painted,
  'harbor_yard_concrete': yard_concrete,
  'harbor_pallet_wood': pallet_wood,
  'harbor_roller_door': roller_door,
  'harbor_gravel': gravel,
  'harbor_slab_broken': slab_broken,
}
