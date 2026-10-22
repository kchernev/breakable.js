#!/usr/bin/env python3
"""Models the sedan, the taxi and the van (car_designs.py) as Blender files, into
assets-src/cars/<name>/source/<name>.blend, for process-cars.py to cut into the parts they come
apart into (cars.mjs `blend`).

  blender -b --factory-startup --python scripts/assets/car_model.py -- [name ...] [--views]

A body is one surface: the lines that run along the car (the bottom's, the sill's, the shoulder's,
the belt's, the glass's, the roof's), each a smooth curve through its points (y forward, its x and
z by y), met by stations across it (a door's seam, the windscreen's foot, the roof's end) and
closed at each end by its face (a patch filled in between the lines' ends). Each cell between two
stations and two lines is one of the car's regions (a door, the hood, glass, a pillar's black...),
so every seam runs along a station or a line. The wheel arches are cut out of it, the lights, the
grilles and the plates sunk into it; the regions are made the parts, gapped and lipped at their
seams, the glass set in its black surround; then the mirrors, the handles, the wipers, the plates,
the wheels.

`--views` renders it from the sides of its reference pictures (assets-src/cars/refs) to
assets-src/cars/<name>/views/.
"""

import math
import re
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import car_designs  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'assets-src/cars'

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
NAMES = [a for a in ARGS if not a.startswith('--')] or list(car_designs.DESIGNS)
VIEWS = '--views' in ARGS

# The surface's points this far apart at most (m)
STEP = 0.055

# --- Curves -----------------------------------------------------------------------------------------


def pchip(xs, ys):
  """A monotone cubic through (xs, ys) (xs increasing): f(x), held at the ends."""
  xs = np.asarray(xs, float)
  ys = np.asarray(ys, float)
  if len(xs) == 1:
    return lambda x: np.full_like(np.asarray(x, float), ys[0])
  h = np.diff(xs)
  d = np.diff(ys) / h
  m = np.zeros_like(ys)
  m[0], m[-1] = d[0], d[-1]
  for i in range(1, len(xs) - 1):
    if d[i - 1] * d[i] > 0:
      w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

  def f(x):
    x = np.clip(np.asarray(x, float), xs[0], xs[-1])
    i = np.clip(np.searchsorted(xs, x, side='right') - 1, 0, len(h) - 1)
    t = (x - xs[i]) / h[i]
    t2, t3 = t * t, t * t * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]

  return f


class Line:
  """A line along the car: its x and z by y, through points (y, x, z) from its front end back."""

  def __init__(self, points):
    pts = sorted(points, key=lambda p: p[0])
    self.y0, self.y1 = pts[0][0], pts[-1][0]
    ys = [p[0] for p in pts]
    self.fx = pchip(ys, [p[1] for p in pts])
    self.fz = pchip(ys, [p[2] for p in pts])

  def at(self, y):
    y = np.asarray(y, float)
    return np.stack([self.fx(y), y, self.fz(y)], -1)


def hermite_chain(points, counts, mirror_start=False, mirror_end=False, creases=()):
  """A smooth curve through `points` (Catmull-Rom by chord length), each span cut into its count
  of steps: the points along it. An end on the mirror (x = 0) leaves it square to the mirror; at a
  point in `creases` it turns sharply (each span leaves and meets it along its own chord)."""
  P = [np.asarray(p, float) for p in points]
  n = len(P)
  ext = list(P)
  if mirror_start:
    first = P[1] * np.array([-1, 1, 1])
  else:
    first = 2 * P[0] - P[1]
  if mirror_end:
    last = P[-2] * np.array([-1, 1, 1])
  else:
    last = 2 * P[-1] - P[-2]
  ext = [first] + ext + [last]
  chord = [max(np.linalg.norm(ext[i + 1] - ext[i]), 1e-9) for i in range(len(ext) - 1)]
  # Tangents (by chord length): at each real point
  tang = []
  for i in range(1, n + 1):
    a, b = chord[i - 1], chord[i]
    tang.append((ext[i + 1] - ext[i - 1]) / (a + b))
  out = []
  for s in range(n - 1):
    p0, p1 = P[s], P[s + 1]
    h = np.linalg.norm(p1 - p0)
    steps = counts[s]
    chord_dir = (p1 - p0) / max(h, 1e-9)
    t0 = chord_dir if s in creases else tang[s]
    t1 = chord_dir if s + 1 in creases else tang[s + 1]
    for j in range(steps):
      t = j / steps
      if h < 1e-6:
        out.append(p0.copy())
        continue
      t2, t3 = t * t, t * t * t
      out.append((2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * t0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * t1)
  out.append(P[-1].copy())
  return np.array(out)


def resample(curve, n):
  """`curve` (points) as n + 1 points evenly along it."""
  seg = np.linalg.norm(np.diff(curve, axis=0), axis=1)
  s = np.concatenate([[0], np.cumsum(seg)])
  t = np.linspace(0, s[-1], n + 1)
  return np.stack([np.interp(t, s, curve[:, k]) for k in range(3)], -1)


# --- The body's surface -------------------------------------------------------------------------------


class Surface:
  """The body's right half (x >= 0): the loft of the design's lines through its stations, and its
  end faces. Quads, each with its region."""

  def __init__(self, design):
    self.d = design
    lines = [Line(p) for p in design['lines']]
    K = len(lines)
    stations = design['stations']
    N = len(stations)
    # Each station's y on each line (a station is a y, or a y per line); the ends: the lines' ends
    Y = np.zeros((N, K))
    for i, s in enumerate(stations):
      for k in range(K):
        if s == 'rear':
          Y[i, k] = lines[k].y0
        elif s == 'front':
          Y[i, k] = lines[k].y1
        else:
          Y[i, k] = s(k) if callable(s) else (s[k] if isinstance(s, (list, tuple)) else s)
    for k in range(K):
      if np.any(np.diff(Y[:, k]) <= 0):
        raise ValueError(f'stations cross on line {k}: {Y[:, k]}')
    P = np.stack([lines[k].at(Y[:, k]) for k in range(K)], 1)
    self.lines, self.Y, self.P, self.N, self.K = lines, Y, P, N, K
    # Steps: along each span between stations and across each between lines
    nu = [max(1, math.ceil(np.max(np.linalg.norm(P[i + 1] - P[i], axis=1)) / STEP)) for i in range(N - 1)]
    nv = [max(1, math.ceil(np.max(np.linalg.norm(P[:, k + 1] - P[:, k], axis=1)) / STEP)) for k in range(K - 1)]
    # The end faces' bottoms and tops step alike (their rows run from one to the other)
    b, t = design['face']['bottom'], design['face']['top']
    for j in range(b[1] - b[0]):
      kb, kt = b[0] + j, t[1] - 1 - j
      nv[kb] = nv[kt] = max(nv[kb], nv[kt])
    self.nu, self.nv = nu, nv

  def loft(self):
    """The dense grid of the loft: points [u][v], and each quad's (station span, line span)."""
    lines, Y, N, K = self.lines, self.Y, self.N, self.K
    rows = []
    span_u = []
    for i in range(N - 1):
      for a in range(self.nu[i] + (1 if i == N - 2 else 0)):
        f = a / self.nu[i]
        yk = Y[i] + (Y[i + 1] - Y[i]) * f
        ring = [lines[k].at(yk[k]) for k in range(K)]
        rows.append(hermite_chain(ring, self.nv, mirror_start=True, mirror_end=True, creases=self.d.get('creases', ())))
        if a < self.nu[i]:
          span_u.append(i)
    G = np.array(rows)
    span_v = [k for k in range(K - 1) for _ in range(self.nv[k])]
    return G, span_u, span_v

  def end_face(self, ring, centre, front):
    """An end of the car: the patch filling its ring (the loft's last points round, from the
    bottom's middle to the top's) between its bottom, its corner, its top and its middle
    (`centre`: points on x = 0 from the bottom up). Points [c][r]: c from the middle out, r up."""
    b, t = self.d['face']['bottom'], self.d['face']['top']
    off = np.concatenate([[0], np.cumsum(self.nv)])
    B = ring[off[b[0]]:off[b[1]] + 1]
    R = ring[off[b[1]]:off[t[0]] + 1]
    T = ring[off[t[0]]:off[t[1]] + 1][::-1]
    nb, nr = len(B) - 1, len(R) - 1
    assert len(T) - 1 == nb, (len(T), nb)
    L = hermite_chain([B[0], *[np.asarray(c, float) for c in centre], T[0]], [8] * (len(centre) + 1))
    L = resample(L, nr)
    Q = np.zeros((nb + 1, nr + 1, 3))
    for c in range(nb + 1):
      s = c / nb
      for r in range(nr + 1):
        q = r / nr
        Q[c, r] = (1 - q) * B[c] + q * T[c] + (1 - s) * L[r] + s * R[r] - ((1 - s) * (1 - q) * B[0] + s * (1 - q) * B[nb] + (1 - s) * q * T[0] + s * q * T[nb])
    return Q


# --- Looks --------------------------------------------------------------------------------------------

# name: (colour (sRGB hex), roughness, metalness, extra): extra `coat` (clear coat), `alpha`,
# `glow` (emission strength, in its colour)
LOOKS = {
  'trim': (0x0a0a0b, 0.12, 0.0, {}),
  'plastic': (0x141516, 0.62, 0.0, {}),
  'plastic_grey': (0x2a2b2d, 0.55, 0.0, {}),
  'chrome': (0xeeeff1, 0.1, 0.9, {}),
  'satin_chrome': (0xd2d4d6, 0.26, 0.75, {}),
  'rubber': (0x0d0d0d, 0.88, 0.0, {}),
  'tyre': (0x121212, 0.82, 0.0, {}),
  'tyre_wall': (0x161616, 0.7, 0.0, {}),
  'alloy': (0xd4d7da, 0.32, 0.55, {'coat': 0.6, 'coat_rough': 0.1}),
  'alloy_dark': (0x55585c, 0.45, 0.4, {}),
  'steel_wheel': (0xbfc2c5, 0.4, 0.45, {}),
  'black_wheel': (0x1c1d1f, 0.45, 0.5, {}),
  'lens': (0xd8e2ea, 0.02, 0.0, {'alpha': 0.08}),
  'lens_red': (0xb0101a, 0.04, 0.0, {'alpha': 0.55, 'glow': 0.25}),
  'lens_amber': (0xff9a20, 0.04, 0.0, {'alpha': 0.5}),
  'lamp': (0xf4f6ff, 0.2, 0.0, {'glow': 3.0}),
  'lamp_red': (0xff1a1a, 0.3, 0.0, {'glow': 2.2}),
  'lamp_amber': (0xff8a10, 0.3, 0.0, {'glow': 0.6}),
  'reflector': (0xc8ccd2, 0.2, 0.8, {}),
  'light_back': (0x060607, 0.55, 0.0, {}),
  'light_back_red': (0x3a0507, 0.35, 0.1, {}),
  'projector': (0x20262c, 0.02, 0.0, {}),
  'under': (0x1b1b1c, 0.8, 0.0, {}),
  'liner': (0x0c0c0d, 0.9, 0.0, {}),
  'glass': (0x30404a, 0.02, 0.0, {'alpha': 0.4}),
  'plate': (0xeceef0, 0.38, 0.0, {}),
  'plate_text': (0x14204a, 0.4, 0.0, {}),
  'mirror': (0xd0d4d8, 0.03, 1.0, {}),
  'disc': (0x5a5856, 0.42, 0.9, {}),
  'caliper': (0x1e1f21, 0.45, 0.2, {}),
  'exhaust': (0x9a9c9e, 0.3, 1.0, {}),
  'checker_black': (0x0e0e0e, 0.4, 0.0, {'coat': 1.0}),
  'checker_white': (0xf0f0ea, 0.4, 0.0, {'coat': 1.0}),
  'sign': (0xf2c230, 0.4, 0.0, {'glow': 0.4}),
  'reflector_red': (0x8a0a10, 0.15, 0.0, {}),
  'checker': (0xffffff, 0.35, 0.0, {'coat': 1.0, 'checker': True}),
  'sign_text': (0xfff0b8, 0.3, 0.0, {'glow': 2.0}),
  'drl': (0xeef2ff, 0.2, 0.0, {'glow': 1.2}),
  'led_red': (0xff2020, 0.3, 0.0, {'glow': 1.2}),
}
_looks = {}


def linear(hexcolor):
  c = [((hexcolor >> s) & 255) / 255 for s in (16, 8, 0)]
  return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def look(name, design=None):
  """A look as a Blender material (made once a file). 'paint' is the design's paint: white under
  each copy's tint (cars.mjs `tintMask: 'paint'`), clear coated."""
  if name in _looks:
    return _looks[name]
  m = bpy.data.materials.new(name)
  m.use_nodes = True
  m.use_backface_culling = False
  b = m.node_tree.nodes['Principled BSDF']
  if name == 'paint':
    p = design['paint']
    colour, rough, metal, extra = 0xffffff, p.get('rough', 0.3), p.get('metal', 0.5), {'coat': 1.0, 'coat_rough': p.get('coat_rough', 0.03)}
  else:
    colour, rough, metal, extra = LOOKS[name]
  b.inputs['Base Color'].default_value = (*linear(colour), 1)
  b.inputs['Roughness'].default_value = rough
  b.inputs['Metallic'].default_value = metal
  if 'coat' in extra:
    b.inputs['Coat Weight'].default_value = extra['coat']
    b.inputs['Coat Roughness'].default_value = extra.get('coat_rough', 0.05)
  if 'alpha' in extra:
    b.inputs['Alpha'].default_value = extra['alpha']
    m.surface_render_method = 'BLENDED'
  if 'glow' in extra:
    b.inputs['Emission Color'].default_value = (*linear(colour), 1)
    b.inputs['Emission Strength'].default_value = extra['glow']
  if extra.get('checker'):
    # Black and white squares, two by two, repeated by the faces' UVs
    img = bpy.data.images.new('checker', 64, 64, alpha=False)
    px = []
    for j in range(64):
      for i in range(64):
        c = 0.9 if (i // 32 + j // 32) % 2 else 0.012
        px += [c, c, c, 1]
    img.pixels[:] = px
    img.pack()
    t = m.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = img
    t.interpolation = 'Closest'
    m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
  _looks[name] = m
  return m


# --- The body -----------------------------------------------------------------------------------------

# Which part a region of the design is (the rest: the body), and its look (the rest: paint)
PART_OF = [
  (r'glass\.f([lr])', r'door.f\1'), (r'glass\.r([lr])', r'door.r\1'), (r'glass\.b([lr])', r'door.b\1'),
  (r'(door\.\w+|hood|trunk|bumper\.[fr]|trim\.\w+)', r'\1'),
]
LOOK_OF = {'glass': 'glass', 'pillar': 'trim', 'cowl': 'plastic', 'under': 'under', 'liner': 'liner', 'gap': 'liner', 'cladding': 'plastic', 'checker': 'checker_black'}


def part_of(region):
  for pat, to in PART_OF:
    m = re.fullmatch(pat, region)
    if m:
      return m.expand(to)
  return 'body'


def look_of(region, design):
  over = design.get('looks', {})
  if region in over:
    return over[region]
  return LOOK_OF.get(region.split('.')[0], 'paint')


class Body:
  """The body as a bmesh: each face's part and look (int layers, by the names in `parts` and `looks`)."""

  def __init__(self, design):
    self.design = design
    self.parts, self.looks = [], []
    self.bm = bmesh.new()
    self.part = self.bm.faces.layers.int.new('part')
    self.look = self.bm.faces.layers.int.new('look')

  def pid(self, name):
    if name not in self.parts:
      self.parts.append(name)
    return self.parts.index(name)

  def lid(self, name):
    if name not in self.looks:
      self.looks.append(name)
    return self.looks.index(name)

  def face(self, f, region):
    """`region`: a region of the design, or 'region/look' (its look not the region's own)."""
    region, _, own = region.partition('/')
    f[self.part] = self.pid(part_of(region))
    f[self.look] = self.lid(own or look_of(region, self.design))


def build_surface(design):
  """The body's surface, both halves welded: a Body."""
  S = Surface(design)
  G, span_u, span_v = S.loft()
  regions = design['regions']
  B = Body(design)
  bm = B.bm
  nu, nv = G.shape[0], G.shape[1]
  right = []
  verts = [[bm.verts.new(G[u, v]) for v in range(nv)] for u in range(nu)]
  for u in range(nu - 1):
    for v in range(nv - 1):
      f = bm.faces.new([verts[u][v], verts[u + 1][v], verts[u + 1][v + 1], verts[u][v + 1]])
      right.append((f, regions(span_u[u], span_v[v])))
  for end, row in (('front', G[-1]), ('rear', G[0])):
    Q = S.end_face(row, design['face'][f'{end}_centre'], end == 'front')
    cv = [[bm.verts.new(Q[c, r]) for r in range(Q.shape[1])] for c in range(Q.shape[0])]
    for c in range(Q.shape[0] - 1):
      for r in range(Q.shape[1] - 1):
        quad = [cv[c][r], cv[c + 1][r], cv[c + 1][r + 1], cv[c][r + 1]]
        f = bm.faces.new(quad if end == 'front' else quad[::-1])
        region = design['face'][f'{end}_region']
        if callable(region):
          c = sum((v.co for v in quad), Vector()) / 4
          region = region(c.x, c.z)
        right.append((f, region))
  vmap = {v: bm.verts.new((-v.co.x, v.co.y, v.co.z)) for v in list(bm.verts)}
  for f, region in right:
    # (A pair: the right's region and the left's, where the sides differ: a van's sliding door)
    rr, rl = region if isinstance(region, tuple) else (region, region)
    B.face(f, rr.replace('#', 'r'))
    g = bm.faces.new([vmap[v] for v in reversed(f.verts)])
    B.face(g, rl.replace('#', 'l'))
  # The creases' edges hard (the line each crease vertex is on, its mirror's too)
  off = np.concatenate([[0], np.cumsum(S.nv)])
  on_line = {}
  for k in design.get('creases', ()):
    for u in range(nu):
      v = verts[u][off[k]]
      on_line[v] = k
      on_line[vmap[v]] = k
  for e in bm.edges:
    a, b = e.verts
    if a in on_line and on_line.get(b) == on_line[a]:
      e.smooth = False
  bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
  bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  for f in bm.faces:
    f.smooth = True
  return B, S


def to_object(B, name='body'):
  me = bpy.data.meshes.new(name)
  B.bm.to_mesh(me)
  o = bpy.data.objects.new(name, me)
  bpy.context.collection.objects.link(o)
  return o


def from_object(B, o):
  B.bm.free()
  B.bm = bmesh.new()
  B.bm.from_mesh(o.data)
  B.part = B.bm.faces.layers.int['part']
  B.look = B.bm.faces.layers.int['look']
  bpy.data.objects.remove(o)


def prism(profile, x0, x1, name):
  """A solid: the polygon `profile` (y, z) drawn out along x from x0 to x1."""
  bm = bmesh.new()
  a = [bm.verts.new((x0, y, z)) for y, z in profile]
  b = [bm.verts.new((x1, y, z)) for y, z in profile]
  bm.faces.new(a[::-1])
  bm.faces.new(b)
  n = len(profile)
  for i in range(n):
    j = (i + 1) % n
    bm.faces.new([a[i], a[j], b[j], b[i]])
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  me = bpy.data.meshes.new(name)
  bm.to_mesh(me)
  bm.free()
  o = bpy.data.objects.new(name, me)
  bpy.context.collection.objects.link(o)
  return o


def arches(B):
  """The wheel arches: round over each wheel, open under it, as deep in as the wheel and a hand;
  their walls the liner."""
  w = B.design['wheels']
  body = to_object(B)
  liner_part, liner_look = B.pid('body'), B.lid('liner')
  for y in (w['front'], w['rear']):
    R = w['arch']
    cz = w['radius'] + w.get('arch_lift', 0.0)
    profile = [(y + R, -0.6), (y + R, cz)]
    profile += [(y + R * math.cos(a), cz + R * math.sin(a)) for a in np.linspace(0, math.pi, 49)[1:-1]]
    profile += [(y - R, cz), (y - R, -0.6)]
    x_in = w['x'] - w['width'] / 2 - 0.05
    for side in (1, -1):
      c = prism(profile, side * x_in, side * 1.8, 'arch')
      for layer, value in (('part', liner_part), ('look', liner_look)):
        a = c.data.attributes.new(layer, 'INT', 'FACE')
        for i in range(len(c.data.polygons)):
          a.data[i].value = value
      m = body.modifiers.new('cut', 'BOOLEAN')
      m.operation = 'DIFFERENCE'
      m.solver = 'EXACT'
      m.object = c
      bpy.context.view_layer.objects.active = body
      bpy.ops.object.modifier_apply(modifier='cut')
      bpy.data.objects.remove(c)
  from_object(B, body)


# --- Things set into it: lights, grilles, plates ----------------------------------------------------

VIEW_AXES = {'front': (0, 2, 1, 1), 'rear': (0, 2, 1, -1), 'side': (1, 2, 0, 1), 'top': (0, 1, 2, 1)}


def inside_poly(p, poly):
  x, y = p
  inside = False
  n = len(poly)
  for i in range(n):
    (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
    if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
      inside = not inside
  return inside


def project(B, feature, side, cut=True):
  """The faces `feature` takes, on one side (1: right, -1: left): cut along its outline (a polygon
  in its view: 'front'/'rear' (x, z), 'side' (y, z), 'top' (x, y); x mirrored on the left) where
  it falls on faces looking its way; returns them. (`cut` False: only which it takes.)"""
  bm = B.bm
  a, b, axis, sign = VIEW_AXES[feature['view']]
  mirror = (lambda p: (side * p[0], p[1])) if feature['view'] != 'side' else (lambda p: p)
  poly = [mirror(p) for p in feature['poly']]
  facing = feature.get('facing', 0.3)
  near = feature.get('near')

  # (A light, a grille or a plate takes only painted skin: not what another has sunk already)
  skin = {B.lid(n) for n in feature.get('on_looks', ('paint',))} if feature['kind'] not in ('part', 'paint') else None

  def takes(f):
    if skin is not None and f[B.look] not in skin:
      return False
    c = f.calc_center_median()
    if c.x * side < -1e-4:
      return False
    n = f.normal
    look_dir = n[axis] * sign if feature['view'] != 'side' else n.x * side
    if look_dir < facing:
      return False
    if near is not None and (c[axis] * (sign if feature['view'] != 'side' else side)) < near:
      return False
    only = feature.get('parts')
    if only and B.parts[f[B.part]] not in [o.replace('#', 'r' if side > 0 else 'l') for o in only]:
      return False
    return True

  bm.normal_update()
  candidates = [f for f in bm.faces if takes(f)]
  lo = [min(p[0] for p in poly) - 0.05, min(p[1] for p in poly) - 0.05]
  hi = [max(p[0] for p in poly) + 0.05, max(p[1] for p in poly) + 0.05]

  def box_of(f):
    xs = [v.co[a] for v in f.verts]
    ys = [v.co[b] for v in f.verts]
    return min(xs), min(ys), max(xs), max(ys)

  near_faces = [f for f in candidates if (lambda bx: bx[2] >= lo[0] and bx[0] <= hi[0] and bx[3] >= lo[1] and bx[1] <= hi[1])(box_of(f))]
  n = len(poly) if cut else 0
  for i in range(n):
    p, q = Vector(poly[i]), Vector(poly[(i + 1) % n])
    d = q - p
    if d.length < 1e-6:
      continue
    n2 = Vector((-d.y, d.x)).normalized()
    no = Vector((0, 0, 0))
    co = Vector((0, 0, 0))
    no[a], no[b] = n2.x, n2.y
    co[a], co[b] = p.x, p.y
    m = 0.03
    sl = (min(p.x, q.x) - m, min(p.y, q.y) - m, max(p.x, q.x) + m, max(p.y, q.y) + m)
    faces = [f for f in near_faces if f.is_valid and (lambda bx: bx[2] >= sl[0] and bx[0] <= sl[2] and bx[3] >= sl[1] and bx[1] <= sl[3])(box_of(f))]
    if not faces:
      continue
    edges = list({e for f in faces for e in f.edges})
    verts = list({v for f in faces for v in f.verts})
    res = bmesh.ops.bisect_plane(bm, geom=faces + edges + verts, dist=1e-6, plane_co=co, plane_no=no)
    new_faces = {f for e in res['geom'] if isinstance(e, bmesh.types.BMEdge) for f in e.link_faces}
    near_faces = [f for f in near_faces if f.is_valid] + [f for f in new_faces if f not in near_faces]
  bm.normal_update()
  out = []
  for f in near_faces:
    if not f.is_valid or not takes(f):
      continue
    c = f.calc_center_median()
    if inside_poly((c[a], c[b]), poly):
      out.append(f)
  return out


def recess(B, faces, depth, back_look, wall_look):
  """Sinks `faces` into the body by `depth` (along the surface's normal): walls round them, their
  copy at the bottom. Returns (the surface as it was: [face points], the bottom's faces)."""
  bm = B.bm
  surface = [[v.co.copy() for v in f.verts] for f in faces]
  normals = {}
  for f in faces:
    for v in f.verts:
      normals.setdefault(v, Vector())
      normals[v] += f.normal * f.calc_area()
  res = bmesh.ops.extrude_face_region(bm, geom=faces)
  new_verts = [e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)]
  new_faces = [e for e in res['geom'] if isinstance(e, bmesh.types.BMFace)]
  # (It leaves the region's own faces where they were, turned in: they go)
  bmesh.ops.delete(bm, geom=[f for f in faces if f.is_valid and f not in set(new_faces)], context='FACES_ONLY')
  # (The new verts: where each old one was, now the bottom's)
  bottom = set(new_verts)
  for f in faces:
    pass
  moved = {}
  for v in new_verts:
    # Its old twin: the one at the same place among the region's
    moved[v] = v.co.copy()
  # Normals by place (the old verts are the walls' outer ring; the new are copies at the same places)
  by_place = {tuple(round(c, 6) for c in v.co): n for v, n in normals.items() if v.is_valid}
  for v in new_verts:
    n = by_place.get(tuple(round(c, 6) for c in v.co))
    if n is None or n.length == 0:
      n = Vector((0, 0, 1))
    v.co -= n.normalized() * depth
  backs = [f for f in new_faces if all(v in bottom for v in f.verts)]
  walls = [f for f in new_faces if f not in backs]
  for f in backs:
    f[B.look] = B.lid(back_look)
  for f in walls:
    f[B.look] = B.lid(wall_look)
  # Walls drawn flat (a hard edge round the opening)
  for f in walls:
    f.smooth = False
  return surface, backs


def add_faces(B, polys, part, look_name, offset=0.0):
  """Faces (lists of points) added to the body in `part`, `look`, pushed out along their normal."""
  bm = B.bm
  out = []
  for pts in polys:
    vs = [bm.verts.new(p) for p in pts]
    try:
      f = bm.faces.new(vs)
    except ValueError:
      continue
    f.normal_update()
    if offset:
      for v in vs:
        v.co += f.normal * offset
    f[B.part] = B.pid(part)
    f[B.look] = B.lid(look_name)
    f.smooth = True
    out.append(f)
  return out


def features(B, extras):
  """The design's `features`: lights, grilles, intakes, plates sunk into the body, and what's in
  them (`extras`: objects made alongside, by part)."""
  d = B.design
  for feat in d.get('features', []):
    for side in ((1, -1) if feat.get('both', True) else (1,)):
      # Its outline in each of its views (a lamp wrapping round a corner), cut first, then taken
      views = [feat] + [{**feat, **more} for more in feat.get('also', [])]
      for v in views:
        project(B, v, side)
      faces = []
      for v in views:
        faces += [f for f in project(B, v, side, cut=False) if f not in faces]
      if not faces:
        print(f"  feature {feat['kind']} ({feat['view']}): no faces")
        continue
      if feat.get('part'):
        for f in faces:
          f[B.part] = B.pid(feat['part'].replace('#', 'r' if side > 0 else 'l'))
      part = B.parts[faces[0][B.part]]
      kind = feat['kind']
      if kind in ('paint', 'part'):
        if 'look' in feat:
          for f in faces:
            f[B.look] = B.lid(feat['look'])
        continue
      if kind == 'groove':
        # A seam drawn in: the outline's edges pressed in a little
        sel = set(faces)
        for e in {e for f in faces for e in f.edges}:
          if sum(1 for g in e.link_faces if g in sel) == 1:
            for v in e.verts:
              v.co -= v.normal * 0.0015
        continue
      depth = feat.get('depth', 0.04)
      looks = {
        'headlight': ('reflector', 'light_back', 'lens'),
        'taillight': ('light_back_red', 'light_back_red', 'lens_red'),
        'marker': ('lamp_amber', 'light_back', 'lens_amber'),
        'grille': ('plastic', 'plastic', None),
        'intake': ('plastic', 'plastic', None),
        'plate': ('plastic', 'plastic', None),
      }[kind]
      surface, backs = recess(B, faces, depth, feat.get('back', looks[0]), feat.get('wall', looks[1]))
      if looks[2]:
        add_faces(B, surface, part, looks[2], 0.0005)
      # What's in it: bands of its bottom lit, lenses, slats
      for band in feat.get('bands', []):
        for f in backs:
          c = f.calc_center_median()
          if band['test'](side * c.x if feat['view'] != 'side' else c.y, c.z):
            f[B.look] = B.lid(band['look'])
      for (u, z, r) in feat.get('lenses', []):
        at = Vector((side * u, 0, z))
        hit, normal = cast(B, at, feat['view'], with_normal=True)
        if hit:
          # Behind the lens where it is, along its own normal (a lamp wrapping round a corner looks
          # out sideways there), so neither the projector nor its ring stands out through it
          n = normal.normalized() if normal is not None and normal.dot(VIEW_DIR[feat['view']]) > 0.2 else VIEW_DIR[feat['view']]
          c = hit - n * (r + 0.006)
          extras.setdefault(part, []).append(sphere_obj(c, r, 'projector'))
          ring = lathe([(-0.004, r * 1.05), (0.0, r * 1.18), (0.004, r * 1.45)], 32)
          turn = n.to_track_quat('X', 'Z').to_matrix().to_4x4()
          extras[part].append(obj(ring, 'ring', 'chrome', B.design, 1.2))
          extras[part][-1].data.transform(Matrix.Translation(c + n * r * 0.2) @ turn)
      for slat in feat.get('slats', []):
        extras.setdefault(part, []).append(slats(B, feat, side, slat, depth, backs))


VIEW_DIR = {'front': Vector((0, 1, 0)), 'rear': Vector((0, -1, 0)), 'side': Vector((1, 0, 0)), 'top': Vector((0, 0, 1))}


def bvh(B):
  from mathutils.bvhtree import BVHTree
  return BVHTree.FromBMesh(B.bm)


def cast(B, at, view, tree=None, with_normal=False):
  """Where a ray from far out along the view's axis through `at` (its depth ignored) meets the body
  (and the surface's normal there, with `with_normal`)."""
  tree = tree or bvh(B)
  d = VIEW_DIR[view]
  o = Vector(at)
  o += d * (10 - o.dot(d))
  hit = tree.ray_cast(o, -d, 20)
  return (hit[0], hit[1]) if with_normal else hit[0]


def sphere_obj(at, r, look_name):
  bm = bmesh.new()
  bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
  for f in bm.faces:
    f.smooth = True
  me = bpy.data.meshes.new('lens')
  bm.to_mesh(me)
  bm.free()
  me.materials.append(look(look_name))
  o = bpy.data.objects.new('lens', me)
  o.location = at
  bpy.context.collection.objects.link(o)
  return o


def slats(B, feat, side, slat, depth, backs=None):
  """Bars across an opening: at height z (front/rear) a bar `thick` high, following the body's face,
  set back `back` from it."""
  tree = bvh(B)
  B.bm.faces.ensure_lookup_table()
  B.bm.faces.index_update()
  bottoms = {f.index for f in (backs or []) if f.is_valid}
  z, thick = slat['z'], slat.get('thick', 0.012)
  x0, x1 = slat['x']
  view = feat['view']
  d = VIEW_DIR[view]
  bm = bmesh.new()
  steps = max(2, int(abs(x1 - x0) / 0.03))
  rows = []
  for i in range(steps + 1):
    x = side * (x0 + (x1 - x0) * i / steps)
    o = Vector((x, 0, z))
    o += d * (10 - o.dot(d))
    hit, _, index, _ = tree.ray_cast(o, -d, 20)
    # (Only where the ray meets the opening's bottom, not its walls or the face round it)
    if hit is None or (bottoms and index not in bottoms):
      continue
    # (The ray meets the opening's bottom: its face was `depth` out from there)
    front = hit + d * (depth - slat.get('back', depth * 0.4))
    t = slat.get('deep', 0.025)
    rows.append([front + Vector((0, 0, thick / 2)), front - Vector((0, 0, thick / 2)), front - Vector((0, 0, thick / 2)) - d * t, front + Vector((0, 0, thick / 2)) - d * t])
  vs = [[bm.verts.new(p) for p in r] for r in rows]
  for i in range(len(vs) - 1):
    for j in range(4):
      bm.faces.new([vs[i][j], vs[i][(j + 1) % 4], vs[i + 1][(j + 1) % 4], vs[i + 1][j]])
  if vs:
    bm.faces.new(vs[0])
    bm.faces.new(vs[-1][::-1])
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  me = bpy.data.meshes.new('slat')
  bm.to_mesh(me)
  bm.free()
  me.materials.append(look(slat.get('look', 'trim')))
  o = bpy.data.objects.new('slat', me)
  bpy.context.collection.objects.link(o)
  return o


# --- Glass, seams, parts ----------------------------------------------------------------------------


def glazing(B):
  """Each pane set into its opening: a black band round it (its seal, the frit), the glass a few
  millimetres in."""
  bm = B.bm
  g = B.lid('glass')
  frame = B.design.get('glass_frame', 0.018)
  glass = [f for f in bm.faces if f[B.look] == g]
  # Pane by pane (each its own island of glass faces within one part)
  seen = set()
  for f in glass:
    if f in seen:
      continue
    island, todo = [], [f]
    seen.add(f)
    while todo:
      h = todo.pop()
      island.append(h)
      for e in h.edges:
        for k in e.link_faces:
          if k not in seen and k[B.look] == g and k[B.part] == f[B.part]:
            seen.add(k)
            todo.append(k)
    res = bmesh.ops.inset_region(bm, faces=island, thickness=frame, depth=0.0, use_even_offset=True)
    for k in res['faces']:
      k[B.look] = B.lid('trim')
    for v in {v for h in island for v in h.verts}:
      v.co -= v.normal * 0.007


def seams(B):
  """Where two parts meet: each pulled back from the seam (a gap), its edge turned in (a lip)."""
  bm = B.bm
  gap = B.design.get('gap', 0.0028)
  lip = B.design.get('lip', 0.018)
  gid = B.parts.index('gap') if 'gap' in B.parts else -1
  seam = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0][B.part] != e.link_faces[1][B.part]]
  bmesh.ops.split_edges(bm, edges=seam)
  bm.normal_update()
  # The gap's own faces go (the gap's other side is just the seam)
  if gid >= 0:
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[B.part] == gid], context='FACES')
  edges = [e for e in bm.edges if e.is_boundary]
  verts = {v for e in edges for v in e.verts}
  moves = {}
  for v in verts:
    bes = [e for e in v.link_edges if e.is_boundary]
    if len(bes) != 2 or not v.link_faces:
      continue
    t = (bes[0].other_vert(v).co - bes[1].other_vert(v).co)
    if t.length < 1e-9:
      continue
    t.normalize()
    n = v.normal
    inward = sum((f.calc_center_median() - v.co for f in v.link_faces), Vector())
    inward -= n * inward.dot(n) + t * inward.dot(t)
    if inward.length < 1e-9:
      continue
    moves[v] = (inward.normalized(), n.copy())
  for v, (inward, n) in moves.items():
    v.co += inward * gap
  # The lips: each seam's edge turned in under the panel
  res = bmesh.ops.extrude_edge_only(bm, edges=edges)
  new_verts = [e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)]
  for v in new_verts:
    old = next((e.other_vert(v) for e in v.link_edges if e.other_vert(v) in moves), None)
    if old is None:
      continue
    inward, n = moves[old]
    v.co = old.co - n * lip + inward * 0.003
  for f in {f for v in new_verts for f in v.link_faces}:
    f.smooth = False


def flatten(B, looks=('under', 'liner'), angle=0.09):
  """Faces of `looks` that are near enough flat merged (under the car nobody looks closely)."""
  ids = {B.lid(n) for n in looks}
  faces = [f for f in B.bm.faces if f[B.look] in ids]
  verts = {v for f in faces for v in f.verts if all(g[B.look] in ids for g in v.link_faces)}
  edges = {e for f in faces for e in f.edges if all(g[B.look] in ids for g in e.link_faces) and len(e.link_faces) == 2 and e.link_faces[0][B.part] == e.link_faces[1][B.part]}
  bmesh.ops.dissolve_limit(B.bm, angle_limit=angle, verts=list(verts), edges=list(edges))


def uv_faces(me, design):
  """UVs where a look has a map: the checker stripe's squares run along the car."""
  textured = [i for i, m in enumerate(me.materials) if m and m.name == 'checker']
  if not textured:
    return
  ck = design.get('checker', {'z0': 0.8, 'square': 0.02})
  layer = me.uv_layers.new(name='UVMap')
  for p in me.polygons:
    if p.material_index not in textured:
      continue
    for li in p.loop_indices:
      co = me.vertices[me.loops[li].vertex_index].co
      layer.data[li].uv = (co.y / (2 * ck['square']), (co.z - ck['z0']) / (2 * ck['square']))


def separate(B):
  """The body's parts as objects, each with its looks as materials, named for process-cars.py."""
  objs = {}
  bm = B.bm
  for pi, name in enumerate(B.parts):
    if name == 'gap':
      continue
    sub = bm.copy()
    pl = sub.faces.layers.int['part']
    bmesh.ops.delete(sub, geom=[f for f in sub.faces if f[pl] != pi], context='FACES')
    bmesh.ops.delete(sub, geom=[e for e in sub.edges if not e.link_faces], context='EDGES')
    bmesh.ops.delete(sub, geom=[v for v in sub.verts if not v.link_faces], context='VERTS')
    if not sub.faces:
      sub.free()
      continue
    ll = sub.faces.layers.int['look']
    used = sorted({f[ll] for f in sub.faces})
    for f in sub.faces:
      f.material_index = used.index(f[ll])
    me = bpy.data.meshes.new(name)
    sub.to_mesh(me)
    sub.free()
    for li in used:
      me.materials.append(look(B.looks[li], B.design))
    uv_faces(me, B.design)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    objs[name] = o
  return objs


# --- Wheels -------------------------------------------------------------------------------------------


def lathe(profile, segments=72, closed=True):
  """`profile` [(x, r)] turned about the x axis: a bmesh."""
  bm = bmesh.new()
  rings = []
  for j in range(segments):
    a = 2 * math.pi * j / segments
    rings.append([bm.verts.new((x, r * math.cos(a), r * math.sin(a))) for x, r in profile])
  for j in range(segments if closed else segments - 1):
    r0, r1 = rings[j], rings[(j + 1) % segments]
    for i in range(len(profile) - 1):
      bm.faces.new([r0[i], r0[i + 1], r1[i + 1], r1[i]])
  return bm


def sharpen(bm, angle=0.6):
  """Smooth shaded, but hard where faces meet at more than `angle`."""
  bm.normal_update()
  for f in bm.faces:
    f.smooth = True
  for e in bm.edges:
    if len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0) > angle:
      e.smooth = False


class Mesh:
  """Pieces with a look each, gathered into one object."""

  def __init__(self, name):
    self.name = name
    self.bm = bmesh.new()
    self.names = []

  def add(self, bm, look_name, matrix=Matrix.Identity(4), angle=0.6):
    sharpen(bm, angle)
    if look_name not in self.names:
      self.names.append(look_name)
    mi = self.names.index(look_name)
    bm.transform(matrix)
    tmp = bpy.data.meshes.new('tmp')
    bm.to_mesh(tmp)
    for p in tmp.polygons:
      p.material_index = mi
    self.bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    bm.free()
    return self

  def object(self, design=None):
    me = bpy.data.meshes.new(self.name)
    self.bm.to_mesh(me)
    self.bm.free()
    for n in self.names:
      me.materials.append(look(n, design))
    o = bpy.data.objects.new(self.name, me)
    bpy.context.collection.objects.link(o)
    return o


def tyre(R, rim, W):
  """A tyre about the x axis: its sidewalls bulging, its shoulders round, four grooves round its tread."""
  w = W / 2
  side = rim + (R - rim) * 0.45
  prof = [(-w * 0.86, rim + 0.004), (-w * 0.96, rim + 0.022), (-w, side), (-w * 0.98, R - 0.032), (-w * 0.92, R - 0.012), (-w * 0.8, R - 0.003)]
  tread = []
  for gx in (-0.42, 0.42):
    x = gx * w
    tread += [(x - 0.007, R - 0.001), (x - 0.005, R - 0.011), (x + 0.005, R - 0.011), (x + 0.007, R - 0.001)]
  prof += tread + [(w * 0.8, R - 0.003), (w * 0.92, R - 0.012), (w * 0.98, R - 0.032), (w, side), (w * 0.96, rim + 0.022), (w * 0.86, rim + 0.004)]
  return lathe(prof, 64)


def disc(r0, r1, x, segments=48):
  return lathe([(x, r0), (x, r1)], segments)


def alloy_rim(rim, W, spokes=5, style='five'):
  """A cast wheel: its barrel, its lip, its spokes dished in to the hub, the nuts and a cap."""
  out = []
  w = W / 2
  face = w * 0.72
  # Barrel (seen between the spokes) and lip
  out.append((lathe([(-w * 0.8, rim - 0.012), (face - 0.02, rim - 0.012), (face - 0.01, rim - 0.02)], 64), 'alloy_dark'))
  out.append((lathe([(face - 0.012, rim - 0.024), (face + 0.006, rim - 0.016), (face + 0.012, rim + 0.002), (face + 0.008, rim + 0.014), (w * 0.86, rim + 0.016)], 64), 'alloy'))
  hub_r = 0.075
  hub_x = face - 0.038
  # Spokes: each a strip from the hub out to the lip, its face dished (in pairs: two close together)
  angles = [2 * math.pi * s / spokes for s in range(spokes)]
  if style == 'double':
    angles = [a + d for a in angles for d in (-0.1, 0.1)]
  for a0 in angles:
    bm = bmesh.new()
    rows = []
    n = 8
    for i in range(n + 1):
      t = i / n
      r = hub_r + (rim - 0.02 - hub_r) * t
      half = {'five': 0.022 + 0.018 * t, 'double': 0.0105 + 0.006 * t}.get(style, 0.012 + 0.01 * t)
      x = hub_x + (face - hub_x) * (1 - (1 - t) ** 2)
      row = []
      for u in (-1, -0.45, 0.45, 1):
        ang = a0 + u * half / r
        dx = -0.006 * (1 - abs(u))  # a soft ridge down its middle
        row.append((x - dx, r * math.cos(ang), r * math.sin(ang)))
      rows.append(row)
    front = [[bm.verts.new(p) for p in row] for row in rows]
    back = [[bm.verts.new((p[0] - 0.03, p[1], p[2])) for p in row] for row in rows]
    for i in range(n):
      for j in range(3):
        bm.faces.new([front[i][j], front[i][j + 1], front[i + 1][j + 1], front[i + 1][j]])
    out.append((bm, 'alloy'))
    # Its sides, darker (machined faces over painted sides)
    sides = bmesh.new()
    fs = [[sides.verts.new(v.co) for v in row] for row in front]
    bs = [[sides.verts.new(v.co) for v in row] for row in back]
    for i in range(n):
      sides.faces.new([fs[i][0], fs[i + 1][0], bs[i + 1][0], bs[i][0]])
      sides.faces.new([fs[i][3], bs[i][3], bs[i + 1][3], fs[i + 1][3]])
    out.append((sides, 'alloy_dark'))
  # Hub: a dished disc, the nuts, the cap
  out.append((lathe([(hub_x - 0.03, hub_r + 0.005), (hub_x, hub_r + 0.004), (hub_x + 0.004, hub_r - 0.01), (hub_x + 0.006, 0.04)], 48), 'alloy'))
  out.append((lathe([(hub_x + 0.006, 0.0405), (hub_x + 0.014, 0.036), (hub_x + 0.018, 0.02), (hub_x + 0.019, 0.001)], 32), 'alloy_dark'))
  for s in range(5):
    a = 2 * math.pi * (s + 0.5) / 5
    nut = lathe([(0.0, 0.0105), (0.013, 0.0105), (0.017, 0.007), (0.018, 0.001)], 6)
    out.append((nut, 'chrome', Matrix.Translation((hub_x - 0.004, 0.055 * math.cos(a), 0.055 * math.sin(a)))))
  return out


def steel_rim(rim, W, holes=10, cap='chrome', paint='steel_wheel'):
  """A pressed steel wheel: its dished face with a ring of holes round it, under a cap."""
  out = []
  w = W / 2
  face = w * 0.55
  out.append((lathe([(-w * 0.8, rim - 0.012), (face - 0.02, rim - 0.012)], 64), paint))
  out.append((lathe([(face - 0.03, rim - 0.03), (face - 0.004, rim - 0.018), (face + 0.004, rim + 0.002), (face, rim + 0.013), (w * 0.86, rim + 0.015)], 64), paint))
  # The face: hub flat, a step down, the ring of holes, up to the rim
  ring_r = rim * 0.66
  prof = [(face - 0.035, 0.03), (face - 0.03, 0.085), (face - 0.045, 0.1), (face - 0.05, ring_r - 0.03), (face - 0.05, ring_r + 0.03), (face - 0.04, rim * 0.86), (face - 0.032, rim - 0.03)]
  bm = lathe(prof, 80)
  # The holes: faces round each hole's place taken out (a ring of them)
  centres = [(ring_r * math.cos(2 * math.pi * k / holes), ring_r * math.sin(2 * math.pi * k / holes)) for k in range(holes)]
  hole_r = min(0.022, ring_r * math.pi / holes * 0.5)
  dead = [f for f in bm.faces if any(math.hypot(f.calc_center_median().y - cy, f.calc_center_median().z - cz) < hole_r for cy, cz in centres)]
  bmesh.ops.delete(bm, geom=dead, context='FACES')
  out.append((bm, paint))
  # Nuts and the cap
  for k in range(5):
    a = 2 * math.pi * k / 5
    nut = lathe([(0.0, 0.0105), (0.012, 0.0105), (0.016, 0.007), (0.017, 0.001)], 6)
    out.append((nut, 'chrome', Matrix.Translation((face - 0.035, 0.058 * math.cos(a), 0.058 * math.sin(a)))))
  if cap == 'chrome':
    out.append((lathe([(face - 0.03, rim * 0.62), (face - 0.01, rim * 0.6), (face + 0.004, rim * 0.48), (face + 0.012, rim * 0.25), (face + 0.014, 0.001)], 48), 'chrome'))
  else:
    out.append((lathe([(face - 0.03, 0.075), (face - 0.012, 0.072), (face - 0.004, 0.05), (face - 0.002, 0.001)], 32), cap))
  return out


def wheel(design, corner):
  """A wheel ('fl', 'fr', 'rl', 'rr'): tyre and rim, at its place, its outside facing out."""
  w = design['wheels']
  R, rim, W = w['radius'], w['rim'], w['width']
  parts = [(tyre(R, rim, W), 'tyre')]
  style = w.get('style', 'five')
  if style in ('five', 'ten', 'double'):
    parts += alloy_rim(rim, W, 10 if style == 'ten' else 5, style)
  else:
    parts += steel_rim(rim, W, w.get('holes', 10), w.get('cap', 'chrome'), w.get('paint', 'steel_wheel'))
  side = 1 if corner[1] == 'r' else -1
  y = w['front'] if corner[0] == 'f' else w['rear']
  at = Matrix.Translation((side * w['x'], y, R)) @ Matrix.Scale(side, 4, Vector((1, 0, 0)))
  m = Mesh(f'wheel.{corner}')
  for p in parts:
    bm, look_name = p[0], p[1]
    local = p[2] if len(p) > 2 else Matrix.Identity(4)
    m.add(bm, look_name, at @ local)
  o = m.object()
  if side < 0:
    # (Mirrored: its faces turned back out)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
  return o


def brakes(design):
  """A disc and a caliper behind each wheel (the body's: they stay when it goes)."""
  w = design['wheels']
  m = Mesh('brakes')
  for y in (w['front'], w['rear']):
    for side in (1, -1):
      r = w['rim'] * 0.78
      at = Matrix.Translation((side * (w['x'] - 0.03), y, w['radius'])) @ Matrix.Scale(side, 4, Vector((1, 0, 0)))
      m.add(lathe([(-0.012, r * 0.42), (-0.012, r), (0.012, r), (0.012, r * 0.42)], 48), 'disc', at)
      m.add(lathe([(-0.03, 0.06), (0.03, 0.06)], 24), 'disc', at)
      cal = bmesh.new()
      bmesh.ops.create_cube(cal, size=1)
      bmesh.ops.scale(cal, vec=(0.06, 0.07, r * 0.7), verts=cal.verts)
      # (Round the disc's edge: behind the axle and up, the front's ahead of it)
      ang = 0.35 * math.pi if y > 0 else 0.65 * math.pi
      place = Matrix.Translation((0.012, r * 0.88 * math.cos(ang), r * 0.88 * math.sin(ang))) @ Matrix.Rotation(ang, 4, 'X')
      m.add(cal, 'caliper', at @ place)
  return m.object()


# --- Details ------------------------------------------------------------------------------------------


def join_into(target, others):
  """`others` joined into `target` (their materials with them; empty ones dropped)."""
  keep = []
  for o in others:
    if o is None:
      continue
    if o.data.polygons:
      keep.append(o)
    else:
      bpy.data.objects.remove(o)
  others = keep
  if not others:
    return target
  bpy.ops.object.select_all(action='DESELECT')
  for o in [target, *others]:
    o.select_set(True)
  bpy.context.view_layer.objects.active = target
  bpy.ops.object.join()
  return target


def obj(bm, name, look_name, design=None, angle=0.6):
  return Mesh(name).add(bm, look_name, angle=angle).object(design)


def ellipsoid(size, segments=(20, 12)):
  bm = bmesh.new()
  bmesh.ops.create_uvsphere(bm, u_segments=segments[0], v_segments=segments[1], radius=1)
  bmesh.ops.scale(bm, vec=size, verts=bm.verts)
  return bm


def rounded_box(size, round_=0.3, segments=3):
  """A box `size` across with its edges rounded (by `round_` of its smallest side)."""
  bm = bmesh.new()
  bmesh.ops.create_cube(bm, size=1)
  bmesh.ops.scale(bm, vec=size, verts=bm.verts)
  bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=min(size) * round_, segments=segments, affect='EDGES', profile=0.5)
  return bm


def surface_at(tree, at, view):
  """Where a ray along the view's axis through `at` meets the body, and its normal there (from the
  side: the side `at` is on)."""
  d = VIEW_DIR[view].copy()
  if view == 'side' and at[0] < 0:
    d = -d
  o = Vector(at)
  o += d * (10 - o.dot(d))
  hit = tree.ray_cast(o, -d, 20)
  return (hit[0], hit[1]) if hit[0] else (None, None)


def mirrors(design, tree):
  """The door mirrors: a housing on a stalk off each front door's front top corner, its glass facing back."""
  m = design.get('mirror')
  if not m:
    return {}
  out = {}
  for side, s in (('r', 1), ('l', -1)):
    mesh = Mesh('mirror')
    sx, sy, sz = m['size']
    at = Vector((s * m['at'][0], m['at'][1], m['at'][2]))
    housing = rounded_box((sx, sy, sz), m.get('round', 0.35))
    # Its back flat, for the glass
    for v in housing.verts:
      v.co.y = max(v.co.y, -sy * 0.18)
    mesh.add(housing, m.get('look', 'paint'), Matrix.Translation(at), angle=1.2)
    glass = ellipsoid((sx / 2 * 0.86, 0.004, sz / 2 * 0.8), (20, 8))
    mesh.add(glass, 'mirror', Matrix.Translation(at + Vector((0, -sy * 0.18 - 0.002, 0))), angle=1.2)
    # The stalk: from the door's skin out to the housing
    base, _ = surface_at(tree, (s * 0.5, m['at'][1] + 0.02, m['at'][2] - sz * 0.25), 'side')
    if base is None:
      base = at - Vector((s * sx * 0.6, 0, 0))
    stalk = bmesh.new()
    bmesh.ops.create_cube(stalk, size=1)
    length = abs(at.x - base.x)
    bmesh.ops.scale(stalk, vec=(length + 0.02, 0.05, 0.035), verts=stalk.verts)
    mesh.add(stalk, m.get('stalk', 'plastic'), Matrix.Translation(((at.x + base.x) / 2 - s * 0.01, base.y, base.z + 0.01)))
    out[f'door.f{side}'] = mesh.object(design)
  return out


def handles(design, tree):
  """A pull handle on each door, standing just off its skin."""
  out = {}
  for h in design.get('handles', []):
    for side, s in (('r', 1), ('l', -1)):
      if h.get('side', side) != side:
        continue
      hit, n = surface_at(tree, (s * 0.5, h['y'], h['z']), 'side')
      if hit is None:
        continue
      length = h.get('length', 0.16)
      bm = ellipsoid((0.016, length / 2, 0.016), (16, 10))
      # Its outer face flatter, a grip under it
      for v in bm.verts:
        v.co.x = min(v.co.x, 0.009)
      mesh = Mesh('handle')
      mesh.add(bm, h.get('look', 'paint'), Matrix.Translation(hit + Vector((s * 0.008, 0, 0))) @ Matrix.Scale(s, 4, Vector((1, 0, 0))), angle=1.2)
      dish = ellipsoid((0.004, length * 0.42, 0.028), (16, 8))
      mesh.add(dish, 'trim', Matrix.Translation(hit - Vector((s * 0.002, 0, 0.004))), angle=1.2)
      out.setdefault(h['part'].replace('#', side), []).append(mesh.object(design))
  return out


def text_mesh(text, size, depth=0.0015):
  """`text` in Blender's own font as a mesh (in the x-y plane, about the origin)."""
  cu = bpy.data.curves.new('text', 'FONT')
  cu.body = text
  cu.size = size
  cu.extrude = depth
  cu.align_x = 'CENTER'
  cu.align_y = 'CENTER'
  o = bpy.data.objects.new('text', cu)
  bpy.context.collection.objects.link(o)
  dg = bpy.context.evaluated_depsgraph_get()
  me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
  bpy.data.objects.remove(o)
  bm = bmesh.new()
  bm.from_mesh(me)
  bpy.data.meshes.remove(me)
  return bm


def plates(design, tree):
  """The number plates: a white plate in each one's recess, its characters standing out a little."""
  out = {}
  for p in design.get('plates', []):
    view = p['view']
    hit, n = surface_at(tree, (0, 0, p['z']), view)
    if hit is None:
      continue
    w, h = p.get('size', (0.305, 0.152))
    d = VIEW_DIR[view]
    mesh = Mesh('plate')
    plate = bmesh.new()
    bmesh.ops.create_cube(plate, size=1)
    bmesh.ops.scale(plate, vec=(w, 0.006, h), verts=plate.verts)
    # (Read from in front of it: the front plate's text runs along -x)
    face = Matrix.Rotation(math.pi if view == 'front' else 0, 4, 'Z')
    at = hit + d * p.get('out', -0.004)
    mesh.add(plate, 'plate', Matrix.Translation(at) @ face, angle=0.5)
    txt = text_mesh(p.get('text', 'BRK 4107'), h * 0.5)
    # (The text lies in x-y: stood up to face out)
    stand = Matrix.Rotation(math.pi / 2, 4, 'X')
    mesh.add(txt, 'plate_text', Matrix.Translation(at + d * 0.0035) @ face @ stand, angle=1.0)
    out.setdefault(p['part'], []).append(mesh.object(design))
  return out


def wipers(design):
  out = []
  for wp in design.get('wipers', []):
    a, b = Vector(wp['from']), Vector(wp['to'])
    mesh = Mesh('wiper')
    arm = bmesh.new()
    bmesh.ops.create_cube(arm, size=1)
    d = b - a
    bmesh.ops.scale(arm, vec=(0.012, d.length, 0.008), verts=arm.verts)
    rot = d.to_track_quat('Y', 'Z').to_matrix().to_4x4()
    mesh.add(arm, 'plastic', Matrix.Translation((a + b) / 2) @ rot)
    blade = bmesh.new()
    bmesh.ops.create_cube(blade, size=1)
    bmesh.ops.scale(blade, vec=(0.008, d.length * 0.95, 0.014), verts=blade.verts)
    mesh.add(blade, 'rubber', Matrix.Translation((a + b) / 2 + Vector((0, -0.012, 0.004))) @ rot)
    out.append(mesh.object(design))
  return out


def small_things(design, tree):
  """The antenna fin, the exhaust tips."""
  out = []
  fin = design.get('fin')
  if fin:
    hit, n = surface_at(tree, (0, fin['y'], 3), 'top')
    if hit is not None:
      bm = ellipsoid((0.03, 0.09, 0.05), (16, 10))
      for v in bm.verts:
        v.co.z = max(v.co.z, 0)
        v.co.z *= 1 + v.co.y * 4  # higher at the back
      out.append(obj(bm, 'fin', fin.get('look', 'trim'), design, 1.2))
      out[-1].location = hit
      out[-1].data.transform(Matrix.Translation(hit))
      out[-1].location = (0, 0, 0)
  for ex in design.get('exhausts', []):
    for s in ((1, -1) if ex.get('both') else (1,)):
      at = Vector((s * ex['at'][0], ex['at'][1], ex['at'][2]))
      bm = lathe([(-0.18, ex['r']), (0.0, ex['r']), (0.0, ex['r'] - 0.004), (-0.05, ex['r'] - 0.004)], 24)
      o = obj(bm, 'exhaust', 'exhaust', design)
      o.data.transform(Matrix.Translation(at) @ Matrix.Rotation(-math.pi / 2, 4, 'Z'))
      out.append(o)
  return out


# --- The car ------------------------------------------------------------------------------------------


def model(name):
  design = car_designs.DESIGNS[name]()
  _looks.clear()
  B, S = build_surface(design)
  arches(B)
  extras = {}
  features(B, extras)
  glazing(B)
  seams(B)
  flatten(B)
  tree = bvh(B)
  objs = separate(B)
  for part, lst in extras.items():
    join_into(objs[part], lst)
  for part, o in mirrors(design, tree).items():
    join_into(objs[part], [o])
  for part, lst in handles(design, tree).items():
    join_into(objs[part], lst)
  for part, lst in plates(design, tree).items():
    join_into(objs[part], lst)
  join_into(objs['body'], wipers(design) + small_things(design, tree) + [brakes(design)])
  for c in ('fl', 'fr', 'rl', 'rr'):
    objs[f'wheel.{c}'] = wheel(design, c)
  for extra in design.get('extras', []):
    for part, o in extra(design, tree, look).items():
      if part in objs:
        join_into(objs[part], [o])
      else:
        o.name = part
        objs[part] = o
  body = objs['body']
  for n, o in objs.items():
    o.name = n
    o.data.name = n
    if o is not body:
      o.parent = body
  print(f'{name}: ' + ', '.join(f'{n} {sum(len(p.vertices) - 2 for p in o.data.polygons)}' for n, o in sorted(objs.items())))
  return design, objs


def main():
  for name in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    design, objs = model(name)
    out = RAW / name / 'source' / f'{name}.blend'
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
    if VIEWS:
      views(name, RAW / name / 'views')


# --- Looking at it ------------------------------------------------------------------------------------


def clay(name, color, rough=0.35, metal=0.0, coat=0.0):
  m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
  m.use_nodes = True
  b = m.node_tree.nodes['Principled BSDF']
  b.inputs['Base Color'].default_value = (*color, 1)
  b.inputs['Roughness'].default_value = rough
  b.inputs['Metallic'].default_value = metal
  b.inputs['Coat Weight'].default_value = coat
  return m


def views(name, out, tint=None):
  """Renders from the reference pictures' sides (a long lens, as they were taken), in a studio."""
  out.mkdir(parents=True, exist_ok=True)
  scene = bpy.context.scene
  scene.render.engine = 'BLENDER_EEVEE_NEXT'
  scene.view_settings.view_transform = 'AgX'
  scene.render.resolution_x, scene.render.resolution_y = 1536, 1024
  scene.render.film_transparent = False
  # The paint as a copy would wear it
  paint = bpy.data.materials.get('paint')
  if paint:
    c = tint or car_designs.DESIGNS[name]().get('tint', 0x9aa0a6)
    paint.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*linear(c), 1)
  world = bpy.data.worlds.new('studio')
  world.use_nodes = True
  world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.63, 0.66, 1)
  world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
  scene.world = world
  bpy.ops.mesh.primitive_plane_add(size=80)
  floor = bpy.context.active_object
  floor.data.materials.append(clay('floor', (0.42, 0.42, 0.44), 0.7))
  for label, at, size, energy in (('top', (0, 0, 7), 7, 2500), ('left', (-6, 2, 3.5), 4, 900), ('right', (6, -2, 3.5), 4, 700), ('front', (1, 8, 2.5), 4, 500)):
    light = bpy.data.objects.new(label, bpy.data.lights.new(label, 'AREA'))
    light.data.energy = energy
    light.data.size = size
    light.location = at
    light.rotation_euler = (Vector((0, 0, 0.5)) - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(light)
  cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
  scene.collection.objects.link(cam)
  scene.camera = cam
  shots = {
    'side': ((-14, 0, 0.75), (0, 0, 0.7), 85),
    '34': ((-6.0, 7.4, 1.5), (0, 0.2, 0.6), 50),
    'rear34': ((5.6, -7.4, 1.6), (0, -0.2, 0.7), 50),
    'front': ((0, 12, 0.8), (0, 0, 0.7), 85),
    'close': ((-2.6, 4.2, 1.0), (-0.5, 2.0, 0.6), 50),
    'wheel': ((-2.6, 2.2, 0.5), (-0.8, 1.5, 0.35), 50),
  }
  for shot, (eye, at, lens) in shots.items():
    cam.location = Vector(eye)
    cam.rotation_euler = (Vector(at) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    scene.render.filepath = str(out / f'{name}_{shot}.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
  main()
