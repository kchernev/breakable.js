#!/usr/bin/env python3
# Repairs Market Town's raw props before process-props.py:
#
#   PACK=medieval blender -b --factory-startup --python scripts/assets/packs/medieval/fix-props.py [-- name ...]
#
# Reads assets-src/packs/medieval/props/raw/<name>/model_tripo.glb (the model as generated; the first
# run moves model.glb there) and writes the repaired raw/<name>/model.glb, which process-props.py then
# reads as usual. For every prop it fills the texture gutter (the texels between UV islands) with the
# colours of the nearest island: Tripo leaves it flat grey, and decimation later stretches some
# triangles over island edges, which then show grey flecks. FIXES below drops, moves or copies
# connected parts (a part is picked when its bounds lie inside a box), clones texture over marks and
# grades colours.
# Boxes are in the raw model's frame as Blender imports it (Z up, longest side 1 unit), measured on
# these particular generations (model.json has the Tripo task); after regenerating a prop, measure
# again or drop its entry.
#
# Blender reads $XDG_RUNTIME_DIR/gvfs at startup, which hangs when that mount stops answering; then
# run it (and process-props.py) with XDG_RUNTIME_DIR pointing at an empty directory.

import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[4]
RAW = ROOT / f'assets-src/packs/{os.environ.get("PACK") or "medieval"}/props/raw'
ONLY = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

FIXES = {
  # Tripo added two taps on the side the concept didn't show (it was asked for none), and painted dark
  # marks and drips under them: drop the taps, and cover the marks with the staves 50 degrees round
  # the barrel (its axis is the vertical through x 0.0285, y 0)
  'barrel': {
    'drop': [
      ((-0.40, -0.11, -0.17), (-0.28, -0.03, -0.06)),
      ((-0.40, -0.11, 0.17), (-0.28, -0.03, 0.26)),
    ],
    'clone': [
      (((-0.37, -0.14, -0.20), (-0.27, 0.0, -0.04)), 50, (0.0285, 0)),
      (((-0.37, -0.14, 0.09), (-0.27, 0.0, 0.255)), 50, (0.0285, 0)),
    ],
  },
  'handcart': {
    # The wheels (with their hubs, caps and spokes) came out off one axis, 0.044 apart along the cart
    # and 0.021 in height, and hanging 0.009 and 0.031 below the legs' feet (z -0.142). Centre both
    # on x -0.1825 with their bottoms level with the feet, so the cart stands on all four.
    'move': [
      (((-0.36, -0.33, -0.16), (-0.045, -0.17, 0.15)), (0.022, 0, 0.009)),
      (((-0.32, 0.165, -0.18), (0.0, 0.33, 0.14)), (-0.022, 0, 0.031)),
    ],
    # Nothing joined the hubs: an axle-tree under the bed, from the hubs' insides (|y| 0.17) and up to
    # the bed's underside (z 0.043), made from a copy of the left shaft turned across the cart.
    'copy': [
      (((-0.20, -0.15, 0.0), (0.43, -0.105, 0.06)), ((-0.2025, -0.19, -0.019), (-0.1625, 0.19, 0.045))),
    ],
  },
  # Tripo's de-lighting left the hay pale and grey, sRGB about (189, 174, 149) against the concept's
  # gold and the hay bales' (158, 128, 82): warm it to a dry gold, leaving the grey wood as it is
  'haywagon': {
    'grade': ((186, 152, 96), 20, 45),
  },
}


def parts_of(bm):
  """Connected face sets with their bounds."""
  seen, parts = set(), []
  for f in bm.faces:
    if f in seen:
      continue
    stack, faces = [f], []
    seen.add(f)
    while stack:
      g = stack.pop()
      faces.append(g)
      for e in g.edges:
        for h in e.link_faces:
          if h not in seen:
            seen.add(h)
            stack.append(h)
    co = np.array([v.co[:] for g in faces for v in g.verts])
    parts.append((faces, co.min(0), co.max(0)))
  return parts


def inside(parts, box):
  lo, hi = np.array(box[0]), np.array(box[1])
  return [p for p in parts if np.all(p[1] >= lo) and np.all(p[2] <= hi)]


def verts_of(faces):
  return list({v for f in faces for v in f.verts})


def raster(p, P, h, w, slack=1.0):
  """The texels of UV triangle p (3x2, pixels), with `slack` pixels round it so seams are covered:
  rows, columns and the 3D point of each (interpolated from the corners P)."""
  x0, y0 = np.maximum(np.floor(p.min(0)).astype(int) - 1, 0)
  x1, y1 = np.minimum(np.ceil(p.max(0)).astype(int) + 1, (w, h))
  (ax, ay), (bx, by), (cx, cy) = p
  d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  if x1 <= x0 or y1 <= y0 or abs(d) < 1e-9:
    return None
  gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
  l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
  l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
  l3 = 1 - l1 - l2
  e = slack / max(1.0, np.ptp(p[:, 0]) + np.ptp(p[:, 1]))
  ok = (l1 >= -e) & (l2 >= -e) & (l3 >= -e)
  pos = l1[ok, None] * P[0] + l2[ok, None] * P[1] + l3[ok, None] * P[2]
  return gy[ok].astype(int), gx[ok].astype(int), pos


def triangles(bm, uvl, w, h):
  """Each face's triangles as (UV in pixels, 3D corners)."""
  for f in bm.faces:
    UV = np.array([l[uvl].uv[:] for l in f.loops]) * (w, h)
    P = np.array([v.co[:] for v in f.verts])
    for i in range(1, len(P) - 1):
      yield UV[[0, i, i + 1]], P[[0, i, i + 1]]


def pixels(img):
  w, h = img.size
  px = np.empty(w * h * 4, np.float32)
  img.pixels.foreach_get(px)
  return px.reshape(h, w, 4)


def store(img, px):
  img.pixels.foreach_set(px.ravel())
  img.update()


def clone(bm, images, box, degrees, axis):
  """Texels of the surface inside `box` take every map's texel from the surface point turned `degrees`
  about the vertical through `axis` (x, y): on a round body that is the same staves and hoops beside it."""
  w, h = images[0].size
  lo, hi = np.array(box[0]), np.array(box[1])
  turn = Matrix.Translation((axis[0], axis[1], 0)) @ Matrix.Rotation(math.radians(degrees), 4, 'Z') @ Matrix.Translation((-axis[0], -axis[1], 0))
  corners = np.array([(turn @ Vector((x, y, z)))[:] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
  slo, shi = corners.min(0) - 0.02, corners.max(0) + 0.02
  dst, src = [], []
  for UV, P in triangles(bm, bm.loops.layers.uv.active, w, h):
    near_dst = np.all(P.max(0) >= lo - 0.01) and np.all(P.min(0) <= hi + 0.01)
    near_src = np.all(P.max(0) >= slo) and np.all(P.min(0) <= shi)
    if not (near_dst or near_src):
      continue
    r = raster(UV, P, h, w)
    if r is None:
      continue
    ys, xs, pos = r
    inb = np.all((pos >= lo) & (pos <= hi), axis=1)
    if near_dst:
      dst.append((ys[inb], xs[inb], pos[inb]))
    if near_src:
      src.append((ys[~inb], xs[~inb], pos[~inb]))
  dy, dx, dpos = (np.concatenate(c) for c in zip(*dst))
  sy, sx, spos = (np.concatenate(c) for c in zip(*src))
  tree = KDTree(len(spos))
  for i, p in enumerate(spos):
    tree.insert(p, i)
  tree.balance()
  pick = np.array([tree.find(turn @ Vector(p))[1] for p in dpos])
  for img in images:
    px = pixels(img)
    px[dy, dx] = px[sy[pick], sx[pick]]
    store(img, px)
  return len(dy)


def grade(img, target, soft, hard):
  """Moves the yellow texels' colour toward `target` (sRGB 0-255): each texel by how yellow it is,
  (R + G) / 2 - B ramping from `soft` to `hard` (0-255), scaled in linear light by the gains that take
  the clearly yellow texels' mean to the target. Greys (wood, iron) keep theirs."""
  px = pixels(img)
  rgb = px[..., :3]
  yellow = (rgb[..., 0] + rgb[..., 1]) / 2 - rgb[..., 2]
  t = np.clip((yellow * 255 - soft) / (hard - soft), 0, 1)
  weight = t * t * (3 - 2 * t)
  lin = np.clip(rgb, 0, 1) ** 2.2
  gains = (np.array(target) / 255) ** 2.2 / lin[weight > 0.99].mean(0)
  graded = np.clip(lin * gains, 0, 1) ** (1 / 2.2)
  px[..., :3] = rgb + weight[..., None] * (graded - rgb)
  store(img, px)
  return float((weight > 0.5).mean()), gains


def nearest(known):
  """For every texel, the row and column of the nearest known texel (jump flooding)."""
  h, w = known.shape
  yy, xx = np.mgrid[0:h, 0:w].astype(np.int32)
  sy = np.where(known, yy, -1)
  sx = np.where(known, xx, -1)
  far = np.int32(2 ** 30)
  k = 1 << (max(h, w).bit_length() - 1)
  while k >= 1:
    for dy in (-k, 0, k):
      for dx in (-k, 0, k):
        if dy == dx == 0:
          continue
        # The seed the texel at (+dy, +dx) has found
        ny = np.full((h, w), -1, np.int32)
        nx = np.full((h, w), -1, np.int32)
        dst = (slice(max(-dy, 0), h - max(dy, 0)), slice(max(-dx, 0), w - max(dx, 0)))
        src = (slice(max(dy, 0), h - max(-dy, 0)), slice(max(dx, 0), w - max(-dx, 0)))
        ny[dst], nx[dst] = sy[src], sx[src]
        dn = np.where(ny >= 0, (ny - yy) ** 2 + (nx - xx) ** 2, far)
        dc = np.where(sy >= 0, (sy - yy) ** 2 + (sx - xx) ** 2, far)
        better = dn < dc
        sy = np.where(better, ny, sy)
        sx = np.where(better, nx, sx)
    k //= 2
  return sy, sx


def fill_gutter(bm, images):
  """Texels no triangle covers take the colour of the nearest texel one does, so each UV island's
  edge carries on outward (for triangles decimation stretches over it, and for mipmaps)."""
  w, h = images[0].size
  covered = np.zeros((h, w), bool)
  # Only texels whose centres are inside: the edge texels round an island may hold the gutter's grey
  for UV, P in triangles(bm, bm.loops.layers.uv.active, w, h):
    r = raster(UV, P, h, w, slack=0)
    if r is not None:
      covered[r[0], r[1]] = True
  sy, sx = nearest(covered)
  gap = ~covered
  for img in images:
    px = pixels(img)
    px[gap] = px[sy[gap], sx[gap]]
    store(img, px)
  return gap.mean()


def fix(name, ops):
  src, out = RAW / name / 'model_tripo.glb', RAW / name / 'model.glb'
  if not src.exists():
    out.rename(src)
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=str(src))
  obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
  obj.data.transform(obj.matrix_world)
  obj.matrix_world = Matrix.Identity(4)
  images = list({n.image for m in obj.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image})
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  # The GLB splits vertices at UV seams; weld so each part is one connected set (UVs live on corners)
  bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
  parts = parts_of(bm)

  for box in ops.get('drop', []):
    picked = inside(parts, box)
    print(f'[{name}] drop {len(picked)} part(s), {sum(len(p[0]) for p in picked)} faces, in {box}')
    bmesh.ops.delete(bm, geom=verts_of([f for p in picked for f in p[0]]), context='VERTS')
    parts = parts_of(bm)
  for box, offset in ops.get('move', []):
    picked = inside(parts, box)
    print(f'[{name}] move {len(picked)} part(s), {sum(len(p[0]) for p in picked)} faces, in {box} by {offset}')
    bmesh.ops.translate(bm, verts=verts_of([f for p in picked for f in p[0]]), vec=Vector(offset))
  parts = parts_of(bm)
  for box, (lo, hi) in ops.get('copy', []):
    picked = inside(parts, box)
    print(f'[{name}] copy {len(picked)} part(s), {sum(len(p[0]) for p in picked)} faces, in {box} into {lo}..{hi}')
    dup = bmesh.ops.duplicate(bm, geom=[f for p in picked for f in p[0]])
    new = [g for g in dup['geom'] if isinstance(g, bmesh.types.BMVert)]
    # A quarter turn about Z, then stretch the copy's bounds onto lo..hi
    bmesh.ops.rotate(bm, verts=new, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Z'))
    co = np.array([v.co[:] for v in new])
    a, b = co.min(0), co.max(0)
    lo, hi = np.array(lo), np.array(hi)
    k = (hi - lo) / (b - a)
    for v in new:
      v.co = Vector(lo + (np.array(v.co[:]) - a) * k)
  for box, degrees, axis in ops.get('clone', []):
    n = clone(bm, images, box, degrees, axis)
    print(f'[{name}] clone {n} texels in {box} from {degrees} degrees round')
  if 'grade' in ops:
    colour = next(n.image for m in obj.data.materials for n in m.node_tree.nodes
                  if n.type == 'TEX_IMAGE' and n.image and any(l.to_node.type == 'BSDF_PRINCIPLED' for l in n.outputs['Color'].links))
    share, gains = grade(colour, *ops['grade'])
    print(f'[{name}] graded {share * 100:.0f}% of the colour map toward {ops["grade"][0]} (linear gains {np.round(gains, 2).tolist()})')
  print(f'[{name}] filled the gutter ({fill_gutter(bm, images) * 100:.0f}% of the texture)')

  bm.to_mesh(obj.data)
  bm.free()
  # Moved and turned parts would keep the imported normals; process-props.py reshades anyway
  if obj.data.has_custom_normals:
    with bpy.context.temp_override(object=obj, active_object=obj):
      bpy.ops.mesh.customdata_custom_splitnormals_clear()
  obj.data.update()
  bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=False, export_yup=True,
                            export_image_format='AUTO', export_animations=False, export_extras=False)
  print(f'[{name}] wrote {out} ({out.stat().st_size / 1e6:.1f} MB)')


for d in sorted(RAW.iterdir()):
  if (not ONLY or d.name in ONLY) and ((d / 'model.glb').exists() or (d / 'model_tripo.glb').exists()):
    fix(d.name, FIXES.get(d.name, {}))
