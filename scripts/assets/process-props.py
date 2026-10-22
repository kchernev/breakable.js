#!/usr/bin/env python3
# Turns the raw image-to-3D street props (assets-src/props/raw/<name>/model.glb, made by
# generate-props.mjs from props.mjs) into game-ready GLBs in public/models, and keeps
# public/models/index.json (size, mass, collider, triangle count, description per prop) up to date.
#
#   blender -b --factory-startup --python scripts/assets/process-props.py -- [name ...] [--no-render] [--colliders] [--no-finish]
#
# Per prop: import, flatten the hierarchy and join the parts into one mesh (materials kept), weld the
# per-triangle vertices the image-to-3D GLB comes with, decimate to the triangle budget, square it to
# the axes (the footprint's minimum-area rectangle, long side along the length; the raw models come
# upright) plus the prop's `yaw` from props.mjs, so the front faces -Z and up is +Y in the exported
# glTF (three.js convention); scale it to its real size (and by its `scale`, per axis); put the
# origin at the bottom centre; paint out made-up badges and lettering (`paintOut` boxes); keep its
# metal/rough map within its `roughness` and `metalness` limits; make its `paint` tintable (a mask in
# the colour map's alpha) and its `glow` boxes an emissive map; shrink the textures; export a GLB with
# WebP images; compute a convex collider of the 12 points Destruction collides a prop as (a round
# one's 16-sided prism, `round`; a hull for each of its `parts`, index.json's colliders); then
# re-import the exported file and render Cycles previews of it to assets-src/props/previews:
# <name>.png (front three-quarter view), <name>_back.png (rear three-quarter) and <name>_collider.png
# (the collider as a red cage).
#
# --colliders: only fit the colliders again, to the GLBs as they are (index.json is rewritten, the
# GLBs aren't). A pack's own last step, scripts/assets/packs/<id>/finish-props.py, runs after (as
# __main__, with the same arguments, and `pp`: this script's globals, its helpers and settings);
# --no-finish skips it, and so does --colliders (it may rework the models). Loading this script
# with another __name__ doesn't run it.
#
# Frames: Blender is Z-up; the exporter maps Blender (x, y, z) to glTF (x, z, -y). So in Blender the
# front faces +Y, and everything written to index.json is converted to the glTF/three.js frame.

import json
import math
import os
import runpy
import struct
import subprocess
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
# PACK=<name>: a world's own pack (scripts/assets/pack.mjs has the layout)
PACK = os.environ.get('PACK') or None
BASE = ROOT / f'assets-src/packs/{PACK}/props' if PACK else ROOT / 'assets-src/props'
RAW = BASE / 'raw'
PREVIEWS = BASE / 'previews'
OUT = ROOT / f'public/packs/{PACK}/models' if PACK else ROOT / 'public/models'
INDEX = OUT / 'index.json'
LIST = ROOT / f'scripts/assets/packs/{PACK}/props.mjs' if PACK else ROOT / 'scripts/assets/props.mjs'

# Destruction collides a prop as at most this many of its points (maxHullVertices): given more, it
# picks that many itself, without knowing which carry it. A round prop's prism has more, and says so
# (index.json's hullVertices; the solver's limit is MAX_POINTS)
COLLIDER_POINTS = 12
MAX_POINTS = 32
ROUND_SIDES = 16
WEBP_QUALITY = 82
SHARP_ANGLE = math.radians(60)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
NO_RENDER = '--no-render' in argv
COLLIDERS_ONLY = '--colliders' in argv
NO_FINISH = '--no-finish' in argv
ONLY = [a for a in argv if not a.startswith('--')]
FINISH = ROOT / f'scripts/assets/packs/{PACK}/finish-props.py' if PACK else None


def load_props():
  """props.mjs is the one list of props; ask node for it."""
  js = 'import(process.argv[1]).then((m) => process.stdout.write(JSON.stringify(m.props)))'
  out = subprocess.run(['node', '-e', js, str(LIST)], check=True, capture_output=True, text=True)
  return json.loads(out.stdout)


def to_three(v):
  """Blender (Z-up, front +Y) to glTF / three.js (Y-up, front -Z)."""
  return [v[0], v[2], -v[1]]


# --- Scene helpers -----------------------------------------------------------------------------

def reset():
  bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
  bpy.ops.import_scene.gltf(filepath=str(path))
  return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def flatten_and_join(meshes, name):
  """Bakes every mesh's world transform into its data, drops the other nodes, joins into one object."""
  for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    if o.data.users > 1:
      o.data = o.data.copy()
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
  for o in list(bpy.context.scene.objects):
    if o.type != 'MESH':
      bpy.data.objects.remove(o, do_unlink=True)
  obj = meshes[0]
  if len(meshes) > 1:
    for o in meshes:
      o.select_set(True)
    bpy.context.view_layer.objects.active = obj
    with bpy.context.temp_override(active_object=obj, selected_editable_objects=meshes):
      bpy.ops.object.join()
  obj.name = obj.data.name = name
  return obj


def weld(obj):
  """The image-to-3D GLBs come with every vertex split per triangle (the importer's merge option
  doesn't undo it); weld coincident vertices so decimation sees one connected surface. UVs and
  materials live on the face corners, so their seams survive."""
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  before = len(bm.verts)
  size = max(np.ptp(np.array([v.co[:] for v in bm.verts]), axis=0))
  bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=size * 1e-5)
  bm.to_mesh(obj.data)
  bm.free()
  obj.data.update()
  return before, len(obj.data.vertices)


def verts_of(obj):
  co = np.empty(len(obj.data.vertices) * 3, np.float64)
  obj.data.vertices.foreach_get('co', co)
  return co.reshape(-1, 3)


def tri_count(mesh):
  return sum(len(p.vertices) - 2 for p in mesh.polygons)


def transform(obj, m):
  obj.data.transform(m)
  obj.data.update()


# --- Orientation, size, origin --------------------------------------------------------------------

def hull_2d(p):
  """Monotone-chain convex hull of 2D points, counter-clockwise."""
  p = np.unique(np.round(p, 6), axis=0)
  if len(p) < 3:
    return p
  p = p[np.lexsort((p[:, 1], p[:, 0]))]

  def half(pts):
    h = []
    for q in pts:
      while len(h) >= 2 and np.cross(h[-1] - h[-2], q - h[-2]) <= 0:
        h.pop()
      h.append(q)
    return h

  lower, upper = half(p), half(p[::-1])
  return np.array(lower[:-1] + upper[:-1])


def footprint_angle(v):
  """Angle (about Z) of the footprint's minimum-area bounding rectangle."""
  h = hull_2d(v[:, :2])
  best = (math.inf, 0.0)
  for i in range(len(h)):
    e = h[(i + 1) % len(h)] - h[i]
    a = math.atan2(e[1], e[0])
    c, s = math.cos(-a), math.sin(-a)
    r = h @ np.array([[c, s], [-s, c]])
    area = np.ptp(r[:, 0]) * np.ptp(r[:, 1])
    if area < best[0]:
      best = (area, a)
  return best[1]


def orient_scale_place(obj, prop):
  v = verts_of(obj)
  # Square to the axes: the footprint rectangle's sides along X and Y, its long side along Y.
  a = footprint_angle(v)
  transform(obj, Matrix.Rotation(-a, 4, 'Z'))
  v = verts_of(obj)
  if np.ptp(v[:, 0]) > np.ptp(v[:, 1]):
    transform(obj, Matrix.Rotation(math.radians(90), 4, 'Z'))
  # Which end is the front is a judgement call made by looking at the previews: props.mjs `yaw`
  # (degrees about up, counter-clockwise seen from above, same sense in Blender and three.js).
  if prop.get('yaw'):
    transform(obj, Matrix.Rotation(math.radians(prop['yaw']), 4, 'Z'))
  v = verts_of(obj)
  ext = np.ptp(v, axis=0)
  current = max(ext[0], ext[1]) if prop['fit'] == 'length' else ext[2]
  transform(obj, Matrix.Scale(prop['metres'] / current, 4))
  # `scale`: [x, y, z] (three.js axes) after the fit, to stretch a model to the size wanted
  if prop.get('scale'):
    sx, sy, sz = prop['scale']
    transform(obj, Matrix.Diagonal((sx, sz, sy, 1)))
  v = verts_of(obj)
  lo, hi = v.min(0), v.max(0)
  transform(obj, Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))


# --- Mesh budget and shading ------------------------------------------------------------------------

def decimate(obj, max_tris):
  """Collapse-decimate to at most max_tris (a second pass if open edges made the first stop short)."""
  for _ in range(3):
    n = tri_count(obj.data)
    if n <= max_tris:
      break
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = max_tris / n * 0.99
    mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = obj.data
    obj.modifiers.remove(mod)
    obj.data = mesh
    bpy.data.meshes.remove(old)
    mesh.name = obj.name
  return tri_count(obj.data)


def reshade(obj):
  """The imported custom normals don't survive decimation: smooth shading, hard edges past SHARP_ANGLE."""
  bpy.context.view_layer.objects.active = obj
  with bpy.context.temp_override(object=obj, active_object=obj):
    if obj.data.has_custom_normals:
      bpy.ops.mesh.customdata_custom_splitnormals_clear()
  obj.data.shade_smooth()
  obj.data.set_sharp_from_angle(angle=SHARP_ANGLE)


def boundary_edges(obj):
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  n = sum(1 for e in bm.edges if e.is_boundary)
  bm.free()
  return n


def tidy_names(obj, name):
  """Name the material(s) after the prop and the images after what they are (by what they feed:
  a raw model's emissive map, if it has one, is kept and named as such)."""
  for i, slot in enumerate(obj.material_slots):
    if not slot.material:
      continue
    slot.material.name = name if len(obj.material_slots) == 1 else f'{name}_{i}'
    for node in slot.material.node_tree.nodes:
      if node.type == 'TEX_IMAGE' and node.image and node.outputs['Color'].links:
        link = node.outputs['Color'].links[0]
        to = link.to_node
        if to.type == 'BSDF_PRINCIPLED':
          kind = {'Base Color': 'color', 'Emission Color': 'emissive'}.get(link.to_socket.name)
        else:
          kind = {'NORMAL_MAP': 'normal', 'SEPARATE_COLOR': 'metal_rough'}.get(to.type)
        if kind:
          node.image.name = f'{slot.material.name}_{kind}'


def texture_arrays(obj):
  """The base colour, normal and metal/rough images of the prop (by name, see tidy_names)."""
  out = {}
  for slot in obj.material_slots:
    for node in slot.material.node_tree.nodes:
      if node.type == 'TEX_IMAGE' and node.image and node.image.name not in out:
        out[node.image.name] = node.image
  return out


def raster(p, P, size):
  """The texels of UV triangle p (3x2, pixels) with about 1.5 px of slack: (ys, xs, 3D position of
  each, interpolated from the corners P (3x3))."""
  h, w = size
  x0, y0 = np.floor(p.min(0)).astype(int) - 2
  x1, y1 = np.ceil(p.max(0)).astype(int) + 2
  x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
  (ax, ay), (bx, by), (cx, cy) = p
  d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  if x1 <= x0 or y1 <= y0 or abs(d) < 1e-9:
    return None
  gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
  l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
  l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
  l3 = 1 - l1 - l2
  e = 1.5 / max(1.0, np.ptp(p[:, 0]) + np.ptp(p[:, 1]))
  ok = (l1 >= -e) & (l2 >= -e) & (l3 >= -e)
  pos = l1[ok, None] * P[0] + l2[ok, None] * P[1] + l3[ok, None] * P[2]
  return gy[ok].astype(int), gx[ok].astype(int), pos


def dominant(texels, levels=12):
  """The mean of the most common colour (texels binned `levels` steps per channel)."""
  q = np.clip((texels[:, :3] * levels).astype(int), 0, levels - 1)
  key = (q[:, 0] * levels + q[:, 1]) * levels + q[:, 2]
  best = np.bincount(key).argmax()
  return texels[key == best].mean(0)


def paint_out(obj, boxes, ring=0.05, tolerance=0.12):
  """Covers what the image-to-3D model invented on the side it couldn't see (a maker's badge, fake
  lettering). Of the texels whose surface point is inside a box (three.js frame, metres), those that
  differ from the paint around it (the dominant colour of a `ring`-wide band around the box) by more
  than `tolerance` get that paint, and the normal and metal/rough maps of the whole box get the
  band's dominant values (flat, plain paint)."""
  me = obj.data
  me.calc_loop_triangles()
  uv = np.empty(len(me.loops) * 2, np.float32)
  me.uv_layers.active.data.foreach_get('uv', uv)
  uv = uv.reshape(-1, 2)
  co = np.array([to_three(v.co) for v in me.vertices])
  loop_vert = np.empty(len(me.loops), np.int32)
  me.loops.foreach_get('vertex_index', loop_vert)
  tris = np.array([t.loops[:] for t in me.loop_triangles])
  images = texture_arrays(obj)
  pixels = {}
  for name, img in images.items():
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    pixels[name] = a.reshape(h, w, 4)
  colour = next(n for n in pixels if n.endswith('_color'))
  h, w = pixels[colour].shape[:2]

  for lo, hi in boxes:
    lo, hi = np.array(lo), np.array(hi)
    # Texels whose surface point is in the box (m_in) or in the band around it (m_ring)
    m_in, m_ring = np.zeros((h, w), bool), np.zeros((h, w), bool)
    P = co[loop_vert[tris]]
    touch = np.any(np.all((P >= lo - ring - 0.5) & (P <= hi + ring + 0.5), axis=2), axis=1)
    for t in np.nonzero(touch)[0]:
      r = raster(uv[tris[t]] * (w, h), P[t], (h, w))
      if r is None:
        continue
      ys, xs, pos = r
      inb = np.all((pos >= lo) & (pos <= hi), axis=1)
      near = np.all((pos >= lo - ring) & (pos <= hi + ring), axis=1) & ~inb
      m_in[ys[inb], xs[inb]] = True
      m_ring[ys[near], xs[near]] = True
    m_ring &= ~m_in
    paint = dominant(pixels[colour][m_ring])
    off = m_in & (np.abs(pixels[colour][..., :3] - paint[:3]).max(-1) > tolerance)
    for _ in range(2):  # and their anti-aliased edges
      grown = off.copy()
      grown[1:] |= off[:-1]; grown[:-1] |= off[1:]; grown[:, 1:] |= off[:, :-1]; grown[:, :-1] |= off[:, 1:]
      off = grown & m_in
    for name, a in pixels.items():
      if a.shape[:2] != (h, w):
        continue
      if name == colour:
        a[off] = paint
      else:  # a badge's relief is in the normal map all over it: flatten the whole patch
        a[m_in] = dominant(a[m_ring])
    print(f'  painted out {int(off.sum())} of {int(m_in.sum())} texels in {lo.tolist()}..{hi.tolist()} with {np.round(paint[:3], 3).tolist()}')
  for name, img in images.items():
    img.pixels.foreach_set(pixels[name].ravel())
    img.update()


def shrink_textures(obj, max_size):
  seen = []
  for slot in obj.material_slots:
    if not slot.material or not slot.material.use_nodes:
      continue
    for node in slot.material.node_tree.nodes:
      img = getattr(node, 'image', None)
      if node.type == 'TEX_IMAGE' and img and img not in seen:
        seen.append(img)
        w, h = img.size
        if max(w, h) > max_size:
          k = max_size / max(w, h)
          img.scale(max(1, round(w * k)), max(1, round(h * k)))
  return [(i.name, tuple(i.size)) for i in seen]


# --- Paint, glow, material limits ------------------------------------------------------------------

def pixels_of(img):
  w, h = img.size
  a = np.empty(w * h * 4, np.float32)
  img.pixels.foreach_get(a)
  return a.reshape(h, w, 4)


def store_pixels(img, a):
  img.pixels.foreach_set(a.ravel())
  img.update()


def principled(material):
  return next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if material and material.use_nodes else None


def linked_image(socket):
  """The image feeding a socket (directly, or through a Separate Color)."""
  if not socket.links:
    return None
  node = socket.links[0].from_node
  if node.type == 'SEPARATE_COLOR' and node.inputs['Color'].links:
    node = node.inputs['Color'].links[0].from_node
  return node.image if node.type == 'TEX_IMAGE' else None


def limit_maps(obj, prop):
  """Keeps roughness and metalness within the prop's `roughness` and `metalness` [min, max] (the
  metal/rough map's green and blue, or the material's values without one): image-to-3D models often
  come out glossy, or metallic where they aren't."""
  limits = [(k, c, prop[k]) for k, c in (('roughness', 1), ('metalness', 2)) if prop.get(k)]
  done = set()
  for slot in obj.material_slots:
    bsdf = principled(slot.material)
    if not bsdf:
      continue
    for key, channel, (lo, hi) in limits:
      socket = bsdf.inputs['Roughness' if key == 'roughness' else 'Metallic']
      img = linked_image(socket)
      if img is None:
        socket.default_value = min(max(socket.default_value, lo), hi)
      elif (img.name, channel) not in done:
        a = pixels_of(img)
        a[..., channel] = np.clip(a[..., channel], lo, hi)
        store_pixels(img, a)
        done.add((img.name, channel))
      print(f'  {key} kept within {lo}..{hi}')


def srgb_to_linear(c):
  return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
  return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0), 1 / 2.4) - 0.055)


def footprint(p, size):
  """The texels a UV triangle p (3x2, pixels) draws from, filtered: points over it, each with its
  four bilinear neighbours (flat indices)."""
  h, w = size
  n = int(np.ceil(np.ptp(p[:, 0]) + np.ptp(p[:, 1]))) * 2 + 2
  u, v = np.meshgrid(np.linspace(0, 1, n), np.linspace(0, 1, n))
  k = u + v <= 1
  pts = p[0] + u[k, None] * (p[1] - p[0]) + v[k, None] * (p[2] - p[0])
  x, y = np.floor(pts[:, 0] - 0.5).astype(int), np.floor(pts[:, 1] - 0.5).astype(int)
  xs, ys = np.concatenate([x, x + 1, x, x + 1]), np.concatenate([y, y, y + 1, y + 1])
  ok = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
  return np.unique(ys[ok] * w + xs[ok])


def covered(p, size):
  """The texels whose centre lies in UV triangle p (3x2, pixels) (flat indices)."""
  r = raster(p, p, size)
  if r is None:
    return np.zeros(0, int)
  ys, xs, _ = r
  (ax, ay), (bx, by), (cx, cy) = p
  d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  l1 = ((by - cy) * (xs + 0.5 - cx) + (cx - bx) * (ys + 0.5 - cy)) / d
  l2 = ((cy - ay) * (xs + 0.5 - cx) + (ax - cx) * (ys + 0.5 - cy)) / d
  ok = (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
  return ys[ok] * size[1] + xs[ok]


def box_sum(x, r):
  """Sums of x over (2r + 1)-texel squares (outside the image counts 0)."""
  c = np.pad(x, [(r + 1, r), (r + 1, r)] + [(0, 0)] * (x.ndim - 2)).cumsum(0).cumsum(1)
  k = 2 * r + 1
  return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def paint_rims(obj, a, weight, grow):
  """The light grey texels the image-to-3D bake leaves round the paint (a highlight along a panel's
  edge, a scratch, the strip a panel gap's sliver of a face is drawn from), which showed white on a
  copy painted another colour, made paint: those within `grow` texels of solid paint that no
  unpainted face draws from (chrome trim, glass, lights), and those only slivers (faces under a texel
  across) running between painted faces draw from. Not where an unpainted face lies. They take the
  solid paint round them. `a` (the colour map, greyed) and `weight` change. Returns how many."""
  me = obj.data
  me.calc_loop_triangles()
  h, w = weight.shape
  uv = np.empty(len(me.loops) * 2, np.float32)
  me.uv_layers.active.data.foreach_get('uv', uv)
  P = (uv.reshape(-1, 2) * (w, h))[np.array([t.loops[:] for t in me.loop_triangles])]
  V = [t.vertices[:] for t in me.loop_triangles]
  co = verts_of(obj)
  e = [P[:, 1] - P[:, 0], P[:, 2] - P[:, 1], P[:, 0] - P[:, 2]]
  area = np.abs(e[0][:, 0] * e[2][:, 1] - e[0][:, 1] * e[2][:, 0]) / 2
  sliver = 2 * area / np.maximum(np.max([np.hypot(*s.T) for s in e], axis=0), 1e-9) < 1
  drawn = [footprint(p, (h, w)) for p in P]
  painted = np.array([(weight.ravel()[f] > 0.5).mean() > 0.5 if len(f) else False for f in drawn])
  near, held = np.zeros(h * w, bool), np.zeros(h * w, bool)
  for t in np.nonzero(~sliver & ~painted)[0]:
    near[drawn[t]] = True
    held[covered(P[t], (h, w))] = True
  # Runs of slivers joined at their edges: a panel gap if 90 % of the edges round a run are painted
  faces = {}
  for t, f in enumerate(V):
    for k in range(3):
      faces.setdefault(tuple(sorted((f[k], f[(k + 1) % 3]))), []).append(t)
  gap = np.zeros(h * w, bool)
  seen = ~sliver
  for t0 in np.nonzero(sliver)[0]:
    if seen[t0]:
      continue
    seen[t0] = True
    run, todo, edge, edge_painted = [], [t0], 0.0, 0.0
    while todo:
      t = todo.pop()
      run.append(t)
      for k in range(3):
        key = tuple(sorted((V[t][k], V[t][(k + 1) % 3])))
        for o in faces[key]:
          if sliver[o] and not seen[o]:
            seen[o] = True
            todo.append(o)
          elif not sliver[o]:
            length = float(np.linalg.norm(co[key[0]] - co[key[1]]))
            edge += length
            edge_painted += length * painted[o]
    if edge_painted > 0.9 * edge > 0:
      for t in run:
        gap[drawn[t]] = True
  rgb = a[..., :3]
  mx = rgb.max(-1)
  light = (mx > 0.4) & ((mx - rgb.min(-1)) / np.maximum(mx, 1e-6) < 0.3)
  solid = weight > 0.9
  close = solid
  for _ in range(grow):
    c = close.copy()
    c[1:] |= close[:-1]; c[:-1] |= close[1:]; c[:, 1:] |= close[:, :-1]; c[:, :-1] |= close[:, 1:]
    close = c
  take = light & ~solid & ((close & ~near.reshape(h, w)) | gap.reshape(h, w)) & ~held.reshape(h, w)
  # The solid paint within 8 texels, or the paint's median where there's none
  total, count = box_sum(a * solid[..., None], 8), box_sum(solid.astype(np.float64), 8)
  fill = np.where(count[..., None] > 0, total / np.maximum(count, 1)[..., None], np.median(a[solid], axis=0))
  a[take, :3] = fill[take, :3]
  a[take, 3] = 1
  weight[take] = 1
  return int(take.sum())


def paint(obj, spec):
  """Makes the prop's paint tintable per copy (addProp's tint): the texels whose hue lies in `hue`
  ([from, to] degrees, through 360 when from > to) with saturation over `minSat` (default 0.25) turn
  grey, keeping their light and dark, and the colour map's alpha says how much each is paint (so
  rust, bare metal, tyres and glass keep their colour). The grey is the paint's brightest channel
  (0.6 or more, linear), so its colour times the grey's inverse, the entry's `tint`, gives the paint
  back. Alpha is written 1/255 for none: a WebP encoder may change the colour under alpha 0.
  `grow` (texels, default 0): the paint's rims next to solid paint count as paint that far out, and
  so does the light grey round it (paint_rims).
  Returns the tint (hex)."""
  img = next((img for name, img in texture_arrays(obj).items() if name.endswith('_color')), None)
  a = pixels_of(img)
  rgb = a[..., :3]
  mx, mn = rgb.max(-1), rgb.min(-1)
  sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
  d = np.maximum(mx - mn, 1e-6)
  r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
  hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
  lo, hi = spec['hue']
  # Degrees outside the range (0 inside), fading over 10 degrees; saturation fading over 0.1
  span = (hi - lo) % 360
  off = np.minimum((hue - hi) % 360, (lo - hue) % 360)
  off = np.where((hue - lo) % 360 <= span, 0, off)
  weight = np.clip(1 - off / 10, 0, 1) * np.clip((sat - spec.get('minSat', 0.25)) / 0.1, 0, 1)
  lin = srgb_to_linear(rgb)
  lum = lin @ np.array([0.2126, 0.7152, 0.0722])
  sure = weight > 0.9
  if not sure.any():
    raise ValueError(f'paint: no texel of hue {lo}..{hi} and saturation over {spec.get("minSat", 0.25)}')
  colour = np.median(lin[sure], axis=0)
  grey = max(0.6, float(colour.max()))
  level = lum / max(float(colour @ np.array([0.2126, 0.7152, 0.0722])), 1e-4) * grey
  neutral = linear_to_srgb(np.clip(level, 0, 1))[..., None]
  a[..., :3] = rgb + (neutral - rgb) * weight[..., None]
  a[..., 3] = 1 / 255 + weight * 254 / 255
  # Where the paint fades out beside solid paint (its edges, highlights just under minSat), a texel
  # took the grey but only part of the tint, and showed light on a copy painted another colour: out
  # to `grow` texels from solid paint they're paint, as the paint beside them
  rows, cols = weight.shape
  for _ in range(spec.get('grow', 0)):
    solid = weight > 0.9
    near = np.pad(a, [(1, 1), (1, 1), (0, 0)], mode='edge')
    held = np.pad(solid, 1, mode='edge')
    total = np.zeros_like(a)
    count = np.zeros(solid.shape, np.float32)
    for y, x in ((0, 1), (2, 1), (1, 0), (1, 2)):
      total += near[y:y + rows, x:x + cols] * held[y:y + rows, x:x + cols, None]
      count += held[y:y + rows, x:x + cols]
    rim = (count > 0) & ~solid & (weight > 0.02)
    a[rim] = total[rim] / count[rim, None]
    weight[rim] = 1
  if spec.get('grow'):
    print(f'  paint: {paint_rims(obj, a, weight, spec["grow"])} light grey texels round it made paint')
  # The exporter drops the alpha of an image read from a JPEG: the map goes into a new RGBA image
  w, h = img.size
  rgba = bpy.data.images.new(img.name + '_rgba', w, h, alpha=True)
  store_pixels(rgba, a)
  for m in bpy.data.materials:
    for node in m.node_tree.nodes if m.use_nodes else []:
      if node.type == 'TEX_IMAGE' and node.image == img:
        node.image = rgba
  name = img.name
  bpy.data.images.remove(img)
  rgba.name = name
  tint = linear_to_srgb(np.clip(colour / grey, 0, 1))
  print(f'  paint: {sure.mean() * 100:.0f}% of the texels, its colour (linear) {np.round(colour, 3).tolist()}, grey {grey:.2f}')
  return int(round(tint[0] * 255)) << 16 | int(round(tint[1] * 255)) << 8 | int(round(tint[2] * 255))


def glow(obj, boxes):
  """An emissive map from the prop's `glow` boxes (as Neon Alley's props-post.py): the texels of the
  triangles whose centre lies in a box (three.js frame, m) and brighter than its `minLuma` glow in its
  `color` ([r, g, b], or 'map': their own colour) at `strength` (KHR_materials_emissive_strength).
  PropMesh draws it; bloom does the rest."""
  me = obj.data
  me.calc_loop_triangles()
  uv = np.empty(len(me.loops) * 2, np.float32)
  me.uv_layers.active.data.foreach_get('uv', uv)
  uv = uv.reshape(-1, 2)
  co = np.array([to_three(v.co) for v in me.vertices])
  loop_vert = np.empty(len(me.loops), np.int32)
  me.loops.foreach_get('vertex_index', loop_vert)
  for index, slot in enumerate(obj.material_slots):
    bsdf = principled(slot.material)
    base = bsdf and linked_image(bsdf.inputs['Base Color'])
    if not base:
      continue
    colour = pixels_of(base)
    h, w = colour.shape[:2]
    luma = colour[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    emissive = np.zeros((h, w, 4), np.float32)
    emissive[..., 3] = 1
    for g in boxes:
      lo, hi = np.array(g['box'][0]), np.array(g['box'][1])
      mask = np.zeros((h, w), bool)
      count = 0
      for t in me.loop_triangles:
        P = co[loop_vert[list(t.loops)]]
        c = P.mean(0)
        if t.material_index != index or not np.all((c >= lo) & (c <= hi)):
          continue
        r = raster(uv[list(t.loops)] * (w, h), P, (h, w))
        if r is not None:
          mask[r[0], r[1]] = True
          count += 1
      amount = mask * np.clip((luma - g.get('minLuma', 0)) / 0.08, 0, 1)
      tone = colour[..., :3] if g.get('color', 'map') == 'map' else np.array(g['color'], np.float32)
      emissive[..., :3] = np.maximum(emissive[..., :3], amount[..., None] * tone)
      print(f'  glow on {count} triangles, {int((amount > 0.5).sum())} texels')
    img = bpy.data.images.new(f'{slot.material.name}_emissive', w, h)
    store_pixels(img, emissive)
    node = slot.material.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = img
    slot.material.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = max(g['strength'] for g in boxes)


# --- Collider ---------------------------------------------------------------------------------------

def hull(points):
  """Convex hull of points: (vertex array, outward face planes as (normal, offset))."""
  bm = bmesh.new()
  for p in points:
    bm.verts.new(p)
  res = bmesh.ops.convex_hull(bm, input=bm.verts[:], use_existing_faces=False)
  drop = set(res['geom_interior']) | set(res['geom_unused'])
  for g in drop:
    if isinstance(g, bmesh.types.BMVert) and g.is_valid:
      bm.verts.remove(g)
  bm.normal_update()
  verts = np.array([v.co[:] for v in bm.verts if v.link_faces])
  centre = verts.mean(0)
  planes = []
  for f in bm.faces:
    n = np.array(f.normal[:])
    d = n @ np.array(f.verts[0].co[:])
    if n @ centre > d:  # make it point outwards
      n, d = -n, -d
    planes.append((n, d))
  bm.free()
  return verts, planes


def hull_volume(verts):
  bm = bmesh.new()
  for p in verts:
    bm.verts.new(p)
  bmesh.ops.convex_hull(bm, input=bm.verts[:], use_existing_faces=False)
  vol = bm.calc_volume()
  bm.free()
  return abs(vol)


def outside(pts, v):
  """How far each of v lies outside the hull of pts."""
  _, planes = hull(pts)
  return (v @ np.array([n for n, _ in planes]).T - np.array([d for _, d in planes])).max(1)


def standing(v, count=COLLIDER_POINTS):
  """What it stands on (the four lowest points farthest toward its footprint's corners: wheels,
  feet), its top, then each time the point farthest outside their hull; then points other than the
  ground ones swapped for ones outside while that brings the farthest one closer (Harbor Yard's
  finish-props.py found these: chosen greedily alone, a forklift stood on three points)."""
  cand, _ = hull(v)
  ground = np.nonzero(cand[:, 1] < cand[:, 1].min() + 0.05 * max(1, np.ptp(cand[:, 1])))[0]
  chosen = []
  for a in math.pi / 4 + np.arange(4) * math.pi / 2:
    i = int(ground[np.argmax(cand[ground, 0] * math.cos(a) + cand[ground, 2] * math.sin(a))])
    if i not in chosen:
      chosen.append(i)
  fixed = len(chosen)
  top = int(np.argmax(cand[:, 1]))
  if top not in chosen:
    chosen.append(top)
  while len(chosen) < count:
    out = outside(cand[chosen], cand)
    out[chosen] = -np.inf
    j = int(np.argmax(out))
    if out[j] < 1e-3:
      break
    chosen.append(j)
  worst = outside(cand[chosen], cand).max()
  for _ in range(30):
    best = None
    for j in np.argsort(-outside(cand[chosen], cand))[:40]:
      if j in chosen:
        continue
      for k in range(fixed, len(chosen)):
        trial = chosen[:k] + [int(j)] + chosen[k + 1:]
        w = outside(cand[trial], cand).max()
        if w < worst - 1e-3:
          worst, best = w, trial
    if best is None:
      break
    chosen = best
  pts = cand[chosen]
  pts[:fixed, 1] = cand[:, 1].min()  # tyres are round: their patch's corners sit a little up
  return pts


def prism(v, axis, sides=ROUND_SIDES):
  """A prism of `sides` faces round the circle the shape turns on (about x, y or z through its
  middle), each face touching the circle, end to end, a face down: a drum, a reel or a barrel rests
  on a face without sinking, standing or on its side, and with 16 sides rolls (with 6, Harbor Yard's
  finish-props.py's hexagon, it doesn't)."""
  lo, hi = v.min(0), v.max(0)
  c = (lo + hi) / 2
  # The circle's plane, `a` the axis a face lies across: y (down) where y is in the plane
  a, b = {0: (1, 2), 1: (0, 2), 2: (1, 0)}[axis]
  radius = max(hi[a] - lo[a], hi[b] - lo[b]) / 2  # the box, not the farthest vertex: one odd rim vertex would lift it
  R = radius / math.cos(math.pi / sides)
  pts = []
  for t in (lo[axis], hi[axis]):
    for k in range(sides):
      ang = math.pi / sides + k * 2 * math.pi / sides
      p = c.copy()
      p[axis] = t
      p[a] += -R * math.cos(ang)
      p[b] += R * math.sin(ang)
      pts.append(p)
  return np.array(pts)


def fit(v, part):
  """The points (three.js frame) a prop or a part of it collides as, from its vertices: with `round:
  'x' | 'y' | 'z'` a prism about that axis (of `sides`, default 16, at most 16), else what it stands
  on and what keeps the hull closest to the model (standing)."""
  if not part.get('round'):
    return standing(v)
  sides = part.get('sides', ROUND_SIDES)
  if not 3 <= sides <= MAX_POINTS // 2:
    raise SystemExit(f'sides {sides}: 3 to {MAX_POINTS // 2}')
  return prism(v, 'xyz'.index(part['round']), sides)


def collider(v, prop):
  """index.json's collider fields for a prop, from its vertices (three.js frame): `collider`, the
  points it collides as (fit()); with `parts` (boxes [[x0, y0, z0], [x1, y1, z1]] in the same frame,
  each with its own `round` and `sides`), `colliders` too, the points of each part fitted to the
  vertices in its box (the first, the main body, carries the model), and `collider` their hull
  together; and `hullVertices` when a hull has more points than the 12 Destruction keeps by default
  (a round one's 32). With how far the model's farthest vertex lies outside them, and how much of
  the model's hull they cover (parts added up, overlaps twice)."""
  if prop.get('parts'):
    parts = []
    for part in prop['parts']:
      lo, hi = np.array(part['box'], dtype=float)
      inside = v[np.all((v >= lo) & (v <= hi), axis=1)]
      if len(inside) < 4:
        raise SystemExit(f'[{prop["name"]}] part {part["box"]}: {len(inside)} vertices in its box')
      parts.append(fit(inside, part))
    pts = hull(np.concatenate(parts))[0]
  else:
    parts = [fit(v, prop)]
    pts = parts[0]
  worst = float(np.min([outside(p, v) for p in parts], axis=0).max())
  cover = sum(hull_volume(p) for p in parts) / hull_volume(hull(v)[0])
  rounded = lambda points: [[round(float(c), 3) for c in p] for p in points]
  fields = {'collider': rounded(pts)}
  if prop.get('parts'):
    fields['colliders'] = [rounded(p) for p in parts]
  most = max(len(p) for p in parts)
  if most > COLLIDER_POINTS:
    fields['hullVertices'] = most
  return fields, worst, cover


# --- Export -----------------------------------------------------------------------------------------

def export(obj, path):
  for o in bpy.context.scene.objects:
    o.select_set(o == obj)
  bpy.context.view_layer.objects.active = obj
  path.parent.mkdir(parents=True, exist_ok=True)
  bpy.ops.export_scene.gltf(
    filepath=str(path),
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_materials='EXPORT',
    export_image_format='WEBP',
    export_image_quality=WEBP_QUALITY,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
  )


def glb_triangles(path):
  """Triangles in an exported GLB (the exporter drops degenerate ones, so count what was written)."""
  data = path.read_bytes()
  (n,) = struct.unpack_from('<I', data, 12)
  j = json.loads(data[20:20 + n])
  return sum(j['accessors'][p['indices']]['count'] // 3 for m in j['meshes'] for p in m['primitives'])


# --- Preview ----------------------------------------------------------------------------------------

def use_gpu(scene):
  prefs = bpy.context.preferences.addons['cycles'].preferences
  for kind in ('OPTIX', 'CUDA'):
    try:
      prefs.compute_device_type = kind
      prefs.refresh_devices()
    except TypeError:
      continue
    devs = [d for d in prefs.devices if d.type == kind]
    if devs:
      # Prefer a card that isn't driving the desktop (the A4000 here); else all of them.
      pick = [d for d in devs if 'A4000' in d.name] or devs
      for d in prefs.devices:
        d.use = d in pick
      scene.cycles.device = 'GPU'
      return f'{kind} {", ".join(d.name for d in pick)}'
  scene.cycles.device = 'CPU'
  return 'CPU'


def stage(scene):
  """A neutral grey ground with a faint 1 m checker (for judging scale), sky fill and a soft sun."""
  bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
  ground = bpy.context.active_object
  mat = bpy.data.materials.new('ground')
  mat.use_nodes = True
  nt = mat.node_tree
  bsdf = nt.nodes['Principled BSDF']
  bsdf.inputs['Roughness'].default_value = 0.8
  tc = nt.nodes.new('ShaderNodeTexCoord')
  ck = nt.nodes.new('ShaderNodeTexChecker')
  ck.inputs['Scale'].default_value = 1.0
  ck.inputs['Color1'].default_value = (0.30, 0.30, 0.30, 1)
  ck.inputs['Color2'].default_value = (0.36, 0.36, 0.36, 1)
  nt.links.new(tc.outputs['Object'], ck.inputs['Vector'])
  nt.links.new(ck.outputs['Color'], bsdf.inputs['Base Color'])
  ground.data.materials.append(mat)

  world = bpy.data.worlds.new('world')
  world.use_nodes = True
  bg = world.node_tree.nodes['Background']
  bg.inputs['Color'].default_value = (0.78, 0.82, 0.88, 1)
  bg.inputs['Strength'].default_value = 0.9
  scene.world = world

  sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
  sun.data.energy = 3.0
  sun.data.angle = math.radians(8)
  sun.rotation_euler = (math.radians(40), 0, math.radians(-35))
  scene.collection.objects.link(sun)


def camera_for(scene, lo, hi, azimuth, elevation=20.0, lens=50.0, margin=0.88):
  """A camera looking at the box lo..hi from azimuth (degrees from the front, +Y, toward +X) and
  elevation, backed off until every box corner is inside the frame."""
  cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
  cam.data.lens = lens
  scene.collection.objects.link(cam)
  scene.camera = cam
  az, el = math.radians(azimuth), math.radians(elevation)
  d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
  target = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) * 0.42))
  right = Vector((0, 0, 1)).cross(d).normalized()
  up = d.cross(right).normalized()
  r = scene.render
  tan_x = 18 / lens
  tan_y = tan_x * r.resolution_y / r.resolution_x
  dist = 0
  for x in (lo[0], hi[0]):
    for y in (lo[1], hi[1]):
      for z in (lo[2], hi[2]):
        c = Vector((x, y, z)) - target
        dist = max(dist, c @ d + abs(c @ right) / (tan_x * margin), c @ d + abs(c @ up) / (tan_y * margin))
  cam.location = target + d * dist
  cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
  return cam


def collider_object(points_three):
  """The collider's hull as a red wire cage (for the _collider preview)."""
  bm = bmesh.new()
  for x, y, z in points_three:
    bm.verts.new((x, -z, y))
  bmesh.ops.convex_hull(bm, input=bm.verts[:], use_existing_faces=False)
  me = bpy.data.meshes.new('collider')
  bm.to_mesh(me)
  bm.free()
  ob = bpy.data.objects.new('collider', me)
  bpy.context.scene.collection.objects.link(ob)
  wire = ob.modifiers.new('wire', 'WIREFRAME')
  wire.thickness = 0.008 * max(np.ptp(np.array(points_three), axis=0))
  mat = bpy.data.materials.new('collider')
  mat.use_nodes = True
  nt = mat.node_tree
  em = nt.nodes.new('ShaderNodeEmission')
  em.inputs['Color'].default_value = (1.0, 0.05, 0.02, 1)
  em.inputs['Strength'].default_value = 3.0
  nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
  me.materials.append(mat)
  return ob


def render_preview(glb, name, collider=None, parts=None):
  """Previews of a GLB: front and back three-quarter views, and with its collider (or each of its
  parts', given) as a red cage."""
  reset()
  scene = bpy.context.scene
  meshes = import_glb(glb)
  v = np.concatenate([np.array([o.matrix_world @ x.co for x in o.data.vertices]) for o in meshes])
  lo, hi = v.min(0), v.max(0)
  stage(scene)
  scene.render.engine = 'CYCLES'
  dev = use_gpu(scene)
  scene.cycles.samples = 96
  scene.cycles.use_denoising = True
  scene.render.resolution_x, scene.render.resolution_y = 768, 512
  scene.render.resolution_percentage = 100
  scene.render.image_settings.file_format = 'PNG'
  scene.view_settings.view_transform = 'AgX'
  PREVIEWS.mkdir(parents=True, exist_ok=True)
  outs = []
  for suffix, az in (('', 35), ('_back', 180 + 35)):
    cam = camera_for(scene, lo, hi, az)
    scene.render.filepath = str(PREVIEWS / f'{name}{suffix}.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    outs.append(scene.render.filepath)
  if collider:
    for points in parts or [collider]:
      collider_object(points)
    cam = camera_for(scene, lo, hi, 35)
    scene.render.filepath = str(PREVIEWS / f'{name}_collider.png')
    bpy.ops.render.render(write_still=True)
    outs.append(scene.render.filepath)
  return dev, outs


# --- Main -------------------------------------------------------------------------------------------

def process(prop):
  name = prop['name']
  raw = RAW / name / 'model.glb'
  reset()
  meshes = import_glb(raw)
  raw_tris = sum(tri_count(o.data) for o in meshes)
  obj = flatten_and_join(meshes, name)
  weld(obj)
  decimate(obj, prop['maxTriangles'])  # before sizing, since collapsing moves the extremes a little
  orient_scale_place(obj, prop)
  reshade(obj)
  holes = boundary_edges(obj)
  tidy_names(obj, name)
  if prop.get('paintOut'):
    paint_out(obj, prop['paintOut'])
  limit_maps(obj, prop)
  tint = paint(obj, prop['paint']) if prop.get('paint') else None
  if prop.get('glow'):
    glow(obj, prop['glow'])
  textures = shrink_textures(obj, prop['textureSize'])
  out = OUT / f'{name}.glb'
  export(obj, out)

  v = verts_of(obj)
  lo, hi = v.min(0), v.max(0)
  fields, worst, cover = collider(np.array([to_three(p) for p in v]), prop)
  size = np.abs(np.array(to_three(hi - lo)))
  entry = {
    'file': f'{name}.glb',
    'size': [round(float(s), 3) for s in size],
    'mass': prop['mass'],
    **fields,
    'triangles': glb_triangles(out),
    'description': prop['description'],
  }
  if tint is not None:
    entry.update(tint=tint, tintMask='alpha')
  print(f'[{name}] raw {raw_tris} tris, {len(meshes)} part(s) -> {entry["triangles"]} tris, {holes} open edges; '
        f'textures {textures}; size {entry["size"]} m; {out.stat().st_size / 1e6:.2f} MB; '
        f'{describe(fields, worst, cover)}')
  return entry


def describe(fields, worst, cover):
  parts = fields.get('colliders', [fields['collider']])
  return (f'collider {" + ".join(str(len(p)) for p in parts)} points, {cover * 100:.1f}% of the hull volume, '
          f'worst vertex {worst * 100:.1f} cm outside')


def dump_index(index):
  """index.json, readable: one prop field per line, one collider vertex (or part) per line."""
  lines = ['{']
  for i, (name, e) in enumerate(index.items()):
    lines.append(f'  {json.dumps(name)}: {{')
    fields = list(e.items())
    for j, (k, v) in enumerate(fields):
      comma = ',' if j < len(fields) - 1 else ''
      if k in ('collider', 'colliders'):
        pts = ',\n'.join(f'      {json.dumps(p)}' for p in v)
        lines.append(f'    {json.dumps(k)}: [\n{pts}\n    ]{comma}')
      elif k == 'shards':
        # (shatter-props.py's: a piece a line)
        parts = ',\n'.join(f'        {json.dumps(p)}' for p in v['parts'])
        lines.append(f'    "shards": {{\n      "file": {json.dumps(v["file"])},\n      "parts": [\n{parts}\n      ]\n    }}{comma}')
      else:
        lines.append(f'    {json.dumps(k)}: {json.dumps(v)}{comma}')
    lines.append('  }' + (',' if i < len(index) - 1 else ''))
  lines.append('}')
  return '\n'.join(lines) + '\n'


def refit(prop, entry):
  """A processed prop's collider fields fitted again to its GLB as it is (--colliders)."""
  reset()
  obj = flatten_and_join(import_glb(OUT / f'{prop["name"]}.glb'), prop['name'])
  weld(obj)
  fields, worst, cover = collider(np.array([to_three(p) for p in verts_of(obj)]), prop)
  print(f'[{prop["name"]}] {describe(fields, worst, cover)}')
  # Those no longer fitted (parts taken out of props.mjs, a prop no longer round) go
  return {**{k: v for k, v in entry.items() if k not in ('colliders', 'hullVertices')}, **fields}


def main():
  props = load_props()
  index = json.loads(INDEX.read_text()) if INDEX.exists() else {}
  if COLLIDERS_ONLY:
    todo = [p for p in props if (not ONLY or p['name'] in ONLY) and p['name'] in index]
  else:
    todo = [p for p in props if (not ONLY or p['name'] in ONLY) and (RAW / p['name'] / 'model.glb').exists()]
  for prop in todo:
    if COLLIDERS_ONLY:
      index[prop['name']] = refit(prop, index[prop['name']])
    else:
      index[prop['name']] = process(prop)
    # Written after every prop so a later failure doesn't lose the earlier ones
    order = [p['name'] for p in props]
    index = {k: index[k] for k in sorted(index, key=lambda k: order.index(k) if k in order else len(order))}
    INDEX.write_text(dump_index(index))
    if not NO_RENDER:
      e = index[prop['name']]
      dev, outs = render_preview(OUT / f'{prop["name"]}.glb', prop['name'], e['collider'], e.get('colliders'))
      print(f'[{prop["name"]}] preview ({dev}): {", ".join(outs)}')
  if not todo:
    print('nothing to process (no raw model.glb for the props asked for)')
  if FINISH and FINISH.exists() and not NO_FINISH:
    if COLLIDERS_ONLY:  # it may rework the models
      print(f'not run with --colliders: {FINISH}')
    else:
      print(f'finishing: {FINISH}')
      runpy.run_path(str(FINISH), init_globals={'pp': globals()}, run_name='__main__')


if __name__ == '__main__':
  main()
