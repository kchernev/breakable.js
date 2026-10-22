"""What's inside a car, made to fit it (scripts/assets/process-cars.py builds each car's from its
`cabin` in cars.mjs): its cabin (seats shaped from padded cushions with bolsters and quilted
inserts, a sculpted dashboard with lit gauges under a hood, a screen, air vents and knobs, a
steering wheel, a centre console with its gear lever and armrest, pedals, a carpeted floor over the
tunnel, a headliner following the roof, sun visors, a mirror, seatbelts; a taxi's partition and
meter; a van's bulkhead and its cargo), each door's card, an engine under the hood (block, cam
covers, intake, air box, radiator, battery, reservoirs, strut towers, hoses), a carpeted trunk with
its spare wheel, the hood's and the trunk lid's undersides, and a brake disc and caliper at each
hub (unless the car has its own: cars.mjs `brakes: false`, as every car now does). All in Blender's frame (x to the car's right, y forward, z up, metres), lined with the cars
pack's textures (public/packs/cars/textures) projected box-wise at each material's own scale.

`build(car, parts)` returns {part name: [objects]} to join into each part (the body takes the
cabin, the engine, the trunk's lining and the brakes; a door its card; the hood and the trunk lid
their undersides).
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
TEXTURES = ROOT / 'public/packs/cars/textures'
RAW = ROOT / 'assets-src/packs/cars/textures/raw'

# --- Materials ----------------------------------------------------------------------------------

# name: (texture set or None, colour multiplied in (hex), roughness, metalness, tile size (m))
LOOKS = {
  'leather_black': ('car_leather_black', 0xffffff, 0.5, 0, 0.3),
  'leather_tan': ('car_leather_tan', 0xffffff, 0.52, 0, 0.3),
  'leather_red': ('car_leather_tan', 0xd23a2a, 0.5, 0, 0.3),
  'quilted': ('car_leather_quilted', 0xffffff, 0.47, 0, 0.3),
  'quilted_tan': ('car_leather_quilted', 0xc88a5a, 0.47, 0, 0.3),
  'fabric': ('car_fabric', 0xffffff, 0.95, 0, 0.2),
  'fabric_belt': ('car_fabric', 0x777777, 0.85, 0, 0.1),
  'carpet': ('car_carpet', 0xffffff, 1.0, 0, 0.3),
  'plastic': ('car_plastic', 0xffffff, 0.72, 0, 0.2),
  'plastic_dark': ('car_plastic', 0x606060, 0.6, 0, 0.2),
  'headliner': ('car_headliner', 0xffffff, 0.98, 0, 0.3),
  'plywood': ('car_plywood', 0xffffff, 0.82, 0, 1.0),
  'carbon': ('car_carbon', 0xffffff, 0.28, 0, 0.12),
  'gloss_black': (None, 0x0b0b0c, 0.12, 0, 1),
  'satin_black': (None, 0x161618, 0.45, 0, 1),
  'rubber': (None, 0x101010, 0.9, 0, 1),
  'chrome': (None, 0xe8e8e8, 0.06, 1, 1),
  'aluminium': (None, 0xb8bcc0, 0.32, 1, 1),
  'cast_iron': (None, 0x5a5856, 0.42, 0.9, 1),
  'engine_grey': (None, 0x3a3b3d, 0.55, 0.6, 1),
  'primer': (None, 0x2b2c2e, 0.65, 0.2, 1),
  'red_paint': (None, 0xb4161b, 0.25, 0.1, 1),
  'yellow': (None, 0xe8b41c, 0.5, 0, 1),
  'blue_cap': (None, 0x2a5fb8, 0.45, 0, 1),
  'reservoir': (None, 0xd8d4c8, 0.35, 0, 1),
  'cardboard': (None, 0xa47c4e, 0.9, 0, 1),
  'tape': (None, 0xc9a86a, 0.5, 0, 1),
  'perspex': (None, 0xdfe8ea, 0.05, 0, 1),
}
# Displays: their picture, as light
DISPLAYS = {'gauges': 'car_gauges', 'screen': 'car_screen', 'meter': None}
_materials = {}


def srgb(hexcolor):
  return [((hexcolor >> s) & 255) / 255 for s in (16, 8, 0)]


def linear(c):
  return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def image(path, colour, size=512):
  """An image (at most `size` across: seen through a window, half the 1k sets is plenty)."""
  img = bpy.data.images.load(str(path), check_existing=True)
  if not colour:
    img.colorspace_settings.name = 'Non-Color'
  if max(img.size) > size and not img.get('scaled'):
    w, h = img.size
    img.scale(size, max(1, round(size * h / w)))
    img['scaled'] = True
  return img


def material(name):
  """One of LOOKS or DISPLAYS as a Blender material (made once)."""
  if name in _materials:
    return _materials[name]
  m = bpy.data.materials.new(f'inside.{name}')
  m.use_nodes = True
  m.use_backface_culling = False
  nt = m.node_tree
  bsdf = nt.nodes['Principled BSDF']
  if name in DISPLAYS:
    bsdf.inputs['Base Color'].default_value = (0.01, 0.01, 0.01, 1)
    bsdf.inputs['Roughness'].default_value = 0.2
    src = DISPLAYS[name]
    if src:
      tex = nt.nodes.new('ShaderNodeTexImage')
      tex.image = image(RAW / src / '0.png', True, 768)
      tex.image.name = src
      nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    else:
      bsdf.inputs['Emission Color'].default_value = (1, 0.12, 0.05, 1)
    bsdf.inputs['Emission Strength'].default_value = 2.5
  else:
    tset, tint, rough, metal, _ = LOOKS[name]
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    c = linear(srgb(tint))
    if tset:
      tex = nt.nodes.new('ShaderNodeTexImage')
      tex.image = image(TEXTURES / f'{tset}_diff_1k.webp', True)
      if tint != 0xffffff:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1
        nt.links.new(tex.outputs['Color'], mix.inputs['A'])
        mix.inputs['B'].default_value = (*c, 1)
        nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
      else:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
      nor = nt.nodes.new('ShaderNodeTexImage')
      nor.image = image(TEXTURES / f'{tset}_nor_gl_1k.webp', False)
      nmap = nt.nodes.new('ShaderNodeNormalMap')
      nt.links.new(nor.outputs['Color'], nmap.inputs['Color'])
      nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    else:
      bsdf.inputs['Base Color'].default_value = (*c, 1)
    if name == 'perspex':
      bsdf.inputs['Alpha'].default_value = 0.25
      if hasattr(m, 'surface_render_method'):
        m.surface_render_method = 'BLENDED'
  _materials[name] = m
  return m


def tile_of(name):
  return LOOKS[name][4] if name in LOOKS else 1.0


# --- Meshes ---------------------------------------------------------------------------------------

class Part:
  """A mesh being built: faces with a material each, made into an object at the end (UVs box
  projected by each face's material scale)."""

  def __init__(self, name):
    self.name = name
    self.bm = bmesh.new()
    self.mats = []

  def mat(self, name):
    if name not in self.mats:
      self.mats.append(name)
    return self.mats.index(name)

  def add(self, other, matrix=Matrix.Identity(4), material=None):
    """Another bmesh's faces, moved by `matrix`; all in `material`, or by the face's own index
    into `other`'s names (a (bmesh, [names]) pair)."""
    bm, names = other if isinstance(other, tuple) else (other, None)
    vmap = {}
    for v in bm.verts:
      vmap[v] = self.bm.verts.new(matrix @ v.co)
    for f in bm.faces:
      try:
        nf = self.bm.faces.new([vmap[v] for v in f.verts])
      except ValueError:
        continue
      nf.smooth = f.smooth
      nf.material_index = self.mat(material if material else names[f.material_index])
    return self

  def object(self):
    me = bpy.data.meshes.new(self.name)
    bm = self.bm
    print(f'    {self.name}: {sum(len(f.verts) - 2 for f in bm.faces)} triangles')
    bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
      s = 1 / tile_of(self.mats[f.material_index])
      n = f.normal
      ax = max(range(3), key=lambda k: abs(n[k]))
      for loop in f.loops:
        p = loop.vert.co
        u, v = [(p.y, p.z), (p.x, p.z), (p.x, p.y)][ax]
        loop[uv].uv = (u * s, v * s)
    bm.to_mesh(me)
    for name in self.mats:
      me.materials.append(material(name))
    o = bpy.data.objects.new(self.name, me)
    bpy.context.collection.objects.link(o)
    return o


def smooth(bm, levels=2):
  """Catmull-Clark subdivision of a bmesh (its cage made round), smooth-shaded."""
  me = bpy.data.meshes.new('tmp')
  bm.to_mesh(me)
  o = bpy.data.objects.new('tmp', me)
  bpy.context.collection.objects.link(o)
  mod = o.modifiers.new('s', 'SUBSURF')
  mod.levels = mod.render_levels = levels
  dg = bpy.context.evaluated_depsgraph_get()
  out = bmesh.new()
  out.from_object(o, dg)
  for f in out.faces:
    f.smooth = True
  bpy.data.objects.remove(o)
  bpy.data.meshes.remove(me)
  return out


def pillow(w, d, t, shape=None, nx=8, ny=8, levels=2, faces=None):
  """A padded block w (x) by d (y), t thick (z, up from 0), its top raised by shape(u, v) (u -1..1
  across, v 0..1 along), rounded by subdivision. Returns (bmesh, material names): each top face
  named by faces(u, v) (default 'a'), the rest 'b'."""
  bm = bmesh.new()
  top, bot = {}, {}
  for i in range(nx + 1):
    for j in range(ny + 1):
      u, v = -1 + 2 * i / nx, j / ny
      x, y = u * w / 2, v * d
      top[i, j] = bm.verts.new((x, y, t + (shape(u, v) if shape else 0)))
      bot[i, j] = bm.verts.new((x, y, 0))
  names = ['b', 'a']
  for i in range(nx):
    for j in range(ny):
      f = bm.faces.new([top[i, j], top[i + 1, j], top[i + 1, j + 1], top[i, j + 1]])
      u, v = -1 + 2 * (i + 0.5) / nx, (j + 0.5) / ny
      name = faces(u, v) if faces else 'a'
      if name not in names:
        names.append(name)
      f.material_index = names.index(name)
      bm.faces.new([bot[i, j], bot[i, j + 1], bot[i + 1, j + 1], bot[i + 1, j]]).material_index = 0
  ring = [(i, 0) for i in range(nx)] + [(nx, j) for j in range(ny)] + [(i, ny) for i in range(nx, 0, -1)] + [(0, j) for j in range(ny, 0, -1)]
  for k in range(len(ring)):
    a, b = ring[k], ring[(k + 1) % len(ring)]
    bm.faces.new([bot[a], bot[b], top[b], top[a]]).material_index = 0
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  return smooth(bm, levels), names


def box(size, at=(0, 0, 0), bevel=0.0):
  """A box of `size` centred on `at` (bevelled edges, if asked)."""
  bm = bmesh.new()
  bmesh.ops.create_cube(bm, size=1)
  bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
  bmesh.ops.translate(bm, vec=Vector(at), verts=bm.verts)
  if bevel:
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
  return bm


def cylinder(r, h, segments=24, at=(0, 0, 0), axis='z', r2=None):
  """A cylinder (a cone with r2) along `axis`, centred on `at`."""
  bm = bmesh.new()
  bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r if r2 is None else r2, depth=h)
  if axis == 'x':
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.pi / 2, 4, 'Y'))
  elif axis == 'y':
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.pi / 2, 4, 'X'))
  bmesh.ops.translate(bm, vec=Vector(at), verts=bm.verts)
  for f in bm.faces:
    f.smooth = len(f.verts) == 4
  return bm


def torus(R, r, segments=40, ring=10):
  """A ring about z of radius R, its tube r thick."""
  bm = bmesh.new()
  verts = []
  for i in range(segments):
    a = 2 * math.pi * i / segments
    c = Vector((math.cos(a), math.sin(a), 0))
    row = []
    for j in range(ring):
      b = 2 * math.pi * j / ring
      row.append(bm.verts.new(c * (R + r * math.cos(b)) + Vector((0, 0, r * math.sin(b)))))
    verts.append(row)
  for i in range(segments):
    for j in range(ring):
      f = bm.faces.new([verts[i][j], verts[(i + 1) % segments][j], verts[(i + 1) % segments][(j + 1) % ring], verts[i][(j + 1) % ring]])
      f.smooth = True
  return bm


def tube(points, r, segments=10):
  """A tube r thick along a polyline (a hose)."""
  bm = bmesh.new()
  rings = []
  pts = [Vector(p) for p in points]
  for k, p in enumerate(pts):
    t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
    a = t.orthogonal().normalized()
    b = t.cross(a)
    rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * i / segments) + b * math.sin(2 * math.pi * i / segments)) * r) for i in range(segments)])
  for k in range(len(rings) - 1):
    for i in range(segments):
      f = bm.faces.new([rings[k][i], rings[k][(i + 1) % segments], rings[k + 1][(i + 1) % segments], rings[k + 1][i]])
      f.smooth = True
  return bm


def curve(points, n=12):
  """A smooth path through `points` (Catmull-Rom), n samples a span."""
  P = [Vector(p) for p in points]
  P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
  out = []
  for k in range(1, len(P) - 2):
    p0, p1, p2, p3 = P[k - 1], P[k], P[k + 1], P[k + 2]
    for i in range(n):
      t = i / n
      out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
  out.append(P[-2])
  return out


def M(at=(0, 0, 0), rx=0.0, ry=0.0, rz=0.0):
  """A placement: turned about x, then y, then z (radians), then moved to `at`."""
  return Matrix.Translation(Vector(at)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')


def smoothstep(e0, e1, x):
  t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)


# --- The cabin ------------------------------------------------------------------------------------

TRIMS = {
  # bolsters, inserts, the dash and door cards' upper, the accent strip
  'black': ('leather_black', 'quilted', 'plastic', 'aluminium'),
  'tan': ('leather_tan', 'quilted_tan', 'plastic', 'aluminium'),
  'sport': ('leather_black', 'quilted', 'carbon', 'red_paint'),
  'cloth': ('plastic_dark', 'fabric', 'plastic', 'satin_black'),
}


def seat(out, at, w, trim, back=0.62, recline=0.3, sport=False):
  """A front seat: its cushion's back middle at `at`, facing +y, w wide."""
  side, insert = TRIMS[trim][:2]
  bolster = 0.075 if sport else 0.05
  cushion = pillow(w, 0.5, 0.1, lambda u, v: bolster * smoothstep(0.45, 0.95, abs(u)) + 0.02 * math.sin(math.pi * v) - 0.03 * smoothstep(0.75, 1, v), 10, 7, levels=1,
                   faces=lambda u, v: 'a' if abs(u) < 0.55 and 0.1 < v < 0.85 else 'b')
  names = {'a': insert, 'b': side}
  # The cushion: its front a little up
  out.add((cushion[0], [names.get(n, side) for n in cushion[1]]), M(at, rx=0.08))
  height = back + (0.14 if sport else 0)
  rest = pillow(w * (1.04 if sport else 1), height, 0.12, lambda u, v: (bolster + 0.03) * smoothstep(0.5, 0.95, abs(u)) * (1 - 0.5 * v) + 0.015 * math.sin(math.pi * v), 10, 10, levels=1,
                faces=lambda u, v: 'a' if abs(u) < 0.5 and 0.08 < v < (0.62 if sport else 0.9) else 'b')
  # Stood up behind it, leaning back, its bolsters forward
  out.add((rest[0], [names.get(n, side) for n in rest[1]]), M((at[0], at[1] + 0.02, at[2] + 0.08), rx=math.pi / 2 - recline, rz=math.pi))
  top = Vector((at[0], at[1] + 0.02 - height * math.sin(recline), at[2] + 0.08 + height * math.cos(recline)))
  if not sport:
    head = pillow(w * 0.5, 0.2, 0.09, lambda u, v: 0.01 * math.sin(math.pi * v), 6, 4, levels=1)
    out.add(head, M((top.x, top.y - 0.01, top.z + 0.05), rx=math.pi / 2 - recline * 0.6, rz=math.pi), side)
    for dx in (-0.06, 0.06):
      out.add(cylinder(0.006, 0.08, 8, (top.x + dx, top.y + 0.04, top.z + 0.02)), Matrix.Identity(4), 'chrome')
  # The frame and its rails
  out.add(box((w * 0.8, 0.42, 0.12), (at[0], at[1] + 0.24, at[2] - 0.05), 0.02), Matrix.Identity(4), 'satin_black')
  for dx in (-0.18, 0.18):
    out.add(box((0.04, 0.55, 0.03), (at[0] + dx * w / 0.52, at[1] + 0.22, at[2] - 0.12)), Matrix.Identity(4), 'aluminium')


def bench(out, at, w, trim, seats=3):
  """A rear bench: its cushion's back middle at `at`, w wide, `seats` places."""
  side, insert = TRIMS[trim][:2]
  shape = lambda u, v: 0.025 * abs(math.sin(math.pi * seats * (u + 1) / 2)) + 0.04 * smoothstep(0.85, 1, abs(u)) + 0.02 * math.sin(math.pi * v)
  cushion = pillow(w, 0.48, 0.11, shape, 18, 6, levels=1, faces=lambda u, v: 'a' if abs(u) < 0.85 and 0.12 < v < 0.85 else 'b')
  names = {'a': insert, 'b': side}
  out.add((cushion[0], [names.get(n, side) for n in cushion[1]]), M(at, rx=0.06))
  rest = pillow(w, 0.6, 0.12, shape, 18, 7, levels=1, faces=lambda u, v: 'a' if abs(u) < 0.85 and 0.1 < v < 0.85 else 'b')
  out.add((rest[0], [names.get(n, side) for n in rest[1]]), M((at[0], at[1] + 0.02, at[2] + 0.06), rx=math.pi / 2 - 0.35, rz=math.pi))
  top = Vector((at[0], at[1] + 0.02 - 0.6 * math.sin(0.35), at[2] + 0.06 + 0.6 * math.cos(0.35)))
  for k in range(seats if seats < 3 else 2):
    dx = (k - (seats - 1) / 2) * w / seats if seats < 3 else (-1 if k == 0 else 1) * w / 3
    head = pillow(0.24, 0.16, 0.08, None, 6, 4, levels=1)
    out.add(head, M((top.x + dx, top.y - 0.01, top.z + 0.04), rx=math.pi / 2 - 0.25, rz=math.pi), side)


def dashboard(out, c, trim):
  """The dashboard across the cabin: its profile from the windscreen's foot back to its lip over
  the driver's knees and down to the firewall; the gauges under their hood, the screen, vents."""
  _, _, upper, accent = TRIMS[trim]
  d = c['dash']
  w = c['width'] - 0.04
  lip_y, top_z = d['y'], d['top']
  cowl_y, cowl_z = d['cowl']
  floor = c['floor']
  knee = top_z - d.get('face', 0.3)
  profile = curve([(cowl_y, cowl_z - 0.02), (lip_y + 0.12, top_z + 0.01), (lip_y, top_z - 0.04), (lip_y + 0.03, top_z - 0.18), (lip_y + 0.06, knee), (lip_y + 0.2, knee - 0.06), (cowl_y - 0.05, floor + 0.35)], 6)
  bm = bmesh.new()
  nx = 24
  rows = []
  for i in range(nx + 1):
    x = -w / 2 + w * i / nx
    # The face bows toward the cabin in its middle
    bow = 0.04 * math.cos(math.pi * x / w)
    rows.append([bm.verts.new((x, y - (bow if z < top_z else 0), z)) for (y, _, z) in [(p.x, 0, p.y) for p in profile]])
  m_upper, m_lower, m_accent = 0, 1, 2
  names = [upper, 'plastic_dark', accent]
  for i in range(nx):
    for k in range(len(profile) - 1):
      f = bm.faces.new([rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]])
      z = (profile[k].y + profile[k + 1].y) / 2
      f.material_index = m_accent if top_z - 0.15 < z < top_z - 0.11 else (m_upper if z > top_z - 0.11 else m_lower)
      f.smooth = True
  for end in (0, nx):
    try:
      bm.faces.new(rows[end] if end else rows[end][::-1]).material_index = m_lower
    except ValueError:
      pass
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  out.add((bm, names))
  # The instruments: a housing on the dash before the driver, its face (the gauges) toward them
  # and leaning back a little, a hood shading it
  gx = c['wheel'][0]
  face = M((gx, lip_y + 0.06, top_z + 0.065), rx=math.pi / 2 - 0.2)
  out.add(box((0.42, 0.16, 0.13), (gx, lip_y + 0.14, top_z + 0.055), 0.01), Matrix.Identity(4), 'gloss_black')
  out.add(plane(0.37, 0.155), face @ Matrix.Translation((0, 0, 0.002)), 'gauges')
  out.add(pillow(0.46, 0.2, 0.03, lambda u, v: 0.015 * (1 - u * u), 6, 3, levels=1), M((gx, lip_y + 0.24, top_z + 0.12), rz=math.pi), upper)
  # The screen, standing on the dash in the middle, a little turned to the driver
  sx = 0.0
  stand = M((sx, lip_y + 0.12, top_z + 0.09), rx=math.pi / 2 - 0.22, rz=-0.08 * (1 if gx < 0 else -1))
  out.add(box((0.3, 0.2, 0.018), (0, 0, 0), 0.004), stand, 'gloss_black')
  out.add(plane(0.28, 0.18), stand @ Matrix.Translation((0, 0, 0.0095)), 'screen')
  # Vents: two either side of the middle under the screen, one at each end
  for vx in (-0.1, 0.1, -w / 2 + 0.12, w / 2 - 0.12):
    vent(out, (vx, lip_y + 0.005, top_z - 0.08))
  # Knobs under the middle vents
  for kx in (-0.07, 0, 0.07):
    out.add(cylinder(0.018, 0.02, 20, (kx, lip_y + 0.03, top_z - 0.2), 'y'), Matrix.Identity(4), 'aluminium')


def plane(w, h):
  """A flat rectangle w by h about the origin, facing +z."""
  bm = bmesh.new()
  vs = [bm.verts.new((x * w / 2, y * h / 2, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
  bm.faces.new(vs)
  return bm


def vent(out, at):
  """An air vent on the dash's face: a gloss frame, dark inside, slats across."""
  out.add(box((0.11, 0.025, 0.05), at, 0.006), Matrix.Identity(4), 'gloss_black')
  for k in range(4):
    out.add(box((0.095, 0.03, 0.004), (at[0], at[1] - 0.004, at[2] - 0.018 + k * 0.012)), Matrix.Identity(4), 'aluminium')


def steering(out, c):
  """The steering wheel: rim, three spokes, the hub, the column into the dash, two stalks."""
  x, y, z = c['wheel']
  tilt = c.get('wheel_tilt', 0.42)
  place = M((x, y, z), rx=math.pi / 2 - tilt)
  out.add(torus(0.185, 0.017, 48, 10), place, 'leather_black')
  for a in (0, math.pi, -math.pi / 2):
    out.add(box((0.15, 0.035, 0.014), (0.09 * math.cos(a), 0.09 * math.sin(a), 0)), place @ Matrix.Rotation(a, 4, 'Z'), 'satin_black')
  out.add(cylinder(0.065, 0.05, 32, (0, 0, -0.01)), place, 'satin_black')
  out.add(cylinder(0.05, 0.004, 32, (0, 0, 0.016)), place, 'gloss_black')
  out.add(torus(0.05, 0.003, 32, 6), place @ Matrix.Translation((0, 0, 0.017)), 'aluminium')
  # The column, down and forward into the dash
  axis = (place.to_3x3() @ Vector((0, 0, -1))).normalized()
  hub = Vector((x, y, z))
  out.add(tube([hub + axis * 0.02, hub + axis * 0.3], 0.035, 12), Matrix.Identity(4), 'satin_black')
  for side in (-1, 1):
    out.add(tube([hub + axis * 0.1 + Vector((side * 0.04, 0, 0)), hub + axis * 0.1 + Vector((side * 0.17, 0.02, 0.02))], 0.007, 8), Matrix.Identity(4), 'satin_black')


def console(out, c, trim):
  """The centre console from the dash down between the front seats: gear lever, cupholders, armrest."""
  side, insert, upper, accent = TRIMS[trim]
  d = c['dash']
  y0, y1 = c['console']
  floor = c['floor']
  h = c['seat_z'] - floor + 0.04
  out.add(pillow(0.24, y1 - y0, h, lambda u, v: 0.0, 4, 6, levels=1), M((0, y1, floor), rz=math.pi), 'plastic_dark')
  # The stack down the dash's face to it
  out.add(box((0.24, 0.12, d['top'] - 0.25 - floor - h + 0.1), (0, d['y'] + 0.08, (d['top'] - 0.25 + floor + h) / 2), 0.02), Matrix.Identity(4), 'plastic_dark')
  top = floor + h + 0.02
  gy = y1 - 0.12
  out.add(box((0.2, 0.18, 0.006), (0, gy, top - 0.005)), Matrix.Identity(4), accent)
  out.add(cylinder(0.035, 0.03, 24, (0, gy, top + 0.01), r2=0.022), Matrix.Identity(4), side)
  out.add(cylinder(0.009, 0.1, 10, (0, gy, top + 0.06)), Matrix.Identity(4), 'chrome')
  out.add(pillow(0.055, 0.075, 0.045, lambda u, v: 0.012 * math.sin(math.pi * v), 4, 4), M((0, gy - 0.035, top + 0.1)), side)
  for cx in (-0.05, 0.05):
    out.add(cylinder(0.038, 0.006, 24, (cx, gy - 0.18, top)), Matrix.Identity(4), 'gloss_black')
  # The armrest, padded, at the back between the seats
  out.add((lambda p: (p[0], [side for _ in p[1]]))(pillow(0.22, 0.3, 0.07, lambda u, v: 0.015 * (1 - u * u), 6, 6)), M((0, y0 + 0.02, top + 0.06)))


def floor_carpet(out, c):
  """The floor: carpet over the transmission tunnel, rising to the firewall at the front."""
  f = c['floor']
  w = c['width']
  y_back, y_toe = c['floor_y']
  fire = c['dash']['cowl'][0] - 0.1
  bm = bmesh.new()
  nx, ny = 16, 12
  rows = []
  for j in range(ny + 1):
    t = j / ny
    y = y_back + (fire - y_back) * t
    rise = max(0.0, (y - y_toe) / max(fire - y_toe, 1e-3)) * 0.32
    rows.append([bm.verts.new((x, y, f + rise + c.get('tunnel', 0.12) * smoothstep(0.16, 0.06, abs(x)))) for x in [-w / 2 + w * i / nx for i in range(nx + 1)]])
  for j in range(ny):
    for i in range(nx):
      bm.faces.new([rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]]).smooth = True
  out.add(bm, Matrix.Identity(4), 'carpet')
  # Pedals before the driver's feet
  px = c['wheel'][0]
  for k, (dx, pw) in enumerate(((-0.12, 0.05), (0.0, 0.09), (0.13, 0.05))):
    y = y_toe + 0.06
    out.add(box((pw, 0.012, 0.07), (px + dx, y, f + 0.14), 0.004), M() @ Matrix.Translation((0, 0, 0)), 'rubber')
    out.add(tube([(px + dx, y + 0.005, f + 0.17), (px + dx, y + 0.12, f + 0.4)], 0.008, 6), Matrix.Identity(4), 'satin_black')


def headliner(out, c, body):
  """The headliner just under the roof (cast up to it from inside), sun visors and the mirror."""
  tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
  y0, y1 = c['roof_y']
  w = c['width'] - 0.06
  nx, ny = 12, 12
  grid = {}
  for i in range(nx + 1):
    for j in range(ny + 1):
      x, y = -w / 2 + w * i / nx, y0 + (y1 - y0) * j / ny
      # Down onto the roof from above it (from inside, what's under the roof caught it first)
      hit = tree.ray_cast(Vector((x, y, 5.0)), Vector((0, 0, -1)), 5.0)
      if hit[0] is not None and hit[0].z > c['belt'] + 0.25:
        grid[i, j] = hit[0] - Vector((0, 0, 0.035))
  bm = bmesh.new()
  verts = {k: bm.verts.new(p) for k, p in grid.items()}
  for i in range(nx):
    for j in range(ny):
      q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
      if all(k in verts for k in q):
        bm.faces.new([verts[k] for k in q]).smooth = True
  out.add(bm, Matrix.Identity(4), 'headliner')
  # Visors and the mirror at the windscreen's top
  front = max((p for p in grid.values()), key=lambda p: p.y, default=None)
  if front is None:
    return
  zt = front.z - 0.02
  for vx in (-0.35, 0.35):
    out.add(pillow(0.36, 0.17, 0.02, None, 4, 3, levels=1), M((vx, y1 - 0.02, zt - 0.005), rx=math.pi), 'headliner')
  out.add(box((0.24, 0.025, 0.065), (0, y1 - 0.07, zt - 0.09), 0.01), Matrix.Identity(4), 'satin_black')
  out.add(tube([(0, y1 - 0.07, zt - 0.06), (0, y1 - 0.05, zt)], 0.008, 8), Matrix.Identity(4), 'satin_black')


def belts(out, c):
  """Seatbelts at the front seats, unworn: hanging from the pillar behind the door down to the
  anchor beside the seat; the buckle on its stalk on the seat's inner side."""
  for x in c['front']:
    s = 1 if x > 0 else -1
    sy = c['seat_y']
    wall = s * (c['width'] / 2 - 0.05)
    top = Vector((wall, sy - 0.15, c['belt'] + 0.32))
    low = Vector((wall - s * 0.02, sy - 0.02, c['seat_z'] - 0.02))
    out.add(strap(top, low, 0.045), Matrix.Identity(4), 'fabric_belt')
    out.add(box((0.03, 0.05, 0.07), (wall - s * 0.01, sy - 0.15, c['belt'] + 0.32), 0.006), Matrix.Identity(4), 'satin_black')
    bx = x - s * (c.get('seat_w', 0.52) / 2 + 0.03)
    out.add(tube([(bx, sy + 0.02, c['seat_z'] - 0.05), (bx, sy + 0.06, c['seat_z'] + 0.12)], 0.012, 8), Matrix.Identity(4), 'satin_black')
    out.add(box((0.03, 0.025, 0.07), (bx, sy + 0.065, c['seat_z'] + 0.16), 0.006), Matrix.Identity(4), 'gloss_black')


def strap(a, b, w):
  """A flat strap from a to b, w wide (turned to face across the car)."""
  d = (b - a).normalized()
  side = d.cross(Vector((1, 0, 0)))
  side = (side if side.length > 1e-3 else d.cross(Vector((0, 0, 1)))).normalized() * w / 2
  bm = bmesh.new()
  bm.faces.new([bm.verts.new(a - side), bm.verts.new(b - side), bm.verts.new(b + side), bm.verts.new(a + side)])
  return bm


def door_card(door, c, trim):
  """A door's card: a padded panel over the inside of its skin, with an armrest, a pull handle, a
  speaker and the window switches. Returns its Part, in the car's frame (it goes with the door)."""
  side, insert, upper, accent = TRIMS[trim]
  pts = [door.matrix_world @ v.co for v in door.data.vertices]
  s = 1 if sum(p.x for p in pts) > 0 else -1
  skin = sorted(abs(p.x) for p in pts if c['floor'] < p.z < c['belt'])
  x = s * (skin[len(skin) // 2] - 0.07)
  ys = [p.y for p in pts]
  y0, y1 = min(ys) + 0.06, max(ys) - 0.05
  z0, z1 = max(c['floor'] + 0.05, min(p.z for p in pts) + 0.05), c['belt'] - 0.02
  out = Part(f'{door.name}.card')
  length, height = y1 - y0, z1 - z0
  card = pillow(length, height, 0.03, lambda u, v: 0.008 * smoothstep(0.55, 0.62, v) * smoothstep(0.95, 0.9, v), 6, 6, levels=1, faces=lambda u, v: 'a' if 0.55 < v < 0.93 else 'b')
  # Stood up along the door, its face toward the cabin
  stand = M((x, (y0 + y1) / 2, z0), rx=math.pi / 2, rz=-s * math.pi / 2)
  out.add((card[0], [insert if n == 'a' else ('plastic_dark' if n == 'b' else upper) for n in card[1]]), stand)
  arm_z = c['seat_z'] + 0.16
  out.add(pillow(length * 0.55, 0.08, 0.05, lambda u, v: 0.01 * math.sin(math.pi * v), 6, 3), M((x - s * 0.02, (y0 + y1) / 2 - length * 0.05, arm_z), rz=-s * math.pi / 2), side)
  out.add(box((0.012, 0.14, 0.03), (x - s * 0.06, y1 - 0.18, arm_z + 0.13), 0.004), Matrix.Identity(4), 'chrome')
  out.add(cylinder(0.075, 0.012, 32, (x - s * 0.03, y1 - 0.2, z0 + 0.14), 'x'), Matrix.Identity(4), 'satin_black')
  out.add(box((0.05, 0.12, 0.012), (x - s * 0.05, (y0 + y1) / 2 + 0.1, arm_z + 0.03)), Matrix.Identity(4), accent)
  return out


def lining(c, body):
  """The body's inside where it's seen from the cabin (its pillars, sills, door frames, the roof's
  edges): each face that a ray from where a head would be meets first, from behind (its inner
  side), again a little in, in plastic, so from inside it isn't paint. Not what's seen through the
  glass (the hood, from outside), nor what's round the engine bay."""
  out = Part('lining')
  bm = bmesh.new()
  bm.from_mesh(body.data)
  bm.transform(body.matrix_world)
  bm.faces.ensure_lookup_table()
  tree = BVHTree.FromBMesh(bm)
  eyes = [Vector((x, c['seat_y'] + 0.12, c['seat_z'] + 0.72)) for x in c['front']]
  if 'rear' in c:
    eyes += [Vector((x, c['rear'] + 0.15, c['seat_z'] + 0.65)) for x in (-0.4, 0, 0.4)]
  if 'cargo' in c:
    y0, y1 = c['cargo']
    eyes += [Vector((0, y, c['cargo_floor'] + 1.1)) for y in (y0 + 0.5, (y0 + y1) / 2, y1 - 0.5)]
  seen = set()
  for f in bm.faces:
    m = f.calc_center_median()
    for e in eyes:
      d = m - e
      if d.length < 1e-3 or d.normalized().dot(f.normal) <= 0.05:
        continue
      hit = tree.ray_cast(e, d.normalized(), d.length + 0.01)
      if hit[2] == f.index:
        seen.add(f.index)
        break
  axis = lambda p: Vector((0, p.y, (c['seat_z'] + c['belt']) / 2))
  bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in seen], context='FACES')
  for v in bm.verts:
    v.co += (axis(v.co) - v.co).normalized() * 0.01
  # (A fine body's lining: its nearly flat stretches as fewer faces; from inside it's dim plastic)
  bmesh.ops.dissolve_limit(bm, angle_limit=c.get('lining_flat', 0.0), verts=bm.verts, edges=bm.edges)
  out.add(bm, Matrix.Identity(4), 'plastic')
  return out


def taxi_extras(out, c):
  """A cab's partition behind the front seats (a frame, perspex over it) and the meter on the dash."""
  y = c['partition']
  w = c['width'] - 0.04
  zb, zt = c['seat_z'] + 0.12, c['belt'] + 0.3
  out.add(box((w, 0.03, 0.04), (0, y, zb)), Matrix.Identity(4), 'satin_black')
  out.add(box((w, 0.03, 0.04), (0, y, zt)), Matrix.Identity(4), 'satin_black')
  for x in (-w / 2, 0, w / 2):
    out.add(box((0.04, 0.03, zt - zb), (x, y, (zb + zt) / 2)), Matrix.Identity(4), 'satin_black')
  out.add(box((w - 0.04, 0.008, zt - zb - 0.04), (0, y, (zb + zt) / 2)), Matrix.Identity(4), 'perspex')
  d = c['dash']
  out.add(box((0.16, 0.08, 0.06), (0.12, d['y'] + 0.12, d['top'] + 0.04), 0.008), Matrix.Identity(4), 'satin_black')
  out.add(plane(0.12, 0.03), M((0.12, d['y'] + 0.079, d['top'] + 0.045), rx=math.pi / 2) @ Matrix.Rotation(math.pi, 4, 'Z'), 'meter')


def cargo(out, c):
  """A van's load space: a bulkhead behind the cab, plywood floor and lining, a shelf rack and boxes."""
  y0, y1 = c['cargo']
  w = c['width']
  f = c['cargo_floor']
  out.add(box((w, y1 - y0, 0.02), (0, (y0 + y1) / 2, f)), Matrix.Identity(4), 'plywood')
  for s in (-1, 1):
    out.add(box((0.012, y1 - y0, 1.1), (s * (w / 2 - 0.01), (y0 + y1) / 2, f + 0.6)), Matrix.Identity(4), 'plywood')
  out.add(box((w, 0.03, c['roof'] - f), (0, y1, (f + c['roof']) / 2)), Matrix.Identity(4), 'primer')
  # A rack along the left side, two shelves, boxes on them and on the floor
  rx = -w / 2 + 0.22
  for yy in (y0 + 0.2, (y0 + y1) / 2, y1 - 0.2):
    out.add(box((0.03, 0.03, 1.2), (rx + 0.18, yy, f + 0.6)), Matrix.Identity(4), 'aluminium')
  for z in (f + 0.45, f + 1.0):
    out.add(box((0.4, y1 - y0 - 0.3, 0.02), (rx, (y0 + y1) / 2, z)), Matrix.Identity(4), 'plywood')
  rng = [0.31, 0.77, 0.12, 0.55, 0.9, 0.42, 0.66, 0.2]
  for k, (bx, by, bz, s) in enumerate([(rx, y0 + 0.5, f + 0.47, 0.32), (rx, y0 + 1.0, f + 0.47, 0.28), (rx, y1 - 0.6, f + 1.02, 0.3), (0.2, y0 + 0.4, f + 0.02, 0.45), (0.45, y0 + 0.5, f + 0.02, 0.4), (0.3, y0 + 0.45, f + 0.47, 0.35), (0.35, y0 + 1.3, f + 0.02, 0.5)]):
    h = s * (0.7 + 0.5 * rng[k % len(rng)])
    out.add(box((s, s * 1.1, h), (bx, by, bz + h / 2), 0.004), M() @ Matrix.Translation((0, 0, 0)), 'cardboard')
    out.add(box((0.05, s * 1.12, 0.004), (bx, by, bz + h + 0.001)), Matrix.Identity(4), 'tape')


def cabin(c, body):
  """Everything inside the cabin (the body's)."""
  out = Part('cabin')
  trim = c.get('trim', 'black')
  sport = c.get('sport', False)
  for x in c['front']:
    seat(out, (x, c['seat_y'], c['seat_z']), c.get('seat_w', 0.52), trim, sport=sport)
  if 'rear' in c:
    bench(out, (0, c['rear'], c['seat_z'] - 0.02), c['width'] - 0.12, trim, c.get('rear_seats', 3))
  dashboard(out, c, trim)
  steering(out, c)
  if 'console' in c:
    console(out, c, trim)
  floor_carpet(out, c)
  headliner(out, c, body)
  belts(out, c)
  if 'partition' in c:
    taxi_extras(out, c)
  if 'cargo' in c:
    cargo(out, c)
  if 'bulkhead' in c:
    # Behind the seats: carpet up to the windows, a window over it onto the engine
    y = c['bulkhead']
    w = c['width']
    out.add(box((w, 0.03, c['belt'] - c['floor']), (0, y, (c['floor'] + c['belt']) / 2)), Matrix.Identity(4), 'carpet')
    top = c['belt'] + 0.32
    out.add(box((w, 0.03, 0.03), (0, y, top)), Matrix.Identity(4), 'satin_black')
    out.add(box((w - 0.1, 0.008, top - c['belt']), (0, y, (c['belt'] + top) / 2)), Matrix.Identity(4), 'perspex')
  if 'shelf' in c:
    y, z = c['shelf']
    out.add(box((c['width'] - 0.1, 0.4, 0.02), (0, y, z)), Matrix.Identity(4), 'carpet')
  return out


# --- Under the hood, in the trunk, at the hubs ----------------------------------------------------

def engine(e):
  """An engine filling the bay `e['box']`: its block, cam covers, intake, air box, radiator,
  battery, reservoirs, strut towers and hoses (`e['v8']`: a V with two banks and red coil packs).
  `e['mid']`: behind the cabin, its firewall at the bay's front, a muffler and its pipes at the
  back instead of a radiator (built the front-engined way round, then turned)."""
  (x0, y0, z0), (x1, y1, z1) = e['box']
  out = Part('engine')
  cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
  W, L, H = x1 - x0, y1 - y0, z1 - z0
  # The block, low in the middle
  out.add(pillow(W * 0.5, L * 0.55, H * 0.55, None, 4, 4, levels=1), M((cx, cy - L * 0.3, z0)), 'engine_grey')
  bank = [-1, 1] if e.get('v8') else [0]
  for b in bank:
    bx = cx + b * W * 0.13
    cover = pillow(W * (0.2 if e.get('v8') else 0.3), L * 0.55, 0.08, lambda u, v: 0.02 * (1 - u * u), 4, 6, levels=2)
    out.add(cover, M((bx, cy - L * 0.3, z0 + H * 0.55), ry=-b * 0.35), 'red_paint' if e.get('v8') else 'aluminium')
    for k in range(5):
      out.add(box((W * 0.16, 0.012, 0.012), (bx, cy - L * 0.25 + k * L * 0.1, z0 + H * 0.55 + 0.1)), Matrix.Identity(4), 'satin_black')
  # The intake plenum along the top, its runners down to the head
  out.add(cylinder(0.06, L * 0.45, 20, (cx, cy - L * 0.02, z0 + H * 0.82), 'y'), Matrix.Identity(4), 'satin_black')
  for k in range(4):
    out.add(tube([(cx, cy - L * 0.18 + k * L * 0.1, z0 + H * 0.8), (cx + 0.08, cy - L * 0.18 + k * L * 0.1, z0 + H * 0.7)], 0.02, 8), Matrix.Identity(4), 'satin_black')
  # The air box at one side, its hose to the plenum
  out.add(box((W * 0.22, L * 0.3, H * 0.3), (x0 + W * 0.16, y1 - L * 0.25, z0 + H * 0.6), 0.02), Matrix.Identity(4), 'satin_black')
  out.add(tube(curve([(x0 + W * 0.2, y1 - L * 0.4, z0 + H * 0.7), (cx - 0.05, cy + L * 0.15, z0 + H * 0.9), (cx, cy + L * 0.2, z0 + H * 0.82)], 6), 0.045, 14), Matrix.Identity(4), 'rubber')
  if e.get('mid'):
    # The muffler across the back, its tailpipes out
    out.add(cylinder(0.11, W * 0.7, 24, (cx, y1 - 0.14, z0 + H * 0.3), 'x'), Matrix.Identity(4), 'aluminium')
    for fx in (-0.25, 0.25):
      out.add(tube([(cx + fx * W / 2, y1 - 0.25, z0 + H * 0.5), (cx + fx * W / 2, y1 - 0.14, z0 + H * 0.35)], 0.035, 10), Matrix.Identity(4), 'cast_iron')
  else:
    # The radiator across the front, fans behind
    out.add(box((W * 0.85, 0.05, H * 0.75), (cx, y1 - 0.04, z0 + H * 0.45), 0.005), Matrix.Identity(4), 'satin_black')
    for fx in (-0.18, 0.18):
      out.add(cylinder(min(0.16, H * 0.3), 0.03, 24, (cx + fx * W / 1.2, y1 - 0.09, z0 + H * 0.45), 'y'), Matrix.Identity(4), 'gloss_black')
  # The battery, the reservoirs
  bx = x1 - W * 0.16
  out.add(box((0.24, 0.17, 0.18), (bx, y1 - L * 0.32, z0 + H * 0.55), 0.01), Matrix.Identity(4), 'gloss_black')
  for k, m in ((-1, 'red_paint'), (1, 'satin_black')):
    out.add(cylinder(0.012, 0.02, 10, (bx + k * 0.07, y1 - L * 0.32, z0 + H * 0.55 + 0.1)), Matrix.Identity(4), m)
  out.add(box((0.14, 0.12, 0.14), (bx, y0 + L * 0.3, z0 + H * 0.6), 0.02), Matrix.Identity(4), 'reservoir')
  out.add(cylinder(0.025, 0.02, 16, (bx, y0 + L * 0.3, z0 + H * 0.6 + 0.08)), Matrix.Identity(4), 'yellow')
  out.add(box((0.12, 0.1, 0.12), (x0 + W * 0.15, y0 + L * 0.25, z0 + H * 0.6), 0.02), Matrix.Identity(4), 'reservoir')
  out.add(cylinder(0.025, 0.02, 16, (x0 + W * 0.15, y0 + L * 0.25, z0 + H * 0.6 + 0.07)), Matrix.Identity(4), 'blue_cap')
  # Strut towers at the back corners of the bay, the firewall behind
  for s in (-1, 1):
    out.add(cylinder(0.08, H * 0.6, 24, (cx + s * W * 0.43, y0 + L * 0.12, z0 + H * 0.65)), Matrix.Identity(4), 'primer')
  out.add(box((W, 0.02, H), (cx, y0 - 0.01, z0 + H / 2)), Matrix.Identity(4), 'primer')
  # A hose or two across
  out.add(tube(curve([(cx - W * 0.3, y1 - 0.1, z0 + H * 0.3), (cx - W * 0.25, cy, z0 + H * 0.45), (cx - W * 0.1, y0 + 0.15, z0 + H * 0.5)], 6), 0.018, 10), Matrix.Identity(4), 'rubber')
  # A bay floor so nothing's seen through below
  out.add(box((W, L, 0.01), (cx, cy, z0)), Matrix.Identity(4), 'primer')
  if e.get('mid'):
    # Turned end for end about the bay's middle (its firewall now at the front, by the cabin)
    turn = Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Translation((-cx, -cy, 0))
    out.bm.transform(turn)
  return out


def trunk_lining(t):
  """A trunk's carpet and its spare wheel."""
  (x0, y0, z0), (x1, y1, z1) = t['box']
  out = Part('trunk')
  cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
  out.add(box((x1 - x0, y1 - y0, 0.015), (cx, cy, z0)), Matrix.Identity(4), 'carpet')
  for s in (-1, 1):
    out.add(box((0.015, y1 - y0, z1 - z0), (cx + s * (x1 - x0) / 2, cy, (z0 + z1) / 2)), Matrix.Identity(4), 'carpet')
  out.add(box((x1 - x0, 0.015, z1 - z0), (cx, y1, (z0 + z1) / 2)), Matrix.Identity(4), 'carpet')
  r = min(0.3, (y1 - y0) * 0.45)
  out.add(torus(r * 0.75, r * 0.25, 40, 12), M((cx + (x1 - x0) * 0.2, cy, z0 + r * 0.25 + 0.02)), 'rubber')
  out.add(cylinder(r * 0.55, 0.12, 32, (cx + (x1 - x0) * 0.2, cy, z0 + 0.08)), Matrix.Identity(4), 'cast_iron')
  out.add(pillow(0.4, 0.28, 0.2, lambda u, v: 0.04 * (1 - u * u), 6, 4), M((cx - (x1 - x0) * 0.22, cy - 0.14, z0 + 0.015)), 'fabric')
  return out


def underside(lid, name):
  """A lid's underside: its skin again a little in, dark primer, so open it isn't paint inside."""
  out = Part(f'{name}.under')
  bm = bmesh.new()
  bm.from_mesh(lid.data)
  bm.transform(lid.matrix_world)
  bm.normal_update()
  centre = sum((v.co for v in bm.verts), Vector()) / max(1, len(bm.verts))
  for v in bm.verts:
    n = v.normal if v.normal.length > 0 else Vector((0, 0, 1))
    # (In, toward the car: away from the open side)
    v.co -= n * 0.018 if n.z > 0 or (v.co - centre).dot(n) > 0 else -n * 0.018
  out.add(bm, Matrix.Identity(4), 'primer')
  return out


def brakes(wheels, colour):
  """A disc and a caliper at each hub (the body's: they stay when the wheel goes), just inside the rim."""
  out = Part('brakes')
  for at, r in wheels:
    s = 1 if at.x > 0 else -1
    c = at - Vector((s * 0.06, 0, 0))
    out.add(cylinder(r * 0.66, 0.026, 40, c, 'x'), Matrix.Identity(4), 'cast_iron')
    out.add(cylinder(r * 0.3, 0.06, 24, c - Vector((s * 0.02, 0, 0)), 'x'), Matrix.Identity(4), 'satin_black')
    cal = pillow(0.07, 0.2, 0.06, lambda u, v: 0.0, 4, 6, levels=1)
    out.add(cal, M((c.x - s * 0.03, c.y - r * 0.45, c.z + r * 0.35), rx=-0.9) @ Matrix.Rotation(math.pi / 2, 4, 'Z'), colour)
  return out


def build(car, parts):
  """Everything inside `car` (its `cabin` spec): {part name: [objects]} to join into each part."""
  _materials.clear()  # (a new file since the last car: its materials are gone)
  c = car['cabin']
  body = parts['body']
  out = {'body': [cabin(c, body).object(), lining(c, body).object()]}
  if 'engine' in car:
    out['body'].append(engine(car['engine']).object())
  if 'trunk_box' in car:
    out['body'].append(trunk_lining({'box': car['trunk_box']}).object())
  wheels = []
  for n, o in parts.items():
    if n.startswith('wheel.'):
      pts = [o.matrix_world @ v.co for v in o.data.vertices]
      lo = Vector([min(p[k] for p in pts) for k in range(3)])
      hi = Vector([max(p[k] for p in pts) for k in range(3)])
      wheels.append(((lo + hi) / 2, (hi.z - lo.z) / 2))
  if wheels and car.get('brakes', True):
    out['body'].append(brakes(wheels, c.get('calipers', 'satin_black')).object())
  for n, o in parts.items():
    if n.startswith('door.') and not n.startswith('door.b') and n != 'door.side':
      out.setdefault(n, []).append(door_card(o, c, c.get('trim', 'black')).object())
    if n in ('hood', 'trunk'):
      out.setdefault(n, []).append(underside(o, n).object())
  return out
