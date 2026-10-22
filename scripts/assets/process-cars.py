#!/usr/bin/env python3
# Makes each car of cars.mjs into the parts it comes apart into, into public/models/cars/<name>.gltf
# (its .bin and textures/ beside it) and public/models/cars/index.json.
#
#   blender -b --factory-startup --python scripts/assets/process-cars.py -- [name ...] [--no-render]
#
# Per car: its Blender file (`blend`: the scripted sedan, taxi and van from car_model.py, the GT15)
# opened by car_blend.py, its objects its parts. Glass isn't kept as faces: each pane's points (the
# faces' and as much again 6 mm in) are its hull, a glass piece of its own in the game. The body
# gets an inside (car_insides.py: the cabin, the engine, the trunk's lining), the doors their cards,
# the hood and the trunk lid their undersides. Each part is a node with its origin at its pivot (a
# door's, the hood's and the trunk's on their hinge; a wheel's at its axle), and index.json lists
# the parts: pivot, hinge axis, convex collider (the body two: under the waist and the cabin),
# mass; the panes; where the fuel tank is. Then previews to assets-src/cars/previews: <name>.png
# (as it stands) and <name>_apart.png (pulled apart, the panes in blue).
#
# (A car with no `blend` takes the older route, which none does now: cut from its prop of the pack
# (public/models/<name>.glb) along its `regions`, with Hunyuan 3D's split of it from split-cars.mjs.)
#
# Frames: Blender is Z-up with the car facing +Y; the exporter maps Blender (x, y, z) to glTF
# (x, z, -y), and so is everything written to index.json.

import json
import math
import subprocess
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import car_blend  # noqa: E402
import car_insides  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'assets-src/cars'
OUT = ROOT / 'public/models/cars'
PREVIEWS = RAW / 'previews'
LIST = ROOT / 'scripts/assets/cars.mjs'

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
NAMES = [a for a in ARGS if not a.startswith('--')]
RENDER = '--no-render' not in ARGS

# A face on one of the split's parts within this (m); the cabin this far under the skin; a pane this thick
ON_PART = 0.04
UNDER_SKIN = 0.03
PANE = 0.006
# The cabin's faces after decimation; a collider's most points
INTERIOR_FACES = 12000
HULL_POINTS = 24
# Dark: the colour map under this (0-1, as stored; a region's `dark` may say its own) and, with a
# paint mask, not paint (its alpha under PAINT)
DARK = 0.24
PAINT = 0.5
# The body's two hulls: under the waist, and the cabin: its glass and its roof (the body over the
# waist is as wide as at it, a mirror's foot and the rear deck wider than the glass: the windows
# would lie inside it); each taken in this far (m), so a round meets a door, a wheel or a pane
# before the body round it
WAIST = 1.0
ROOF = 1.3
INSET = 0.04


def load_list():
  """cars.mjs is the one list of cars; ask node for it."""
  js = 'import(require("url").pathToFileURL(process.argv[1]).href).then((m) => console.log(JSON.stringify({ cars: m.cars, shares: m.shares })))'
  out = subprocess.run(['node', '-e', js, str(LIST)], check=True, capture_output=True, text=True)
  return json.loads(out.stdout)


def gltf(v):
  """A point or direction from Blender's frame to glTF's."""
  return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def reset():
  bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
  """A GLB's meshes as one object, its transforms applied."""
  before = set(bpy.data.objects)
  bpy.ops.import_scene.gltf(filepath=str(path))
  new = [o for o in bpy.data.objects if o not in before]
  meshes = [o for o in new if o.type == 'MESH']
  for o in meshes:
    m = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = m
  for o in new:
    if o.type != 'MESH':
      bpy.data.objects.remove(o)
  bpy.ops.object.select_all(action='DESELECT')
  for o in meshes:
    o.select_set(True)
  bpy.context.view_layer.objects.active = meshes[0]
  if len(meshes) > 1:
    bpy.ops.object.join()
  o = bpy.context.view_layer.objects.active
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  return o


def color_map(obj):
  """The prop's colour map as an array (rows from the bottom, RGBA as stored)."""
  mat = obj.material_slots[0].material
  for n in mat.node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image and any(l.to_socket.name == 'Base Color' for l in mat.node_tree.links if l.from_node == n):
      img = n.image
      w, h = img.size
      return np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
  raise RuntimeError(f'{obj.name}: no colour map')


def mirrored(region):
  """The region's box on the other side, for the part named with r for its l."""
  (x0, y0, z0), (x1, y1, z1) = region['box']
  name = region['name']
  return {**region, 'name': name[:-1] + 'r' if name.endswith('l') else name, 'box': [[-x1, y0, z0], [-x0, y1, z1]], 'mirror': False}


def regions_of(car):
  out = []
  for r in car['regions']:
    out.append(r)
    if r.get('mirror'):
      out.append(mirrored(r))
  return out


def inside(p, box, pad=0.0):
  (x0, y0, z0), (x1, y1, z1) = box
  return x0 - pad <= p.x <= x1 + pad and y0 - pad <= p.y <= y1 + pad and z0 - pad <= p.z <= z1 + pad


def faces_like(n, facing):
  if not facing:
    return True
  a = Vector(facing['axis'])
  d = n.dot(a)
  if facing.get('abs'):
    d = abs(n.x * a.x) + n.y * a.y + n.z * a.z
  return d >= facing['min']


def cut_seams(obj, regions):
  """Cut the mesh along each part region's sides (near it), so its seams run straight."""
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  for r in regions:
    if r['name'].startswith('glass.'):
      continue
    lo, hi = Vector(r['box'][0]), Vector(r['box'][1])
    for axis in range(3):
      for value in (lo[axis], hi[axis]):
        near = [f for f in bm.faces if inside(f.calc_center_median(), r['box'], 0.12)]
        if not near:
          continue
        geom = list({e for f in near for e in f.edges}) + near + list({v for f in near for v in f.verts})
        no = Vector((0, 0, 0))
        no[axis] = 1
        co = Vector((0, 0, 0))
        co[axis] = value
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
  bm.to_mesh(obj.data)
  bm.free()
  obj.data.update()


def label_faces(obj, car, split_dir, masked):
  """Each face's part: one of the split's it lies on (a wheel), the first region it's in, else the body."""
  wheels = {}
  for name, i in car['split']['parts'].items():
    w = import_glb(split_dir / f'part_{i}.glb')
    lo = Vector([min(v.co[k] for v in w.data.vertices) for k in range(3)])
    hi = Vector([max(v.co[k] for v in w.data.vertices) for k in range(3)])
    wheels[name] = (BVHTree.FromObject(w, bpy.context.evaluated_depsgraph_get()), [list(lo), list(hi)])
    bpy.data.objects.remove(w)
  pixels = color_map(obj)
  h, w, _ = pixels.shape
  uv = obj.data.uv_layers.active.data
  regions = regions_of(car)
  labels = []
  for p in obj.data.polygons:
    c = p.center
    label = None
    for name, (tree, box) in wheels.items():
      if inside(c, box, ON_PART):
        hit = tree.find_nearest(c)
        if hit[0] is not None and hit[3] < ON_PART:
          label = name
          break
    if label is None:
      u = sum((uv[i].uv for i in p.loop_indices), Vector((0, 0))) / p.loop_total
      px = pixels[min(h - 1, max(0, int((u.y % 1) * h))), min(w - 1, max(0, int((u.x % 1) * w)))]
      lit = max(px[0], px[1], px[2])
      paint = masked and px[3] >= PAINT
      for r in regions:
        dark = r.get('dark')
        if dark and (paint or lit >= (DARK if dark is True else dark)):
          continue
        if inside(c, r['box']) and faces_like(p.normal, r.get('facing')):
          label = r['name']
          break
    labels.append(label or 'body')
  return labels


def part_of(obj, labels, name):
  """A copy of `obj` with only the faces labelled `name`."""
  o = obj.copy()
  o.data = obj.data.copy()
  o.name = name
  bpy.context.collection.objects.link(o)
  bm = bmesh.new()
  bm.from_mesh(o.data)
  bm.faces.ensure_lookup_table()
  bmesh.ops.delete(bm, geom=[f for f in bm.faces if labels[f.index] != name], context='FACES')
  bm.to_mesh(o.data)
  bm.free()
  return o


def points(obj):
  return [obj.matrix_world @ v.co for v in obj.data.vertices]


def bounds(pts):
  return Vector([min(p[k] for p in pts) for k in range(3)]), Vector([max(p[k] for p in pts) for k in range(3)])


def hull(pts, most=HULL_POINTS):
  """The corners of the points' convex hull, at most `most` of them (spread out, farthest first)."""
  bm = bmesh.new()
  for p in pts:
    bm.verts.new(p)
  out = bmesh.ops.convex_hull(bm, input=bm.verts)
  corners = [v.co.copy() for v in out['geom'] if isinstance(v, bmesh.types.BMVert)]
  bm.free()
  if len(corners) <= most:
    return corners
  centre = sum(corners, Vector()) / len(corners)
  chosen = [max(corners, key=lambda p: (p - centre).length)]
  gap = [(p - chosen[0]).length for p in corners]
  while len(chosen) < most:
    i = max(range(len(corners)), key=lambda k: gap[k])
    chosen.append(corners[i])
    gap = [min(g, (p - corners[i]).length) for g, p in zip(gap, corners)]
  return chosen


def inset(corners, by=INSET):
  """A hull taken in about `by` all round: shrunk along each axis about its box's middle by that much each side."""
  lo, hi = bounds(corners)
  c = (lo + hi) / 2
  k = [max(0.0, 1 - by / max((hi[i] - lo[i]) / 2, 1e-6)) for i in range(3)]
  return [Vector([c[i] + (p[i] - c[i]) * k[i] for i in range(3)]) for p in corners]


def pane(obj):
  """A glass pane: its faces' points and as many again PANE in (toward the car's middle)."""
  pts = points(obj)
  n = Vector((0, 0, 0))
  for p in obj.data.polygons:
    n += p.normal * p.area
  n.normalize()
  centre = sum(pts, Vector()) / len(pts)
  if n.dot(Vector((centre.x, centre.y, centre.z - 0.7))) < 0:
    n = -n
  return hull(pts + [p - n * PANE for p in pts], 20), n


def mirror_wheel(obj):
  """A wheel with its far side: the near side mirrored across the tyre's middle."""
  lo, hi = bounds(points(obj))
  mid = (lo.x + hi.x) / 2 + (0.02 if lo.x + hi.x < 0 else -0.02)
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  copy = bmesh.ops.duplicate(bm, geom=bm.faces[:] + bm.edges[:] + bm.verts[:])
  verts = [g for g in copy['geom'] if isinstance(g, bmesh.types.BMVert)]
  for v in verts:
    v.co.x = 2 * mid - v.co.x
  bmesh.ops.reverse_faces(bm, faces=[g for g in copy['geom'] if isinstance(g, bmesh.types.BMFace)])
  bm.to_mesh(obj.data)
  bm.free()


def material(name, color, rough=0.85, metal=0.0):
  m = bpy.data.materials.new(name)
  m.use_nodes = True
  b = m.node_tree.nodes['Principled BSDF']
  c = [((color >> s) & 255) / 255 for s in (16, 8, 0)]
  b.inputs['Base Color'].default_value = (*[x ** 2.2 for x in c], 1)
  b.inputs['Roughness'].default_value = rough
  b.inputs['Metallic'].default_value = metal
  return m


def interior(car, skin, split_dir):
  """The split's cabin where it lies under the prop's skin: seats, dash, floor, door cards."""
  inner = car['split']['interior']
  o = join([import_glb(split_dir / f'part_{i}.glb') for i in (inner if isinstance(inner, list) else [inner])], 'interior')
  for a in list(o.data.color_attributes):
    o.data.color_attributes.remove(a)
  dec = o.modifiers.new('d', 'DECIMATE')
  dec.ratio = min(1, 200000 / max(1, len(o.data.polygons)))
  bpy.context.view_layer.objects.active = o
  bpy.ops.object.modifier_apply(modifier='d')
  tree = BVHTree.FromObject(skin, bpy.context.evaluated_depsgraph_get())
  bm = bmesh.new()
  bm.from_mesh(o.data)
  near = [f for f in bm.faces if (lambda h: h[3] is not None and h[3] < UNDER_SKIN)(tree.find_nearest(f.calc_center_median()))]
  bmesh.ops.delete(bm, geom=near, context='FACES')
  bm.to_mesh(o.data)
  bm.free()
  dec = o.modifiers.new('d', 'DECIMATE')
  dec.ratio = min(1, INTERIOR_FACES / max(1, len(o.data.polygons)))
  bpy.ops.object.modifier_apply(modifier='d')
  o.data.materials.clear()
  o.data.materials.append(material('interior', 0x1d1e20, 0.9))
  return o


def hollow(body, skin, c):
  """The prop's own insides out of its body, where a cabin is made for it (the seats and dash an
  image-to-3D model shaped under its glass): each face in the cabin's width and over its floor from
  which no way out of the prop's skin (its glass in it) is clear."""
  tree = BVHTree.FromObject(skin, bpy.context.evaluated_depsgraph_get())
  # Ways out, evenly round
  n = 48
  ways = []
  for i in range(n):
    z = 1 - 2 * (i + 0.5) / n
    a = math.pi * (1 + 5 ** 0.5) * i
    r = math.sqrt(1 - z * z)
    ways.append(Vector((r * math.cos(a), r * math.sin(a), z)))
  bm = bmesh.new()
  bm.from_mesh(body.data)
  shut = []
  for f in bm.faces:
    m = body.matrix_world @ f.calc_center_median()
    if abs(m.x) > c['width'] / 2 or m.z < c['floor']:
      continue
    if all(tree.ray_cast(m + w * 0.01, w)[0] is not None for w in ways):
      shut.append(f)
  bmesh.ops.delete(bm, geom=shut, context='FACES')
  bm.to_mesh(body.data)
  bm.free()
  print(f'    hollowed: {len(shut)} faces')


def block(name, box, color, metal):
  lo, hi = Vector(box[0]), Vector(box[1])
  bpy.ops.mesh.primitive_cube_add(size=1, location=(lo + hi) / 2)
  o = bpy.context.active_object
  o.name = name
  o.scale = hi - lo
  bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
  o.data.materials.append(material(name, color, 0.6 if metal else 0.9, metal))
  return o


def join(objs, name):
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:
    o.select_set(True)
  bpy.context.view_layer.objects.active = objs[0]
  if len(objs) > 1:
    bpy.ops.object.join()
  o = bpy.context.view_layer.objects.active
  o.name = name
  return o


def set_pivot(obj, pivot):
  obj.data.transform(Matrix.Translation(-pivot))
  obj.location = pivot


def role(name):
  return name.split('.')[0]


def from_prop(car):
  """A prop of the pack and its split, cut into parts: ({name: object}, [panes], its skin)."""
  name = car['name']
  split_dir = RAW / name / 'split'
  reset()
  prop = import_glb(ROOT / f'public/models/{name}.glb')
  prop.name = 'prop'
  # Seen from inside too (a door's inside, the hood's underside)
  for s in prop.material_slots:
    s.material.use_backface_culling = False
  skin = prop.copy()
  skin.data = prop.data.copy()
  bpy.context.collection.objects.link(skin)
  cut_seams(prop, regions_of(car))
  props = json.loads((ROOT / 'public/models/index.json').read_text())
  labels = label_faces(prop, car, split_dir, props.get(name, {}).get('tintMask') == 'alpha')
  names = sorted(set(labels))
  print(f'{name}: ' + ', '.join(f'{n} {labels.count(n)}' for n in names))
  parts = {n: part_of(prop, labels, n) for n in names}
  bpy.data.objects.remove(prop)
  # The panes, out of the drawn parts
  glass = []
  for n in [n for n in names if n.startswith('glass.')]:
    o = parts.pop(n)
    corners, normal = pane(o)
    side = n.split('.')[1]
    on = f'door.{side}' if f'door.{side}' in parts else 'body'
    glass.append({'name': n, 'on': on, 'points': corners, 'normal': normal})
    bpy.data.objects.remove(o)
  for n in parts:
    if role(n) == 'wheel':
      mirror_wheel(parts[n])
  return parts, glass, skin


def from_blend(car):
  """A car modelled in Blender (car_blend.py), its own materials set to export as they look, the
  `regions` cut out of its body: ({name: object}, [panes], None)."""
  parts, found = car_blend.load(car)
  looks(car)
  # Lighter: each part's faces cut down by its role's share (`decimate`), its shape kept
  for n, o in parts.items():
    ratio = car.get('decimate', {}).get(role(n))
    if ratio:
      before = len(o.data.polygons)
      d = o.modifiers.new('d', 'DECIMATE')
      d.ratio = ratio
      bpy.context.view_layer.objects.active = o
      bpy.ops.object.modifier_apply(modifier='d')
      print(f'    {n}: {before} faces -> {len(o.data.polygons)}')
  if car.get('regions'):
    body = parts['body']
    regions = regions_of(car)
    cut_seams(body, regions)
    labels = []
    for f in body.data.polygons:
      c = f.center
      labels.append(next((r['name'] for r in regions if inside(c, r['box']) and faces_like(f.normal, r.get('facing'))), 'body'))
    for n in sorted(set(labels)):
      parts[n] = part_of(body, labels, n)
    bpy.data.objects.remove(body)
  glass = []
  for g in found:
    pts = g['points']
    n = g['normal']
    centre = sum(pts, Vector()) / len(pts)
    if n.dot(Vector((centre.x, centre.y, centre.z - 0.7))) < 0:
      n = -n
    glass.append({'name': g['name'], 'on': g['on'], 'points': hull(pts + [p - n * PANE for p in pts], 20), 'normal': n})
  print(f"{car['name']}: " + ', '.join(f'{n} {len(o.data.polygons)}' for n, o in sorted(parts.items())) + ', panes ' + ', '.join(g['name'] for g in glass))
  return parts, glass, None


def looks(car):
  """A modelled car's materials as they export: each to its `looks` (colour, roughness,
  metalness, coat, glow); its paint white under the copy's tint (`paint`), a clear coat over it; its
  tyres' colour ramp baked into their texture (glTF has no ramps)."""
  for name, l in car.get('looks', {}).items():
    m = bpy.data.materials.get(name)
    if not m:
      continue
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    if 'color' in l:
      for link in list(b.inputs['Base Color'].links):
        m.node_tree.links.remove(link)
      b.inputs['Base Color'].default_value = (*[x ** 2.2 for x in [((l['color'] >> s) & 255) / 255 for s in (16, 8, 0)]], 1)
    for key, socket in (('rough', 'Roughness'), ('metal', 'Metallic'), ('coat', 'Coat Weight'), ('coat_rough', 'Coat Roughness')):
      if key in l:
        b.inputs[socket].default_value = l[key]
    b.inputs['Emission Strength'].default_value = l.get('glow', 0.0)
    if l.get('paint'):
      m.name = 'paint'
    m.use_backface_culling = False
  tyre = bpy.data.materials.get(car.get('tyre', ''))
  if tyre:
    nt = tyre.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    ramp = next((n for n in nt.nodes if n.type == 'VALTORGB'), None)
    src = next((n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    if ramp and src:
      w, h = src.size
      px = np.array(src.pixels[:], dtype=np.float32).reshape(-1, 4)
      lin = np.where(px[:, :3] <= 0.04045, px[:, :3] / 12.92, ((px[:, :3] + 0.055) / 1.055) ** 2.4)
      fac = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
      out = np.array([ramp.color_ramp.evaluate(float(f))[:3] for f in np.linspace(0, 1, 256)], np.float32)
      col = out[np.clip((fac * 255).astype(int), 0, 255)]
      srgb = np.where(col <= 0.0031308, col * 12.92, 1.055 * col ** (1 / 2.4) - 0.055)
      img = bpy.data.images.new(f"{car['name']}_tyre", w, h, alpha=False)
      img.pixels[:] = np.concatenate([srgb, np.ones((len(srgb), 1), np.float32)], 1).ravel()
      for n in [n for n in nt.nodes if n.type in {'VALTORGB', 'TEX_IMAGE'}]:
        nt.nodes.remove(n)
      t = nt.nodes.new('ShaderNodeTexImage')
      t.image = img
      nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
      b.inputs['Metallic'].default_value = 0.0
      b.inputs['Roughness'].default_value = 0.85


def process(car, shares):
  name = car['name']
  parts, glass, skin = from_blend(car) if 'blend' in car else from_prop(car)
  # The body's inside
  waist_pts = points(parts['body'])
  if 'cabin' in car:
    # Its insides made to fit it: the cabin, the engine, the trunk, the brakes (the body's), each
    # door's card, the lids' undersides
    if skin:
      hollow(parts['body'], skin, car['cabin'])
    for n, objs in car_insides.build(car, parts).items():
      parts[n] = join([parts[n], *objs], n)
  else:
    inner = interior(car, skin, RAW / name / 'split')
    blocks = [block(f'block{i}', b['box'], b['color'], b.get('metal', 0)) for i, b in enumerate(car.get('boxes', []))]
    parts['body'] = join([parts['body'], inner, *blocks], 'body')
  if skin:
    bpy.data.objects.remove(skin)
  # Pivots, colliders, masses
  hinges = {}
  for n, h in car.get('hinges', {}).items():
    hinges[n] = h
    if n.endswith('l'):
      hinges[n[:-1] + 'r'] = {'at': [-h['at'][0], *h['at'][1:]], 'axis': h['axis']}
  entries = []
  rest = car['mass']
  for n, o in parts.items():
    pts = points(o)
    lo, hi = bounds(pts)
    e = {'name': n, 'role': role(n)}
    if n == 'body':
      pivot = Vector((0, 0, 0))
      waist, roof = car.get('waist', WAIST), car.get('roof', ROOF)
      lower = [p for p in waist_pts if p.z < waist]
      # (The roof between the screens: not an aerial sticking up behind it)
      screens = {g['name']: g['points'] for g in glass}
      back = max((p.y for p in screens.get('glass.rear', [])), default=-99)
      front = min((p.y for p in screens.get('glass.windscreen', [])), default=99)
      upper = [p for g in glass for p in g['points']] + [p for p in waist_pts if p.z >= roof and back - 0.05 <= p.y <= front + 0.05]
      e['colliders'] = [[gltf(p) for p in inset(hull(lower))], [gltf(p) for p in inset(hull(upper))]]
    else:
      if n in hinges:
        pivot = Vector(hinges[n]['at'])
        e['axis'] = gltf(Vector(hinges[n]['axis']))
      elif role(n) == 'wheel':
        pivot = (lo + hi) / 2
        e['axis'] = [1, 0, 0]
        e['radius'] = round((hi.z - lo.z) / 2, 4)
      else:
        pivot = sum(pts, Vector()) / len(pts)
      e['collider'] = [gltf(p - pivot) for p in hull(pts)]
      e['mass'] = round(car['mass'] * shares.get(role(n), 0.01), 4)
      rest -= e['mass']
    e['pivot'] = gltf(pivot)
    e['triangles'] = sum(len(p.vertices) - 2 for p in o.data.polygons)
    set_pivot(o, pivot)
    entries.append(e)
  entries[[e['name'] for e in entries].index('body')]['mass'] = round(rest, 4)
  entries.sort(key=lambda e: (e['role'] != 'body', e['name']))
  # Export
  OUT.mkdir(parents=True, exist_ok=True)
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts.values():
    o.select_set(True)
  # glTF with its textures beside it, in one folder for every car (the insides' are the same files)
  bpy.ops.export_scene.gltf(filepath=str(OUT / f'{name}.gltf'), export_format='GLTF_SEPARATE', export_texture_dir='textures', use_selection=True, export_apply=True, export_image_format='WEBP', export_yup=True)
  entry = {
    'file': f'{name}.gltf',
    'mass': car['mass'],
    'parts': entries,
    'glass': [{'name': g['name'], 'on': g['on'], 'points': [gltf(p) for p in g['points']], 'normal': gltf(g['normal'])} for g in glass],
    'fuel': gltf(Vector(car['fuel'])),
    'triangles': sum(e['triangles'] for e in entries),
  }
  # Its paint: the prop's, or its own (a modelled car's paint material takes the tint)
  props = json.loads((ROOT / 'public/models/index.json').read_text())
  for key in ('tint', 'tintMask'):
    if key in car:
      entry[key] = car[key]
    elif key in props.get(name, {}):
      entry[key] = props[name][key]
  print(f"{name}: {len(entries)} parts, {len(glass)} panes, {entry['triangles']} triangles")
  if RENDER:
    preview(name, parts, glass, car)
  return entry


def preview(name, parts, glass, car):
  """As it stands, inside (from the driver's seat, and through its open doors), its engine bay
  open, and pulled apart with its panes in blue (EEVEE, under a soft sky and a sun)."""
  PREVIEWS.mkdir(parents=True, exist_ok=True)
  scene = bpy.context.scene
  scene.render.engine = 'BLENDER_EEVEE_NEXT'
  scene.view_settings.view_transform = 'AgX'
  scene.render.resolution_x, scene.render.resolution_y = 1400, 900
  # (A car's own .blend may render its film transparent)
  scene.render.film_transparent = False
  world = bpy.data.worlds.new('sky')
  world.use_nodes = True
  world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.62, 0.72, 1)
  world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.2
  scene.world = world
  sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
  sun.data.energy = 3.5
  sun.rotation_euler = (0.75, 0.15, 0.9)
  scene.collection.objects.link(sun)
  glass_look = bpy.data.materials.new('preview_glass')
  glass_look.use_nodes = True
  b = glass_look.node_tree.nodes['Principled BSDF']
  b.inputs['Base Color'].default_value = (0.2, 0.28, 0.32, 1)
  b.inputs['Roughness'].default_value = 0.05
  b.inputs['Alpha'].default_value = 0.4
  glass_look.surface_render_method = 'BLENDED'
  panes = []
  for g in glass:
    bm = bmesh.new()
    for p in g['points']:
      bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    me = bpy.data.meshes.new(g['name'])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(g['name'], me)
    me.materials.append(glass_look)
    bpy.context.collection.objects.link(o)
    panes.append((o, g['on']))
  cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
  scene.collection.objects.link(cam)
  scene.camera = cam
  centre = Vector((0, 0, 0.7))

  def shoot(path, at):
    cam.location = centre + Vector(at)
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)

  shoot(PREVIEWS / f'{name}.png', (5.2, 6.0, 2.6))
  for o, _ in panes:
    o.hide_render = True
  c = car.get('cabin')
  if c:
    # From the driver's seat
    eye = Vector((c['front'][0], c['seat_y'] + 0.12, c['seat_z'] + 0.72))
    cam.location = eye
    cam.rotation_euler = (Vector((c['front'][0] * 0.3, c['dash']['y'] + 1, c['dash']['top'] - 0.15)) - eye).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 18
    scene.render.filepath = str(PREVIEWS / f'{name}_driver.png')
    bpy.ops.render.render(write_still=True)
    cam.data.lens = 35
    # Through its open doors (the right side's off)
    hidden = [o for n, o in parts.items() if n.startswith('door.') and (n.endswith('r') or n == 'door.side')]
    for o in hidden:
      o.hide_render = True
    centre = Vector((0, c['seat_y'] - 0.2, c['seat_z'] + 0.2))
    shoot(PREVIEWS / f'{name}_inside.png', (3.2, 0.6, 0.9))
    for o in hidden:
      o.hide_render = False
    # The engine bay, the hood off
    if 'hood' in parts and 'engine' in car:
      parts['hood'].hide_render = True
      (x0, y0, z0), (x1, y1, z1) = car['engine']['box']
      centre = Vector(((x0 + x1) / 2, (y0 + y1) / 2, z0))
      # (Mid-engined: from behind, its rear glass off)
      mid = car['engine'].get('mid')
      for o, on in panes:
        o.hide_render = True
      shoot(PREVIEWS / f'{name}_engine.png', (1.3, -1.8 if mid else 1.6, 1.6))
      parts['hood'].hide_render = False
    centre = Vector((0, 0, 0.7))
  for o, _ in panes:
    o.hide_render = False
  offsets = {}
  for n, o in parts.items():
    if n == 'body':
      continue
    lo, hi = bounds(points(o))
    c = (lo + hi) / 2
    d = Vector((c.x * 1.4, c.y * 0.5, max(0.0, c.z - 0.6) * 1.2))
    o.location += d
    offsets[n] = d
  for o, on in panes:
    o.location += offsets.get(on, Vector()) + (Vector((0, 0, 0.6)) if on == 'body' else Vector((0.3 * (1 if o.location.x >= 0 else -1), 0, 0)))
  shoot(PREVIEWS / f'{name}_apart.png', (6.5, 7.5, 4.0))


def main():
  data = load_list()
  index_path = OUT / 'index.json'
  index = json.loads(index_path.read_text()) if index_path.exists() else {}
  for car in data['cars']:
    if NAMES and car['name'] not in NAMES:
      continue
    index[car['name']] = process(car, data['shares'])
  OUT.mkdir(parents=True, exist_ok=True)
  index_path.write_text(json.dumps(index, indent=1) + '\n')


main()
