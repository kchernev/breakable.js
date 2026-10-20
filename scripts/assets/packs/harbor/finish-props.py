#!/usr/bin/env python3
# Harbor's finishing pass, which process-props.py runs after it (with `pp`, its globals): what a
# `yaw` or a `paintOut` box can't fix.
#
#   PACK=harbor blender -b --factory-startup --python scripts/assets/process-props.py [-- drum reel ...] [--no-render]
#
# - reel: Tripo turned the bolts of one flange into needles along the axle (cut off), and lightened
#   the black cable to a metallic grey and the weathered plywood to near white (recoloured by where
#   each texel lies: the cable between the flanges, the rest wood but the steel hub).
# - drum: one triangle missing from the wall (filled).
# Each is the GLB process-props.py has just made from its raw take, so nothing is applied twice. Its
# collider (props.mjs `round`) is fitted again to the result, its size, collider and triangle count
# go into index.json, and its previews are redrawn.

import json
import sys

import bmesh
import numpy as np
from mathutils import Matrix, Vector

if 'pp' not in globals():
  sys.exit('finish-props.py runs from process-props.py (PACK=harbor ... process-props.py)')

OUT, INDEX = pp['OUT'], pp['INDEX']


# --- Shared -----------------------------------------------------------------------------------------

def load(name):
  pp['reset']()
  obj = pp['flatten_and_join'](pp['import_glb'](OUT / f'{name}.glb'), name)
  pp['weld'](obj)
  return obj


def three_verts(obj):
  return np.array([pp['to_three'](v) for v in pp['verts_of'](obj)])


def images(obj):
  """name -> (image, pixels as an (h, w, 4) array)."""
  out = {}
  for name, img in pp['texture_arrays'](obj).items():
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    out[name] = (img, a.reshape(h, w, 4))
  return out


def store(img, a):
  img.pixels.foreach_set(a.ravel())
  img.update()


def of_kind(imgs, kind):
  return next(v for k, v in imgs.items() if k.endswith(kind))


def texel_labels(obj, size, label):
  """A label per texel of a size (h, w) map: label(position, normal) for each triangle's texels (three.js
  frame), 0 where no triangle lies, then grown into the gutters so mipmaps don't bleed the old colour."""
  me = obj.data
  me.calc_loop_triangles()
  uv = np.empty(len(me.loops) * 2, np.float32)
  me.uv_layers.active.data.foreach_get('uv', uv)
  uv = uv.reshape(-1, 2)
  co = three_verts(obj)
  loop_vert = np.empty(len(me.loops), np.int32)
  me.loops.foreach_get('vertex_index', loop_vert)
  h, w = size
  out = np.zeros((h, w), np.int8)
  for t in me.loop_triangles:
    P = co[loop_vert[list(t.loops)]]
    n = np.cross(P[1] - P[0], P[2] - P[0])
    if not n.any():
      continue
    r = pp['raster'](uv[list(t.loops)] * (w, h), P, (h, w))
    if r is None:
      continue
    ys, xs, pos = r
    out[ys, xs] = label(pos, n / np.linalg.norm(n))
  for _ in range(12):
    empty = out == 0
    if not empty.any():
      break
    grown = out.copy()
    for axis, step in ((0, 1), (0, -1), (1, 1), (1, -1)):
      shifted = np.roll(out, step, axis)
      take = empty & (grown == 0) & (shifted != 0)
      grown[take] = shifted[take]
    out = grown
  return out


def recentre(obj):
  """Bottom centre at the origin (Blender frame: z up)."""
  v = pp['verts_of'](obj)
  lo, hi = v.min(0), v.max(0)
  pp['transform'](obj, Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))


def save(obj, prop, entry):
  """Export obj as the prop's GLB and return its index entry (`entry` with its size, collider and triangles)."""
  name = prop['name']
  path = OUT / f'{name}.glb'
  pp['export'](obj, path)
  v = pp['verts_of'](obj)
  fields, worst, cover = pp['collider'](three_verts(obj), prop)
  out = {k: e for k, e in entry.items() if k not in ('colliders', 'hullVertices')}
  out.update(
    file=path.name,
    size=[round(float(s), 3) for s in np.abs(np.array(pp['to_three'](v.max(0) - v.min(0))))],
    **fields,
    triangles=pp['glb_triangles'](path),
  )
  print(f'[{name}] {out["triangles"]} tris, size {out["size"]} m, {path.stat().st_size / 1e6:.2f} MB; {pp["describe"](fields, worst, cover)}')
  return out


# --- Reel -------------------------------------------------------------------------------------------

# In process-props' frame for the current raw take: the axle along x, the flanges' battens end at
# x 0.494 on the +x side, and only the needles reach past it (to 0.53).
REEL_NEEDLES_PAST = 0.496
REEL_CABLE = (0.40, 0.57)  # the wound cable's surface lies 0.48–0.54 m from the axle; the flanges reach 0.7
REEL_FLANGE_INSIDE = 0.385  # the flanges' inner faces are at x ±0.40 once recentred (6 cm plywood)
REEL_HUB = 0.14  # the steel bushing round the arbor hole, kept as it is
CABLE_SRGB = 0.13  # mean of black rubber-sheathed cable
# Grey-weathered plywood as in the concept, with its stains drawn out a little
WOOD_SRGB = np.array([0.50, 0.46, 0.40])
WOOD_CONTRAST = 1.3


def finish_reel(obj):
  # The needles
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  needles = [v for v in bm.verts if v.co.x > REEL_NEEDLES_PAST]
  bmesh.ops.delete(bm, geom=needles, context='VERTS')
  bm.to_mesh(obj.data)
  bm.free()
  obj.data.update()
  print(f'[reel] cut {len(needles)} needle vertices')
  recentre(obj)

  # Which texels are cable (1), wood (2), the hub (3)
  v = three_verts(obj)
  centre = (v.min(0) + v.max(0)) / 2

  def label(pos, n):
    r = np.hypot(pos[:, 1] - centre[1], pos[:, 2] - centre[2])
    # Between the turns the cable faces along the axle too; only by the flanges does that mean wood
    between = (abs(pos[:, 0] - centre[0]) < REEL_FLANGE_INSIDE) | (abs(n[0]) < 0.6)
    return np.where(r < REEL_HUB, 3, np.where((r > REEL_CABLE[0]) & (r < REEL_CABLE[1]) & between, 1, 2))

  imgs = images(obj)
  cimg, colour = of_kind(imgs, '_color')
  mimg, mr = of_kind(imgs, '_metal_rough')
  labels = texel_labels(obj, colour.shape[:2], label)
  cable = labels == 1
  wood = labels == 2
  lum = colour[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
  colour[cable, :3] = (lum[cable] * CABLE_SRGB / lum[cable].mean())[:, None]
  mean = colour[wood, :3].mean(0)
  colour[wood, :3] = WOOD_SRGB * (1 + (colour[wood, :3] / mean - 1) * WOOD_CONTRAST)
  np.clip(colour, 0, 1, out=colour)
  mr[cable, 1] = 0.6  # rubber: a little sheen
  mr[cable, 2] = 0.0
  store(cimg, colour)
  store(mimg, mr)
  print(f'[reel] texels: {cable.mean() * 100:.0f}% cable, {wood.mean() * 100:.0f}% wood, '
        f'{(labels == 3).mean() * 100:.0f}% hub, {(labels == 0).mean() * 100:.0f}% unused')
  pp['reshade'](obj)


# --- Drum -------------------------------------------------------------------------------------------

def fill_triangles(obj):
  """Fills the three-edge holes, with the UVs of the corners around each new face."""
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  uv = bm.loops.layers.uv.active
  made = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=3)['faces']
  for f in made:
    for loop in f.loops:
      other = next((l for l in loop.vert.link_loops if l.face not in made), None)
      if other:
        loop[uv].uv = other[uv].uv
  bm.to_mesh(obj.data)
  bm.free()
  obj.data.update()
  print(f'[drum] filled {len(made)} triangle hole(s)')


def finish_drum(obj):
  fill_triangles(obj)
  pp['reshade'](obj)


# --- Main -------------------------------------------------------------------------------------------

FINISH = {'reel': finish_reel, 'drum': finish_drum}


def main():
  props = {p['name']: p for p in pp['load_props']()}
  index = json.loads(INDEX.read_text())
  for name, finish in FINISH.items():
    if pp['ONLY'] and name not in pp['ONLY']:  # not made again this time: finished already
      continue
    obj = load(name)
    finish(obj)
    e = index[name] = save(obj, props[name], index[name])
    INDEX.write_text(pp['dump_index'](index))
    if not pp['NO_RENDER']:
      dev, outs = pp['render_preview'](OUT / e['file'], name, e['collider'], e.get('colliders'))
      print(f'[{name}] preview ({dev}): {", ".join(outs)}')


main()
