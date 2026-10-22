#!/usr/bin/env python3
"""Breaks each prop of a pack into the pieces it shatters into, beside it: <name>.shards.glb, and
its index.json entry's `shards` (each piece's node, collider and mass). The game swaps a prop for
its pieces when it breaks (src/lib/destruction.ts, breakProp).

  blender -b --factory-startup --python scripts/assets/shatter-props.py -- [pack ...] [--only name,name]

`pack`: `base` (public/models) or a pack's id (public/packs/<id>/models); default all. Cars (the
base pack's taxi, sedan and van: the street's cars come apart instead) are left whole.

A prop's mesh (welded, so the image-to-3D model's cracks close) is cut into the Voronoi cells of
seeds spread over its surface (farthest apart, more for a bigger prop): each cell is the mesh
bisected by the plane halfway to each other seed, each cut filled flat in the colour inside it (the
average of its colour map, duller and darker; a cut that doesn't close is left open). The pieces keep the
prop's UVs and its material by name, which the game takes from the prop itself, so the file holds
only their shapes; each piece's collider is the hull of its points (at most 16 of them), its mass
the prop's by its share of the hulls' volume.

Frames: Blender is Z-up; the exporter maps Blender (x, y, z) to glTF (x, z, -y), as index.json is.
"""

import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = next((a.split('=', 1)[1] if '=' in a else ARGS[ARGS.index(a) + 1] for a in ARGS if a.startswith('--only')), None)
ONLY = set(ONLY.split(',')) if ONLY else None
PACKS = [a for a in ARGS if not a.startswith('--') and (ONLY is None or a not in ONLY)]
CARS = {'taxi', 'sedan', 'van'}
# Not props anyone breaks: the player's weapons
SKIP_PACKS = {'kit'}

# Pieces: about one per this volume of its box (m³), between these
PER_VOLUME = 0.012
FEWEST, MOST = 5, 14
HULL_POINTS = 16


def pack_dirs():
  out = []
  if not PACKS or 'base' in PACKS:
    out.append(('base', ROOT / 'public/models'))
  for d in sorted((ROOT / 'public/packs').glob('*/models')):
    pid = d.parent.name
    if pid in SKIP_PACKS or (PACKS and pid not in PACKS):
      continue
    if (d / 'index.json').exists():
      out.append((pid, d))
  return out


def gltf(v):
  return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def load(path):
  """The prop as one welded bmesh in Blender's frame, and its materials."""
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=str(path))
  objs = [o for o in bpy.data.objects if o.type == 'MESH']
  bm = bmesh.new()
  mats = []
  for o in objs:
    me = o.data.copy()
    me.transform(o.matrix_world)
    base = len(mats)
    for m in me.materials:
      mats.append(m)
    for p in me.polygons:
      p.material_index += base
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
  bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
  return bm, mats


def inside_colour(mats):
  """The colour inside it: its colour map's average (its base colour without one), darker."""
  for m in mats:
    if not m or not m.use_nodes:
      continue
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b:
      continue
    link = b.inputs['Base Color'].links
    if link and link[0].from_node.type == 'TEX_IMAGE' and link[0].from_node.image:
      img = link[0].from_node.image
      px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
      # (Where it's opaque or masked, alike: the mask is the paint, which is the prop too)
      return dim(px[:, :3].mean(0))
    return dim(b.inputs['Base Color'].default_value[:3])
  return [0.06, 0.06, 0.06]


def dim(c):
  """A colour as it is inside a thing painted it: duller (half way to its grey) and darker."""
  g = sum(c) / 3
  return [float(g + (x - g) * 0.5) * 0.4 for x in c]


def seeds_of(bm, k, rng):
  """`k` seeds spread over the surface, each as far from the others as can be, a little in."""
  bm.faces.ensure_lookup_table()
  areas = np.array([f.calc_area() for f in bm.faces])
  if areas.sum() <= 0:
    return []
  pick = rng.choices(range(len(bm.faces)), weights=areas, k=600)
  pts = []
  for i in pick:
    f = bm.faces[i]
    c = f.calc_center_median()
    pts.append(c - f.normal * 0.02)
  chosen = [pts[0]]
  d = [(p - chosen[0]).length for p in pts]
  while len(chosen) < k:
    i = int(np.argmax(d))
    chosen.append(pts[i])
    d = [min(d[j], (pts[j] - pts[i]).length) for j in range(len(pts))]
  return chosen


def cell(bm, seeds, i, inside_slot):
  """The part of `bm` nearer seed i than any other: cut at each halfway plane, the cuts filled."""
  out = bm.copy()
  s = seeds[i]
  others = sorted((j for j in range(len(seeds)) if j != i), key=lambda j: (seeds[j] - s).length)
  for j in others:
    if not out.faces:
      break
    n = (seeds[j] - s).normalized()
    co = (seeds[j] + s) / 2
    # (Nothing past the plane: no cut)
    if max(n.dot(v.co - co) for v in out.verts) <= 1e-5:
      continue
    geom = out.verts[:] + out.edges[:] + out.faces[:]
    res = bmesh.ops.bisect_plane(out, geom=geom, dist=1e-6, plane_co=co, plane_no=n, clear_outer=True)
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_valid]
    if not cut:
      continue
    try:
      made = bmesh.ops.triangle_fill(out, use_beauty=True, use_dissolve=False, edges=cut, normal=n)
    except Exception:
      continue
    for f in made.get('geom', []):
      if isinstance(f, bmesh.types.BMFace):
        f.material_index = inside_slot
        f.normal_update()
        if f.normal.dot(n) < 0:
          f.normal_flip()
        f.smooth = False
  bmesh.ops.delete(out, geom=[v for v in out.verts if not v.link_faces], context='VERTS')
  return out


def hull(points, most=HULL_POINTS):
  """At most `most` of the points, spread over their hull (the farthest from those taken, in turn)."""
  bm = bmesh.new()
  for p in points:
    bm.verts.new(p)
  res = bmesh.ops.convex_hull(bm, input=bm.verts)
  pts = [v.co.copy() for v in bm.verts if v.link_faces]
  bm.free()
  if len(pts) <= most:
    return pts
  c = sum(pts, Vector()) / len(pts)
  taken = [max(pts, key=lambda p: (p - c).length)]
  while len(taken) < most:
    taken.append(max(pts, key=lambda p: min((p - q).length for q in taken)))
  return taken


def hull_volume(points):
  bm = bmesh.new()
  for p in points:
    bm.verts.new(p)
  bmesh.ops.convex_hull(bm, input=bm.verts)
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
  v = abs(bm.calc_volume()) if bm.faces else 0.0
  bm.free()
  return v


def shatter(name, entry, folder):
  bm, mats = load(folder / entry['file'])
  if not bm.faces:
    return None
  lo = Vector([min(v.co[k] for v in bm.verts) for k in range(3)])
  hi = Vector([max(v.co[k] for v in bm.verts) for k in range(3)])
  size = hi - lo
  k = max(FEWEST, min(MOST, round(size.x * size.y * size.z / PER_VOLUME)))
  rng = random.Random(name)
  seeds = seeds_of(bm, k, rng)
  # Its pieces: its own materials (placeholders: the game takes the prop's by name) and the inside
  inside = bpy.data.materials.new(f'{name}.inside')
  inside.use_nodes = True
  b = inside.node_tree.nodes['Principled BSDF']
  c = inside_colour(mats)
  b.inputs['Base Color'].default_value = (*c, 1)
  b.inputs['Roughness'].default_value = 0.9
  slots = []
  for m in mats:
    p = bpy.data.materials.new(m.name if m else 'material')
    p.use_nodes = True
    slots.append(p)
  # (Its own names: the copies above got .001 suffixes beside the imported ones)
  for m, p in zip(mats, slots):
    if m:
      old = m.name
      m.name = old + '.src'
      p.name = old
  inside_slot = len(slots)
  objs, parts = [], []
  for i in range(len(seeds)):
    piece = cell(bm, seeds, i, inside_slot)
    if len(piece.faces) < 4:
      piece.free()
      continue
    pts = [v.co.copy() for v in piece.verts]
    me = bpy.data.meshes.new(f'shard_{len(objs)}')
    piece.to_mesh(me)
    piece.free()
    for p in slots:
      me.materials.append(p)
    me.materials.append(inside)
    o = bpy.data.objects.new(me.name, me)
    bpy.context.collection.objects.link(o)
    objs.append(o)
    parts.append({'node': me.name, 'collider': [gltf(p) for p in hull(pts)], 'volume': hull_volume(pts)})
  bm.free()
  if not objs:
    return None
  total = sum(p['volume'] for p in parts) or 1
  for p in parts:
    p['mass'] = round(entry['mass'] * p.pop('volume') / total, 5)
  for o in bpy.data.objects:
    o.select_set(o in objs)
  out = folder / f'{name}.shards.glb'
  bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True, export_yup=True, export_materials='EXPORT', export_image_format='NONE')
  print(f'{name}: {len(objs)} pieces, {sum(len(o.data.polygons) for o in objs)} faces, {out.stat().st_size // 1024} KB')
  return {'file': out.name, 'parts': parts}


def dump_index(index):
  """index.json as process-props.py writes it (its dump_index: the same layout)."""
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
        parts = ',\n'.join(f'        {json.dumps(p)}' for p in v['parts'])
        lines.append(f'    "shards": {{\n      "file": {json.dumps(v["file"])},\n      "parts": [\n{parts}\n      ]\n    }}{comma}')
      else:
        lines.append(f'    {json.dumps(k)}: {json.dumps(v)}{comma}')
    lines.append('  }' + (',' if i < len(index) - 1 else ''))
  lines.append('}')
  return '\n'.join(lines) + '\n'


def main():
  for pid, folder in pack_dirs():
    index_path = folder / 'index.json'
    index = json.loads(index_path.read_text())
    for name, entry in index.items():
      if 'file' not in entry or (pid == 'base' and name in CARS) or (ONLY and name not in ONLY):
        continue
      shards = shatter(name, entry, folder)
      if shards:
        entry['shards'] = shards
    index_path.write_text(dump_index(index))


main()
