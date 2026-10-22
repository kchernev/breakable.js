"""A car modelled in Blender (cars.mjs `blend`) made into the parts it comes apart into: its file
opened, its textures relinked, the modifiers applied (mirrors, subdivision, geometry-node arrays),
any low-detail twin and the scene's lights, camera and ground dropped, the car scaled to its real
size and turned to face +y, standing on z = 0, its middle at x = y = 0. Its objects are its parts:
the scripted cars' (car_model.py) are named for them already; a model of its own says which is which
(`objects`: the Ubix GT15's doors one mirrored object, split down the middle into left and right;
each corner's tyre, rim and lug nuts its wheel; its brake discs the body's). Every face of its glass
material goes into a pane (each piece of it on its own: which part it's on, by where it is).

`load(car)` returns ({part name: object}, [glass panes as process-cars.py has them]).
"""

import math
import os
import re
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
# An object named for a part
PART = re.compile(r'body|hood|trunk|door\.\w+|bumper\.[fr]|wheel\.[fr][lr]|trim\.\w+')


def mesh_objects():
  return [o for o in bpy.data.objects if o.type == 'MESH']


def bbox(objs):
  pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
  return Vector([min(p[k] for p in pts) for k in range(3)]), Vector([max(p[k] for p in pts) for k in range(3)])


def join(objs, name):
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:
    o.select_set(True)
  bpy.context.view_layer.objects.active = objs[0]
  if len(objs) > 1:
    bpy.ops.object.join()
  o = bpy.context.view_layer.objects.active
  o.name = name
  o.data.name = name
  return o


def split_by(obj, keep, name):
  """The faces of `obj` that `keep(face centre)` takes, as an object of their own (taken out of it)."""
  part = obj.copy()
  part.data = obj.data.copy()
  part.name = name
  bpy.context.collection.objects.link(part)
  for o, inside in ((part, True), (obj, False)):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if keep(f.calc_center_median()) != inside], context='FACES')
    bm.to_mesh(o.data)
    bm.free()
  return part


def load(car):
  src = ROOT / car['blend']
  bpy.ops.wm.open_mainfile(filepath=str(src))
  # Its textures beside it
  textures = src.parent / 'Textures'
  for img in bpy.data.images:
    base = os.path.basename(img.filepath)
    if base and (textures / base).exists():
      img.filepath = str(textures / base)
      img.reload()
  # The car alone (its root's family), its modifiers as they render
  root = bpy.data.objects[car.get('root', 'body')]
  keep = {root, *root.children_recursive}
  for o in list(bpy.data.objects):
    if o not in keep:
      bpy.data.objects.remove(o, do_unlink=True)
  for o in bpy.data.objects:
    o.hide_set(False)
    o.hide_viewport = False
    for m in list(o.modifiers):
      if not m.show_render:
        o.modifiers.remove(m)
      else:
        m.show_viewport = True
  dg = bpy.context.evaluated_depsgraph_get()
  evaluated = {o.name: bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg) for o in bpy.data.objects}
  for o in bpy.data.objects:
    o.modifiers.clear()
    o.data = evaluated[o.name]
  for o in bpy.data.objects:
    m = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = m
  for o in bpy.data.objects:
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
  # Real size, facing +y (it faced -y), standing on z = 0, its middle at the origin
  turn = Matrix.Rotation(math.radians(car.get('turn', 180)), 4, 'Z') @ Matrix.Scale(car.get('scale', 1), 4)
  for o in mesh_objects():
    o.data.transform(turn)
  lo, hi = bbox(mesh_objects())
  shift = Matrix.Translation((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
  for o in mesh_objects():
    o.data.transform(shift)
  # Which object is which part
  names = car['objects']
  groups = {}
  for o in mesh_objects():
    mats = {m.name for m in o.data.materials if m}
    c = sum(bbox([o]), Vector()) / 2
    corner = ('f' if c.y > 0 else 'r') + ('l' if c.x < 0 else 'r')
    if PART.fullmatch(o.name):
      # (Modelled by car_model.py: its objects already named for their parts)
      part = o.name
    elif o.name.startswith('Wheel_') or (o.name.startswith('Plane') and not mats & {'13.Disk'}):
      part = f'wheel.{corner}'
    else:
      part = next((p for p, objs in names.items() if any(o.name == n for n in objs)), 'body')
    groups.setdefault(part, []).append(o)
  parts = {p: join(objs, p) for p, objs in groups.items()}
  # The doors: one object, mirrored: split down the middle
  if 'doors' in parts:
    doors = parts.pop('doors')
    parts['door.fl'] = split_by(doors, lambda p: p.x < 0, 'door.fl')
    doors.name = 'door.fr'
    parts['door.fr'] = doors
  # The glass: each piece of its material a pane, on the part it's in
  glass = []
  for n, o in list(parts.items()):
    gi = [i for i, m in enumerate(o.data.materials) if m and m.name == car.get('glass', '5.Glass')]
    if not gi:
      continue
    bm = bmesh.new()
    bm.from_mesh(o.data)
    faces = [f for f in bm.faces if f.material_index in gi]
    seen = set()
    for f in faces:
      if f in seen:
        continue
      island, todo = [], [f]
      seen.add(f)
      while todo:
        g = todo.pop()
        island.append(g)
        for e in g.edges:
          for h in e.link_faces:
            if h not in seen and h.material_index in gi:
              seen.add(h)
              todo.append(h)
      pts = [v.co.copy() for g in island for v in g.verts]
      area = sum(g.calc_area() for g in island)
      if area < car.get('glass_min', 0.02):
        continue
      normal = sum((g.normal * g.calc_area() for g in island), Vector()).normalized()
      centre = sum(pts, Vector()) / len(pts)
      glass.append({'on': n, 'points': pts, 'normal': normal, 'centre': centre})
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    bm.to_mesh(o.data)
    bm.free()
  # Named by where they are
  for g in glass:
    c = g['centre']
    side = 'l' if c.x < 0 else 'r'
    if g['on'].startswith('door.'):
      g['name'] = f"glass.{g['on'][5:]}"
    elif abs(g['normal'].x) > 0.6:
      g['name'] = f'glass.q{side}'
    else:
      g['name'] = 'glass.windscreen' if c.y > 0 else 'glass.rear'
  return parts, glass
