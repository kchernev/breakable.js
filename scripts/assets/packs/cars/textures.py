# The cars' insides (PACK=cars): run by scripts/assets/process-textures.py with its helpers in scope.
# The plain surfaces are its `generic` (the wrap joined where the edges agree, the light evened out),
# each as rough as it is. The quilted leather is the black leather's grain with a diamond quilt drawn
# over it (stitched seams sunk between plump diamonds, a perforation in each); the carbon weave is
# drawn entirely (a 2x2 twill of tows, each with a lengthwise sheen). Both repeat exactly.


def quilted(a, n=6):
  """`n` x `n` diamonds a tile over the leather's grain: seams sunk in, the diamonds plump, a
  stitch line along each seam a little each side, a few perforations in each diamond."""
  base = generic(a, rough=0.5)[0]
  u = (np.arange(SIZE) + 0.5) / SIZE * n
  uu, vv = np.meshgrid(u, u)
  # Distance to the nearest seam of a diamond grid (the lines u+v and u-v at whole numbers)
  d1 = np.abs((uu + vv) % 1 - 0.5)
  d2 = np.abs((uu - vv) % 1 - 0.5)
  edge = 0.5 - np.maximum(d1, d2)  # 0 on a seam, 0.5 at a diamond's middle
  plump = np.sqrt(np.clip(edge / 0.5, 0, 1))
  seam = smoothstep(0.035, 0.0, edge)
  # Stitches: dashes along lines just either side of each seam
  along = ((uu + vv) * 18 % 1) * (d1 > d2) + ((uu - vv) * 18 % 1) * (d1 <= d2)
  stitch = smoothstep(0.012, 0.0, np.abs(edge - 0.07)) * (along < 0.6)
  # Perforations: a small grid of holes in each diamond's middle
  pu, pv = (uu + vv) * 3 % 1 - 0.5, (uu - vv) * 3 % 1 - 0.5
  holes = smoothstep(0.12, 0.06, np.hypot(pu, pv)) * (edge > 0.14)
  col = base * (1 - 0.55 * seam[..., None]) * (1 - 0.6 * holes[..., None])
  col = col * (1 - stitch[..., None]) + np.array([0.42, 0.42, 0.4], np.float32) * stitch[..., None]
  h = 2.5 * plump - 1.2 * seam + 0.35 * stitch - 0.8 * holes + 0.15 * norm(highpass(lum(base), 6))
  rough = 0.48 + 0.15 * seam - 0.05 * plump + 0.2 * holes
  return col, h, rough, 0.0, 0.6, 0.9


def carbon(a, n=16):
  """A 2x2 twill of carbon tows, `n` a tile each way: each tow a strand bundle catching the light
  along its length, the over-and-under steps on the diagonal."""
  i = (np.arange(SIZE) + 0.5) / SIZE * n
  ii, jj = np.meshgrid(i, i)
  ci, cj = np.floor(ii).astype(int), np.floor(jj).astype(int)
  warp = ((ci + cj) // 2) % 2 == 0  # which way the tow on top runs here
  fu, fv = ii % 1, jj % 1
  across = np.where(warp, fu, fv)  # position across the tow on top
  along = np.where(warp, fv, fu)
  bulge = np.sin(np.pi * across)
  strands = 0.5 + 0.5 * np.sin(across * np.pi * 18)
  shine = np.where(warp, 1.0, 0.55)
  v = 0.035 + 0.06 * bulge * shine + 0.012 * strands
  col = np.stack([v, v, v * 1.08], -1).astype(np.float32)
  h = bulge * 0.9 + 0.1 * strands - 0.3 * (np.minimum(along, 1 - along) < 0.04)
  rough = np.full(h.shape, 0.32, np.float32) - 0.06 * bulge
  return col, h, rough, 0.0, 0.3, 0.95


SETS = {
  'car_leather_black': lambda a: generic(a, rough=0.5, nz=0.96),
  'car_leather_tan': lambda a: generic(a, rough=0.52, nz=0.96),
  'car_leather_quilted': quilted,
  'car_fabric': lambda a: generic(a, overlap=64, rough=0.95, nz=0.9),
  'car_carpet': lambda a: generic(a, overlap=64, rough=1.0, ao_amount=0.7, nz=0.88),
  'car_plastic': lambda a: generic(a, overlap=64, rough=0.72, nz=0.95),
  'car_headliner': lambda a: generic(a, overlap=64, rough=0.98, nz=0.97),
  'car_plywood': lambda a: generic(a, rough=0.82, nz=0.95),
  'car_carbon': carbon,
}
SOURCES = {'car_leather_quilted': 'car_leather_black', 'car_carbon': 'car_plastic'}
