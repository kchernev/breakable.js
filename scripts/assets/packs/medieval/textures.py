# Market Town's processing (run by scripts/assets/process-textures.py with PACK=medieval, which
# execs this with its helpers in scope): each set made to wrap, evened out, and its maps derived
# from the colour. Sets are named for what they are; one tile is the frame size in textures.mjs.


def regrade(col, target, keep):
  """Moves the colour's mean to `target` (sRGB 0-1), keeping `keep` of its saturation: the image
  model's colours drift, and a warm sun on an already warm map turns it orange."""
  grey = lum(col)[..., None]
  out = grey + keep * (col - grey)
  return np.clip(out * (np.asarray(target, np.float32) / out.reshape(-1, 3).mean(0)), 0, 1)


def oak(a):
  """Hewn oak, grain running down the frame (along v, so it follows each timber turned that way)."""
  col = rubble(a, 96)
  L = lum(col)
  # The checks: narrow and darker than the wood around them
  checks = smoothstep(0.05, 0.16, blur(L, 5) - blur(L, 0.6))
  grain = ndimage.gaussian_filter(highpass(L, 6), (3, 0.6), mode='wrap')  # smoothed along the grain
  h = 0.8 * norm(grain) + 0.3 * norm(highpass(blur(L, 0.6), 2)) + 0.35 * norm(highpass(L, 32)) - 2.5 * blur(checks, 0.8)
  rough = 0.78 + 0.1 * checks + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.55, 0.9


def limestone(a):
  """Dressed ashlar face: fine claw tooling and pits, nearly flat. The blocks are pieces, so no joints."""
  col = regrade(rubble(a, 96), (0.83, 0.77, 0.64), 0.6)
  L = lum(col)
  pits = smoothstep(0.06, 0.16, blur(L, 4) - L)
  h = 0.5 * norm(highpass(L, 24)) + 0.5 * norm(highpass(blur(L, 0.7), 3)) - 1.5 * blur(pits, 0.7)
  rough = 0.82 + 0.06 * pits + 0.03 * norm(highpass(L, 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.45, 0.95


def limestone_broken(a):
  """Fresh fracture: facets and steps at two scales, as gen_brick_broken does."""
  col = rubble(a, 96)
  Ls = blur(lum(col), 0.7)
  h = 1.0 * norm(highpass(Ls, 24)) + 0.5 * norm(highpass(Ls, 4))
  rough = 0.84 + 0.06 * norm(highpass(lum(col), 8)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.55, 0.88


def daub_broken(a):
  """Crumbled clay and straw round wattle rods: lumpy at the clods' scale, fibrous below it."""
  col = rubble(a, 96)
  Ls = blur(lum(col), 0.7)
  h = 1.0 * norm(highpass(Ls, 20)) + 0.5 * norm(highpass(Ls, 3))
  rough = 0.92 + 0.04 * norm(highpass(lum(col), 6)).clip(-2, 2) / 2
  return col, h, rough, 0, 0.6, 0.87


def hay(a):
  """Straw bale side: bright stalks on top, dark gaps between them deep."""
  col = regrade(rubble(a, 96), (0.62, 0.5, 0.32), 0.85)
  L = lum(col)
  Ls = blur(L, 0.6)
  h = 1.0 * norm(highpass(Ls, 3)) + 0.6 * norm(highpass(Ls, 12)) - 1.2 * smoothstep(0.25, 0.08, blur(L, 1.5))
  rough = 0.88 - 0.06 * smoothstep(0.55, 0.8, L)  # the stalks' waxy skin is a little smoother
  return col, h, rough, 0, 0.65, 0.86


def canvas(a):
  """Undyed linen: the weave and slubs, nearly flat; near white so the stall's tint is its dye."""
  col = rubble(a, 64)
  L = lum(col)
  h = 0.8 * norm(highpass(blur(L, 0.5), 2)) + 0.4 * norm(highpass(L, 10))
  rough = np.full(L.shape, 0.88, np.float32)
  return col, h, rough, 0, 0.35, 0.95


SETS = {
  'medieval_oak': oak,
  'medieval_limestone': limestone,
  'medieval_limestone_broken': limestone_broken,
  'medieval_daub_broken': daub_broken,
  'medieval_hay': hay,
  'medieval_canvas': canvas,
}

TAKES = {}
