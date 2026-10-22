"""The cars car_model.py models: each a function returning its design.

Blender's frame, metres: x to the car's right, y forward, z up; the car stands on z = 0, its middle
at x = y = 0. Only its right half (x >= 0) is drawn up; the left is its mirror.

A design:
- `lines`: the lines along the body, from the bottom's middle (x = 0) round the side and over the
  top to the top's middle (x = 0); each a list of points (y, x, z) it runs through, its ends
  where it meets the end faces. Lines 0-5 under it (5 the sill's seam), then up the side to the
  belt, the glass and the roof.
- `stations`: across the body, rear to front: 'rear', 'front' (the lines' ends), a y, or a y per
  line (k -> y): seams that lean.
- `regions(span, line_span)`: which region a cell between two stations and two lines is in. '#' in
  a name is the side (r on the right, l on its mirror).
- `face`: the end faces: which lines make their `bottom` and `top` edges (the same number of each;
  the lines between them their corner), their middles (`front_centre`, `rear_centre`: points on
  x = 0 between the bottom's middle and the top's), and their regions.
"""

import math


def span_at(poly, z):
  """The x (or y) range a polygon covers at height z."""
  xs = []
  n = len(poly)
  for i in range(n):
    (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % n]
    if (z1 <= z < z2) or (z2 <= z < z1):
      xs.append(x1 + (x2 - x1) * (z - z1) / (z2 - z1))
  return (min(xs), max(xs)) if len(xs) >= 2 else None


def top_of(poly):
  """u -> the polygon's highest z at u."""
  def f(u):
    zs = []
    n = len(poly)
    for i in range(n):
      (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % n]
      if min(x1, x2) <= u <= max(x1, x2) and x1 != x2:
        zs.append(z1 + (z2 - z1) * (u - x1) / (x2 - x1))
    return max(zs) if zs else -1
  return f


def mid_of(poly):
  """u -> halfway between the polygon's lowest and highest z at u."""
  def f(u):
    zs = []
    n = len(poly)
    for i in range(n):
      (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % n]
      if min(x1, x2) <= u <= max(x1, x2) and x1 != x2:
        zs.append(z1 + (z2 - z1) * (u - x1) / (x2 - x1))
    return (max(zs) + min(zs)) / 2 if zs else -1
  return f


def slats(poly, z0, z1, step, **o):
  """Bars across an opening from z0 up to z1, `step` apart, each as wide as the opening there."""
  out = []
  z = z0
  while z <= z1 + 1e-6:
    sp = span_at(poly, z)
    if sp:
      out.append({'z': z, 'x': (sp[0] + o.get('inset', 0.005), sp[1] - o.get('inset', 0.005)), **{k: v for k, v in o.items() if k != 'inset'}})
    z += step
  return out


def per(lines, values):
  """A station's y per line from a few: {line: y}, the lines between taking the last given."""
  out = []
  last = None
  for k in range(len(lines)):
    if k in values:
      last = values[k]
    out.append(last)
  return out


def three_box_regions(belt_chrome=False):
  """The regions of a three-box car's cells, its stations laid out as the sedan's: 0-2 the rear's
  corner, 3 to the deck, 4 deck-C, 5 C-roof's end, 6-7 the roof, 8 the B-pillar, 9 the front
  door's glass to the header, 10-11 the windscreen, 12 the cowl, 13 the hood and fender, 14-16 the
  front's corner; its lines: 0-3 under it, 4 the sill, 5-8 the side to the belt, 9 the glass's
  foot, 10 its top, 11 the roof's edge, 12-14 across the top."""
  def regions(s, k):
    # Station spans: 0-2 the rear's corner, 3 to the deck, 4 deck-C, 5 C-roof's end, 6-7 the roof,
    # 8 the B-pillar, 9 the front door's glass to the header, 10-11 the windscreen, 12 the cowl,
    # 13 the hood and fender, 14-16 the front's corner
    if k <= 3:
      return 'under'
    if k == 4:
      return 'body'
    top = k >= 11
    if s <= 2:
      if top or k >= 9:
        return 'trunk'
      return 'bumper.r' if k <= 6 else 'body'
    if s == 3:
      return 'trunk' if k >= 9 else 'body'
    if s == 4:
      return 'glass.rear' if top else 'body'
    if s in (5, 6, 7):
      if top:
        return 'glass.rear' if s == 5 else 'roof'
      if k == 10:
        return 'body'
      if k == 9:
        return 'glass.r#' if s >= 5 else 'body'
      return 'door.r#/satin_chrome' if k == 8 and belt_chrome else 'door.r#'
    if s == 8:
      if top or k == 10:
        return 'roof'
      if k == 9:
        return 'pillar'
      return 'gap'
    if s in (9, 10, 11):
      if top:
        return 'roof' if s == 9 else 'glass.windscreen'
      if k == 10:
        return 'roof' if s == 9 else 'body'
      if k == 9:
        return 'glass.f#'
      return 'door.f#/satin_chrome' if k == 8 and s == 9 and belt_chrome else 'door.f#'
    if s == 12:
      return 'cowl' if k >= 11 else 'body'
    if s == 13:
      return 'hood' if k >= 9 else 'body'
    # The front's corner
    if k >= 9:
      return 'hood'
    return 'bumper.f' if k <= 6 else 'body'


  return regions


def sedan():
  # Lines: (y, x, z), the front end last
  under_z = 0.165
  lines = [
    # 0-3: under it
    [(-2.36, 0.0, 0.28), (-2.15, 0.0, 0.21), (-1.9, 0.0, under_z), (1.9, 0.0, under_z), (2.15, 0.0, 0.19), (2.345, 0.0, 0.235)],
    [(-2.355, 0.16, 0.281), (-2.15, 0.2, 0.211), (-1.9, 0.3, under_z), (1.9, 0.3, under_z), (2.15, 0.2, 0.19), (2.342, 0.17, 0.236)],
    [(-2.345, 0.32, 0.283), (-2.15, 0.45, 0.213), (-1.9, 0.58, under_z), (1.9, 0.58, under_z), (2.15, 0.46, 0.192), (2.335, 0.34, 0.238)],
    [(-2.33, 0.46, 0.287), (-2.15, 0.66, 0.22), (-1.9, 0.8, 0.17), (1.9, 0.8, 0.17), (2.15, 0.68, 0.198), (2.325, 0.5, 0.242)],
    # 4: the sill's foot; 5: the sill's top, the doors' bottom seam
    [(-2.31, 0.58, 0.293), (-2.12, 0.8, 0.235), (-1.9, 0.882, 0.195), (1.9, 0.882, 0.195), (2.1, 0.82, 0.215), (2.3, 0.64, 0.248)],
    [(-2.28, 0.7, 0.31), (-2.2, 0.82, 0.3), (-2.1, 0.88, 0.29), (-1.85, 0.905, 0.27), (-0.5, 0.91, 0.255), (1.85, 0.905, 0.26), (2.1, 0.89, 0.265), (2.22, 0.85, 0.265), (2.27, 0.76, 0.26)],
    # 6: the side at its widest
    [(-2.43, 0.73, 0.56), (-2.37, 0.85, 0.56), (-2.25, 0.91, 0.555), (-1.95, 0.925, 0.55), (0.0, 0.928, 0.53), (1.95, 0.922, 0.5), (2.22, 0.91, 0.49), (2.33, 0.87, 0.475), (2.39, 0.78, 0.46)],
    # 7: the shoulder's crease
    [(-2.415, 0.71, 0.85), (-2.36, 0.83, 0.855), (-2.22, 0.89, 0.86), (-1.94, 0.905, 0.86), (-1.3, 0.912, 0.815), (-0.2, 0.914, 0.79), (1.0, 0.912, 0.795), (1.86, 0.9, 0.71), (2.17, 0.895, 0.665), (2.3, 0.86, 0.645), (2.375, 0.77, 0.635)],
    # 8: the belt (the windows' sill), the fenders' top edge
    [(-2.375, 0.69, 0.99), (-2.3, 0.8, 1.02), (-2.15, 0.84, 1.04), (-2.0, 0.848, 1.045), (-1.6, 0.853, 1.05), (-1.36, 0.857, 1.048), (-0.2, 0.862, 0.99), (0.975, 0.86, 0.95), (1.12, 0.838, 0.93), (1.7, 0.835, 0.865), (2.0, 0.83, 0.812), (2.2, 0.81, 0.775), (2.33, 0.75, 0.75)],
    # 9: the glass's foot; the hood's and the trunk lid's side seams
    [(-2.36, 0.66, 1.03), (-2.28, 0.74, 1.045), (-2.1, 0.78, 1.06), (-1.86, 0.795, 1.068), (-1.36, 0.848, 1.06), (-0.2, 0.852, 1.0), (0.97, 0.85, 0.962), (1.12, 0.79, 0.935), (1.7, 0.785, 0.872), (2.0, 0.785, 0.82), (2.2, 0.775, 0.785), (2.31, 0.72, 0.775)],
    # 10: the glass's top (the A-pillar's outer edge, the roof rail), the trunk, the hood
    [(-2.365, 0.53, 1.045), (-2.3, 0.59, 1.052), (-2.1, 0.645, 1.07), (-1.88, 0.75, 1.08), (-1.6, 0.8, 1.077), (-1.362, 0.846, 1.068), (-1.25, 0.775, 1.15), (-1.05, 0.722, 1.26), (-0.75, 0.702, 1.35), (-0.3, 0.7, 1.378), (0.2, 0.712, 1.352), (0.6, 0.79, 1.15), (0.965, 0.848, 0.968), (1.13, 0.64, 0.945), (1.7, 0.63, 0.885), (2.05, 0.6, 0.82), (2.26, 0.6, 0.79), (2.315, 0.58, 0.784)],
    # 11: the roof's edge, the screens' sides
    [(-2.37, 0.375, 1.055), (-2.3, 0.42, 1.062), (-2.1, 0.5, 1.075), (-1.88, 0.66, 1.09), (-1.5, 0.655, 1.24), (-1.15, 0.64, 1.35), (-0.8, 0.655, 1.39), (-0.3, 0.655, 1.41), (0.18, 0.665, 1.39), (0.6, 0.735, 1.19), (0.99, 0.8, 0.975), (1.14, 0.48, 0.952), (1.7, 0.47, 0.893), (2.05, 0.45, 0.83), (2.27, 0.44, 0.795), (2.32, 0.43, 0.79)],
    # 12-14: across the roof, the screens, the hood, the trunk lid to the middle
    [(-2.372, 0.25, 1.062), (-2.3, 0.28, 1.068), (-2.1, 0.33, 1.08), (-1.89, 0.44, 1.095), (-1.5, 0.43, 1.25), (-1.15, 0.42, 1.365), (-0.8, 0.43, 1.41), (-0.3, 0.43, 1.43), (0.17, 0.44, 1.413), (0.6, 0.49, 1.205), (1.01, 0.53, 0.978), (1.14, 0.32, 0.957), (1.7, 0.31, 0.898), (2.05, 0.3, 0.836), (2.28, 0.29, 0.798), (2.325, 0.29, 0.794)],
    [(-2.374, 0.125, 1.066), (-2.3, 0.14, 1.072), (-2.1, 0.165, 1.083), (-1.895, 0.22, 1.098), (-1.5, 0.215, 1.255), (-1.15, 0.21, 1.37), (-0.8, 0.215, 1.417), (-0.3, 0.215, 1.437), (0.165, 0.22, 1.42), (0.6, 0.245, 1.21), (1.02, 0.265, 0.979), (1.14, 0.16, 0.959), (1.7, 0.155, 0.9), (2.05, 0.15, 0.838), (2.29, 0.145, 0.8), (2.328, 0.145, 0.796)],
    [(-2.375, 0.0, 1.068), (-2.3, 0.0, 1.074), (-2.1, 0.0, 1.084), (-1.9, 0.0, 1.1), (-1.5, 0.0, 1.257), (-1.15, 0.0, 1.372), (-0.8, 0.0, 1.42), (-0.3, 0.0, 1.44), (0.16, 0.0, 1.422), (0.6, 0.0, 1.212), (1.025, 0.0, 0.98), (1.14, 0.0, 0.96), (1.7, 0.0, 0.9), (2.05, 0.0, 0.84), (2.29, 0.0, 0.8), (2.33, 0.0, 0.797)],
  ]
  ends_front = [l[-1][0] for l in lines]
  ends_rear = [l[0][0] for l in lines]

  stations = [
    'rear',
    [e + 0.07 for e in ends_rear],
    [e + 0.17 for e in ends_rear],
    -2.0,
    # The rear glass's foot and the trunk lid's front
    per(lines, {0: -1.87, 9: -1.86, 10: -1.88, 11: -1.88, 12: -1.885, 13: -1.89, 14: -1.9}),
    # The rear door's back seam (round the arch), the side glass's tip
    per(lines, {0: -0.97, 6: -1.0, 7: -1.27, 8: -1.355, 9: -1.36, 10: -1.362, 11: -1.5}),
    # The roof's end, the rear glass's top
    per(lines, {0: -0.88, 6: -0.9, 7: -1.0, 8: -1.1, 9: -1.15}),
    -0.75,
    # The B-pillar: the rear door's front seam, the front door's back seam
    per(lines, {0: -0.202, 9: -0.28, 10: -0.34}),
    per(lines, {0: -0.2, 9: -0.21, 10: -0.27}),
    # The windscreen's top, its middle, its foot (the front door's seam, the A-pillar's foot)
    per(lines, {0: 0.18, 10: 0.2, 11: 0.18, 12: 0.17, 13: 0.165, 14: 0.16}),
    0.6,
    per(lines, {0: 1.06, 6: 1.05, 7: 1.02, 8: 0.975, 9: 0.97, 10: 0.965, 11: 0.99, 12: 1.01, 13: 1.02, 14: 1.025}),
    # The hood's back seam
    per(lines, {0: 1.14, 9: 1.12, 10: 1.13, 11: 1.14}),
    # The front bumper's seam in front of the arch
    per(lines, {0: 1.96, 9: 1.75}),
    [e - 0.17 for e in ends_front],
    [e - 0.07 for e in ends_front],
    'front',
  ]

  regions = three_box_regions(belt_chrome=True)

  # The headlamps: slim at their inner ends, deeper where they turn the corner, a little under the
  # hood's edge; the grille between them, a chrome bar along its top; the plate on the bumper under
  # it, the intake under that; the corners' vents
  head = [(0.37, 0.668), (0.55, 0.655), (0.72, 0.64), (0.84, 0.632), (0.895, 0.662), (0.89, 0.748), (0.72, 0.764), (0.55, 0.758), (0.37, 0.738)]
  head_side = [(2.0, 0.742), (2.12, 0.705), (2.3, 0.668), (2.42, 0.658), (2.42, 0.768), (2.2, 0.775), (2.04, 0.768)]
  slot = [(0.0, 0.655), (0.355, 0.645), (0.355, 0.672), (0.0, 0.682)]
  grille = [(0.0, 0.495), (0.27, 0.495), (0.36, 0.525), (0.385, 0.6), (0.355, 0.64), (0.0, 0.648)]
  lower = [(0.0, 0.235), (0.38, 0.235), (0.45, 0.28), (0.44, 0.322), (0.0, 0.322)]
  intake = [(0.6, 0.29), (0.7, 0.29), (0.77, 0.34), (0.785, 0.47), (0.72, 0.5), (0.62, 0.45)]
  tail = [(0.0, 0.925), (0.48, 0.925), (0.6, 0.9), (0.74, 0.893), (0.8, 0.915), (0.82, 0.975), (0.74, 0.993), (0.6, 0.99), (0.0, 0.964)]
  tail_side = [(-2.48, 0.9), (-2.33, 0.915), (-2.24, 0.955), (-2.24, 0.99), (-2.48, 0.99)]
  tail_mid = mid_of(tail)
  head_top = top_of(head)
  features = [
    # The rear face: the trunk lid's down to its seam over the bumper, the quarters' beside it
    {'kind': 'part', 'view': 'rear', 'part': 'trunk', 'poly': [(0.0, 0.7), (0.56, 0.7), (0.56, 1.2), (0.0, 1.2)], 'near': 2.2, 'facing': 0.3},
    {'kind': 'part', 'view': 'rear', 'part': 'body', 'poly': [(0.56, 0.7), (0.95, 0.7), (0.95, 1.2), (0.56, 1.2)], 'near': 2.1, 'facing': 0.3},
    {'kind': 'headlight', 'view': 'front', 'poly': head, 'part': 'body', 'near': 2.0, 'facing': 0.2, 'depth': 0.05, 'back': 'light_back', 'wall': 'light_back',
     'also': [{'view': 'side', 'poly': head_side, 'near': 0.6, 'facing': 0.35}],
     'bands': [{'test': lambda u, z: z > head_top(u) - 0.014, 'look': 'drl'}],
     'lenses': [(0.61, 0.7, 0.024), (0.75, 0.695, 0.024)]},
    {'kind': 'grille', 'view': 'front', 'poly': slot, 'near': 2.0, 'depth': 0.02,
     'slats': [{'z': 0.664, 'x': (0.0, 0.35), 'thick': 0.016, 'look': 'chrome', 'back': 0.004, 'deep': 0.012}]},
    {'kind': 'grille', 'view': 'front', 'poly': grille, 'near': 2.0, 'depth': 0.06, 'slats': slats(grille, 0.51, 0.63, 0.028, thick=0.01, back=0.018, deep=0.025, look='plastic')},
    {'kind': 'intake', 'view': 'front', 'poly': lower, 'near': 2.0, 'facing': 0.15, 'depth': 0.05, 'slats': slats(lower, 0.255, 0.31, 0.027, thick=0.008, back=0.012, deep=0.02, look='plastic')},
    {'kind': 'intake', 'view': 'front', 'poly': intake, 'near': 2.0, 'facing': 0.2, 'depth': 0.04, 'slats': slats(intake, 0.32, 0.46, 0.035, thick=0.008, back=0.01, deep=0.02, look='plastic')},
    {'kind': 'paint', 'view': 'front', 'look': 'plastic', 'poly': [(0.0, 0.2), (0.7, 0.2), (0.7, 0.235), (0.0, 0.235)], 'near': 2.0, 'facing': 0.15},
    {'kind': 'taillight', 'view': 'rear', 'poly': tail, 'near': 2.0, 'facing': 0.25, 'depth': 0.035,
     'also': [{'view': 'side', 'poly': tail_side, 'near': 0.6, 'facing': 0.3}],
     'bands': [{'test': lambda u, z: abs(z - tail_mid(u)) < 0.006 or (u > 0.62 and abs(z - tail_mid(u)) < 0.02), 'look': 'led_red'}]},
    {'kind': 'plate', 'view': 'rear', 'poly': [(0.0, 0.715), (0.185, 0.715), (0.195, 0.885), (0.0, 0.885)], 'near': 2.2, 'depth': 0.015},
    {'kind': 'paint', 'view': 'rear', 'look': 'plastic', 'poly': [(0.0, 0.26), (0.72, 0.26), (0.72, 0.37), (0.0, 0.37)], 'near': 2.0, 'facing': 0.15},
    {'kind': 'paint', 'view': 'rear', 'look': 'reflector_red', 'poly': [(0.5, 0.4), (0.64, 0.4), (0.64, 0.422), (0.5, 0.422)], 'near': 2.0, 'facing': 0.2},
    {'kind': 'groove', 'view': 'side', 'both': False, 'poly': [(-1.87, 0.885), (-1.7, 0.885), (-1.7, 1.0), (-1.87, 1.0)], 'facing': 0.3},
  ]

  return {
    'paint': {'rough': 0.3, 'metal': 0.55, 'coat_rough': 0.03},
    'tint': 0xa9aeb4,
    'wheels': {'front': 1.5, 'rear': -1.42, 'x': 0.8, 'radius': 0.345, 'rim': 0.2413, 'width': 0.235, 'arch': 0.385, 'style': 'double'},
    # Hard lines: the shoulder's crease, the belt and the fenders' tops
    'creases': (7, 8),
    'lines': lines,
    'stations': stations,
    'regions': regions,
    'face': {
      'bottom': (0, 5),
      'top': (9, 14),
      'front_centre': [(0.0, 2.42, 0.36), (0.0, 2.45, 0.5), (0.0, 2.435, 0.64), (0.0, 2.39, 0.74)],
      'rear_centre': [(0.0, -2.42, 0.4), (0.0, -2.455, 0.56), (0.0, -2.44, 0.8), (0.0, -2.4, 0.98)],
      'front_region': 'bumper.f',
      'rear_region': 'bumper.r',
    },
    'features': features,
    'mirror': {'at': (0.99, 0.84, 1.05), 'size': (0.2, 0.1, 0.12), 'look': 'paint', 'stalk': 'plastic'},
    'handles': [{'part': 'door.f#', 'y': 0.12, 'z': 0.84}, {'part': 'door.r#', 'y': -0.92, 'z': 0.87}],
    'plates': [{'view': 'front', 'z': 0.408, 'out': 0.004, 'part': 'bumper.f', 'text': 'KJT 4107'}, {'view': 'rear', 'z': 0.8, 'out': -0.012, 'part': 'trunk', 'text': 'KJT 4107'}],
    'wipers': [{'from': (0.42, 1.04, 0.988), 'to': (-0.15, 0.95, 1.012)}, {'from': (-0.2, 1.04, 0.988), 'to': (-0.72, 0.96, 1.004)}],
    'fin': {'y': -1.02},
    'exhausts': [{'at': (0.42, -2.3, 0.3), 'r': 0.033}],
  }




def taxi():
  """The yellow cab: a full-size body-on-frame sedan in a Crown Victoria's shape (long hood, tall
  upright cabin, long trunk), taxi yellow, a checker stripe along it, a roof sign, steel wheels
  under chrome caps."""
  lines = [
    [(-2.52, 0.0, 0.3), (-2.3, 0.0, 0.22), (-2.0, 0.0, 0.19), (2.0, 0.0, 0.19), (2.3, 0.0, 0.21), (2.52, 0.0, 0.28)],
    [(-2.515, 0.17, 0.301), (-2.3, 0.25, 0.221), (-2.0, 0.3, 0.19), (2.0, 0.3, 0.19), (2.3, 0.25, 0.211), (2.515, 0.17, 0.281)],
    [(-2.505, 0.35, 0.303), (-2.3, 0.5, 0.223), (-2.0, 0.6, 0.19), (2.0, 0.6, 0.19), (2.3, 0.5, 0.213), (2.505, 0.35, 0.283)],
    [(-2.49, 0.52, 0.306), (-2.3, 0.72, 0.228), (-2.0, 0.85, 0.2), (2.0, 0.85, 0.2), (2.3, 0.72, 0.218), (2.49, 0.52, 0.286)],
    [(-2.47, 0.68, 0.31), (-2.3, 0.88, 0.25), (-2.0, 0.95, 0.225), (2.0, 0.95, 0.225), (2.3, 0.88, 0.24), (2.47, 0.68, 0.29)],
    [(-2.44, 0.84, 0.33), (-2.3, 0.95, 0.31), (-2.0, 0.975, 0.285), (2.0, 0.975, 0.28), (2.3, 0.95, 0.29), (2.45, 0.84, 0.31)],
    [(-2.6, 0.84, 0.62), (-2.56, 0.92, 0.62), (-2.45, 0.975, 0.62), (-2.2, 0.995, 0.62), (2.2, 0.995, 0.6), (2.45, 0.965, 0.6), (2.56, 0.9, 0.6), (2.6, 0.84, 0.6)],
    [(-2.56, 0.84, 0.82), (-2.5, 0.925, 0.82), (-2.3, 0.975, 0.82), (2.3, 0.975, 0.8), (2.48, 0.925, 0.785), (2.53, 0.84, 0.78)],
    [(-2.55, 0.82, 0.98), (-2.45, 0.89, 0.99), (-2.2, 0.92, 1.0), (-1.6, 0.928, 1.0), (1.1, 0.928, 0.99), (1.2, 0.925, 0.975), (2.0, 0.92, 0.9), (2.35, 0.905, 0.87), (2.48, 0.865, 0.86), (2.52, 0.82, 0.855)],
    [(-2.54, 0.78, 1.035), (-2.45, 0.835, 1.045), (-2.2, 0.865, 1.06), (-1.585, 0.875, 1.09), (-1.12, 0.915, 1.005), (1.1, 0.915, 1.005), (1.22, 0.88, 0.98), (2.0, 0.875, 0.906), (2.35, 0.86, 0.876), (2.47, 0.825, 0.866), (2.5, 0.78, 0.862)],
    [(-2.55, 0.62, 1.04), (-2.45, 0.7, 1.048), (-2.2, 0.73, 1.063), (-1.6, 0.8, 1.093), (-1.36, 0.79, 1.24), (-1.12, 0.758, 1.418), (-0.6, 0.756, 1.425), (0.47, 0.76, 1.418), (0.8, 0.83, 1.22), (1.095, 0.912, 1.012), (1.23, 0.72, 0.99), (2.0, 0.71, 0.922), (2.35, 0.7, 0.888), (2.47, 0.66, 0.874), (2.505, 0.62, 0.868)],
    [(-2.56, 0.47, 1.05), (-2.2, 0.54, 1.07), (-1.57, 0.69, 1.1), (-1.12, 0.7, 1.432), (-0.6, 0.71, 1.445), (0.47, 0.715, 1.44), (0.8, 0.78, 1.235), (1.12, 0.865, 1.04), (1.24, 0.56, 1.0), (2.0, 0.55, 0.93), (2.35, 0.54, 0.895), (2.48, 0.5, 0.88), (2.51, 0.47, 0.876)],
    [(-2.565, 0.31, 1.055), (-2.2, 0.36, 1.075), (-1.57, 0.46, 1.105), (-1.12, 0.47, 1.45), (-0.6, 0.47, 1.465), (0.47, 0.47, 1.46), (0.8, 0.5, 1.26), (1.13, 0.57, 1.045), (1.24, 0.37, 1.005), (2.0, 0.365, 0.935), (2.35, 0.36, 0.9), (2.49, 0.33, 0.884), (2.515, 0.31, 0.88)],
    [(-2.568, 0.155, 1.058), (-2.2, 0.18, 1.078), (-1.57, 0.23, 1.108), (-1.12, 0.235, 1.455), (-0.6, 0.235, 1.472), (0.47, 0.235, 1.467), (0.8, 0.25, 1.265), (1.135, 0.285, 1.047), (1.24, 0.185, 1.007), (2.0, 0.18, 0.937), (2.35, 0.18, 0.902), (2.5, 0.165, 0.886), (2.52, 0.155, 0.882)],
    [(-2.57, 0.0, 1.06), (-2.2, 0.0, 1.08), (-1.57, 0.0, 1.11), (-1.12, 0.0, 1.457), (-0.6, 0.0, 1.475), (0.47, 0.0, 1.47), (0.8, 0.0, 1.268), (1.14, 0.0, 1.048), (1.24, 0.0, 1.008), (2.0, 0.0, 0.938), (2.35, 0.0, 0.903), (2.5, 0.0, 0.887), (2.52, 0.0, 0.884)],
  ]
  ends_front = [l[-1][0] for l in lines]
  ends_rear = [l[0][0] for l in lines]
  stations = [
    'rear',
    [e + 0.06 for e in ends_rear],
    [e + 0.16 for e in ends_rear],
    -2.15,
    per(lines, {0: -1.95, 9: -1.585, 10: -1.6, 11: -1.57}),
    per(lines, {0: -0.92, 6: -1.0, 7: -1.1, 8: -1.12, 9: -1.12, 10: -1.12, 11: -1.33}),
    per(lines, {0: -0.85, 6: -0.9, 7: -1.0, 8: -1.0, 9: -1.0, 10: -1.0, 11: -1.12}),
    -0.6,
    per(lines, {0: -0.102, 9: -0.16, 10: -0.2}),
    per(lines, {0: -0.1, 9: -0.1, 10: -0.13}),
    0.47,
    0.8,
    per(lines, {0: 1.12, 7: 1.11, 8: 1.1, 9: 1.1, 10: 1.095, 11: 1.12, 12: 1.13, 13: 1.135, 14: 1.14}),
    per(lines, {0: 1.25, 9: 1.22, 10: 1.23, 11: 1.24}),
    per(lines, {0: 2.05, 9: 1.95}),
    [e - 0.16 for e in ends_front],
    [e - 0.06 for e in ends_front],
    'front',
  ]
  regions = three_box_regions(belt_chrome=False)
  head = [(0.42, 0.645), (0.7, 0.645), (0.7, 0.805), (0.42, 0.805)]
  corner = [(0.7, 0.645), (0.8, 0.645), (0.86, 0.66), (0.88, 0.75), (0.86, 0.8), (0.7, 0.805)]
  surround = [(0.0, 0.6), (0.4, 0.6), (0.4, 0.83), (0.0, 0.83)]
  grille = [(0.0, 0.615), (0.385, 0.615), (0.385, 0.815), (0.0, 0.815)]
  tail = [(0.56, 0.72), (0.84, 0.72), (0.88, 0.75), (0.88, 0.97), (0.84, 0.99), (0.56, 0.99)]
  tail_side = [(-2.62, 0.73), (-2.42, 0.74), (-2.42, 0.96), (-2.62, 0.97)]
  features = [
    {'kind': 'part', 'view': 'rear', 'part': 'trunk', 'poly': [(0.0, 0.7), (0.55, 0.7), (0.55, 1.2), (0.0, 1.2)], 'near': 2.4, 'facing': 0.3},
    {'kind': 'part', 'view': 'rear', 'part': 'body', 'poly': [(0.55, 0.7), (1.05, 0.7), (1.05, 1.2), (0.55, 1.2)], 'near': 2.3, 'facing': 0.3},
    {'kind': 'paint', 'view': 'front', 'look': 'chrome', 'poly': surround, 'near': 2.3},
    {'kind': 'grille', 'view': 'front', 'poly': grille, 'near': 2.3, 'depth': 0.05, 'on_looks': ('chrome',),
     'slats': slats(grille, 0.63, 0.8, 0.034, thick=0.008, back=0.008, deep=0.02, look='chrome')},
    {'kind': 'headlight', 'view': 'front', 'poly': head, 'part': 'body', 'near': 2.3, 'facing': 0.3, 'depth': 0.06, 'back': 'reflector', 'wall': 'reflector',
     'lenses': [(0.53, 0.725, 0.03), (0.63, 0.725, 0.026)]},
    {'kind': 'marker', 'view': 'front', 'poly': corner, 'part': 'body', 'near': 2.2, 'facing': 0.2, 'depth': 0.03},
    {'kind': 'paint', 'view': 'front', 'look': 'plastic', 'poly': [(0.0, 0.47), (1.1, 0.47), (1.1, 0.52), (0.0, 0.52)], 'near': 2.0, 'facing': 0.15},
    {'kind': 'paint', 'view': 'side', 'look': 'plastic', 'poly': [(1.95, 0.47), (2.7, 0.47), (2.7, 0.52), (1.95, 0.52)], 'near': 0.6, 'facing': 0.3},
    {'kind': 'intake', 'view': 'front', 'poly': [(0.0, 0.3), (0.55, 0.3), (0.52, 0.4), (0.0, 0.4)], 'near': 2.3, 'depth': 0.04,
     'slats': slats([(0.0, 0.3), (0.55, 0.3), (0.52, 0.4), (0.0, 0.4)], 0.33, 0.38, 0.03, thick=0.01, back=0.01, deep=0.02, look='plastic')},
    {'kind': 'taillight', 'view': 'rear', 'poly': tail, 'near': 2.3, 'facing': 0.25, 'depth': 0.04, 'part': 'body',
     'also': [{'view': 'side', 'poly': tail_side, 'near': 0.6, 'facing': 0.3}],
     'bands': [{'test': lambda u, z: z < 0.79, 'look': 'reflector'}, {'test': lambda u, z: z > 0.81 and abs(z - 0.9) < 0.06, 'look': 'led_red'}]},
    {'kind': 'plate', 'view': 'rear', 'poly': [(0.0, 0.73), (0.19, 0.73), (0.19, 0.9), (0.0, 0.9)], 'near': 2.4, 'depth': 0.015},
    {'kind': 'paint', 'view': 'rear', 'look': 'plastic', 'poly': [(0.0, 0.5), (1.1, 0.5), (1.1, 0.55), (0.0, 0.55)], 'near': 2.0, 'facing': 0.15},
    {'kind': 'paint', 'view': 'side', 'look': 'plastic', 'poly': [(-2.7, 0.5), (-2.0, 0.5), (-2.0, 0.55), (-2.7, 0.55)], 'near': 0.6, 'facing': 0.3},
    # The checker stripe, along the doors and on to the fenders
    {'kind': 'paint', 'view': 'side', 'look': 'checker', 'poly': [(-2.35, 0.795), (2.25, 0.795), (2.25, 0.835), (-2.35, 0.835)], 'near': 0.6, 'facing': 0.4},
    {'kind': 'groove', 'view': 'side', 'both': False, 'poly': [(-1.95, 0.89), (-1.78, 0.89), (-1.78, 0.99), (-1.95, 0.99)], 'facing': 0.3},
  ]
  return {
    'paint': {'rough': 0.32, 'metal': 0.05, 'coat_rough': 0.04},
    'tint': 0xf2b60f,
    'wheels': {'front': 1.58, 'rear': -1.33, 'x': 0.8, 'radius': 0.3385, 'rim': 0.2032, 'width': 0.225, 'arch': 0.39, 'style': 'steel', 'holes': 10, 'cap': 'chrome'},
    'creases': (5, 7, 8),
    'checker': {'z0': 0.795, 'square': 0.02},
    'lines': lines,
    'stations': stations,
    'regions': regions,
    'face': {
      'bottom': (0, 5),
      'top': (9, 14),
      'front_centre': [(0.0, 2.55, 0.36), (0.0, 2.6, 0.5), (0.0, 2.59, 0.6), (0.0, 2.54, 0.76)],
      'rear_centre': [(0.0, -2.56, 0.4), (0.0, -2.61, 0.56), (0.0, -2.6, 0.76), (0.0, -2.58, 0.95)],
      'front_region': 'bumper.f',
      'rear_region': 'bumper.r',
    },
    'features': features,
    'mirror': {'at': (1.06, 0.98, 1.1), 'size': (0.18, 0.09, 0.13), 'look': 'plastic', 'stalk': 'plastic'},
    'handles': [{'part': 'door.f#', 'y': 0.12, 'z': 0.88, 'look': 'plastic'}, {'part': 'door.r#', 'y': -0.88, 'z': 0.9, 'look': 'plastic'}],
    'plates': [{'view': 'front', 'z': 0.44, 'out': 0.004, 'part': 'bumper.f', 'text': 'T 482 76'}, {'view': 'rear', 'z': 0.815, 'out': -0.012, 'part': 'trunk', 'text': 'T 482 76'}],
    'wipers': [{'from': (0.4, 1.17, 1.035), 'to': (-0.18, 1.08, 1.06)}, {'from': (-0.22, 1.17, 1.035), 'to': (-0.76, 1.08, 1.05)}],
    'exhausts': [{'at': (0.5, -2.45, 0.32), 'r': 0.03}],
    'extras': [roof_sign],
  }


def roof_sign(design, tree, look):
  """The cab's roof light: a yellow box across the roof on a black foot, TAXI on its faces, amber
  lamps at its ends (a part of its own: it comes off)."""
  import bmesh
  import bpy
  from mathutils import Matrix, Vector
  hit = tree.ray_cast(Vector((0, -0.05, 3)), Vector((0, 0, -1)), 5)[0]
  z = hit.z if hit else 1.47
  W, D, H = 0.62, 0.2, 0.15
  bm = bmesh.new()
  names = []

  def box(size, at, name):
    b = bmesh.new()
    bmesh.ops.create_cube(b, size=1)
    bmesh.ops.scale(b, vec=size, verts=b.verts)
    bmesh.ops.translate(b, vec=at, verts=b.verts)
    if name not in names:
      names.append(name)
    me = bpy.data.meshes.new('t')
    b.to_mesh(me)
    for p in me.polygons:
      p.material_index = names.index(name)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    b.free()

  box((W * 0.9, D * 0.8, 0.03), (0, -0.05, z + 0.015), 'plastic')
  box((W, D, H), (0, -0.05, z + 0.03 + H / 2), 'sign')
  for s in (-1, 1):
    box((0.06, D * 1.02, H * 0.8), (s * (W / 2 - 0.03), -0.05, z + 0.03 + H / 2), 'lamp_amber')
    box((W - 0.16, 0.004, H * 0.6), (0, -0.05 + s * (D / 2 + 0.002), z + 0.03 + H / 2), 'trim')
  me = bpy.data.meshes.new('trim.sign')
  bm.to_mesh(me)
  bm.free()
  for n in names:
    me.materials.append(look(n))
  o = bpy.data.objects.new('trim.sign', me)
  bpy.context.collection.objects.link(o)
  # TAXI, lit, on both faces
  import car_model
  for s in (-1, 1):
    t = car_model.text_mesh('TAXI', H * 0.42, 0.002)
    face = Matrix.Translation((0, -0.05 + s * (D / 2 + 0.005), z + 0.03 + H / 2)) @ Matrix.Rotation(0 if s < 0 else math.pi, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
    m = car_model.Mesh('taxi').add(t, 'sign_text', face, angle=1.0).object()
    car_model.join_into(o, [m])
  return {'trim.sign': o}


def van():
  """The delivery van: a high-roof panel van in a Transit's shape: a short sloping hood, a big
  raked windscreen under the roof's front, cab doors, a sliding door on the right, two barn doors
  at the back, black bumpers and cladding along its foot, steel wheels."""
  lines = [
    [(-2.72, 0.0, 0.47), (-2.5, 0.0, 0.42), (-2.2, 0.0, 0.4), (2.2, 0.0, 0.4), (2.5, 0.0, 0.34), (2.69, 0.0, 0.33)],
    [(-2.72, 0.33, 0.47), (-2.5, 0.4, 0.42), (-2.2, 0.35, 0.4), (2.2, 0.35, 0.4), (2.5, 0.4, 0.34), (2.69, 0.33, 0.33)],
    [(-2.72, 0.66, 0.47), (-2.5, 0.75, 0.42), (-2.2, 0.7, 0.4), (2.2, 0.7, 0.4), (2.5, 0.75, 0.34), (2.69, 0.66, 0.33)],
    [(-2.72, 0.95, 0.48), (-2.5, 0.97, 0.42), (-2.2, 0.96, 0.4), (2.2, 0.96, 0.4), (2.5, 0.97, 0.35), (2.69, 0.95, 0.34)],
    [(-2.735, 0.975, 0.52), (-2.6, 0.99, 0.45), (-2.2, 0.995, 0.42), (2.2, 0.995, 0.42), (2.6, 0.99, 0.38), (2.7, 0.975, 0.37)],
    [(-2.74, 0.985, 0.56), (-2.6, 1.0, 0.5), (-2.2, 1.003, 0.46), (2.2, 1.003, 0.46), (2.6, 0.99, 0.46), (2.71, 0.97, 0.46)],
    [(-2.745, 0.99, 0.95), (-2.6, 1.005, 0.95), (-2.2, 1.01, 0.95), (2.2, 1.01, 0.95), (2.55, 0.995, 0.92), (2.7, 0.955, 0.9)],
    [(-2.745, 0.985, 1.3), (-2.6, 1.0, 1.29), (-2.2, 1.008, 1.27), (1.3, 1.008, 1.26), (1.9, 1.0, 1.2), (2.4, 0.98, 1.12), (2.66, 0.94, 1.08)],
    [(-2.745, 0.975, 1.32), (-2.6, 0.995, 1.31), (-2.2, 1.0, 1.3), (1.0, 1.0, 1.285), (1.66, 0.995, 1.28), (1.9, 0.97, 1.25), (2.4, 0.95, 1.19), (2.64, 0.92, 1.16)],
    [(-2.745, 0.97, 1.34), (-2.6, 0.99, 1.33), (-2.2, 0.995, 1.32), (0.5, 0.99, 1.3), (1.0, 0.99, 1.296), (1.667, 0.985, 1.3), (1.8, 0.94, 1.355), (2.2, 0.935, 1.27), (2.5, 0.92, 1.2), (2.66, 0.89, 1.17)],
    [(-2.745, 0.95, 2.05), (-2.6, 0.965, 2.05), (-2.2, 0.97, 2.05), (0.0, 0.97, 2.03), (0.55, 0.97, 2.0), (1.2, 0.965, 2.0), (1.45, 0.975, 1.65), (1.665, 0.984, 1.306), (1.8, 0.8, 1.39), (2.2, 0.79, 1.29), (2.5, 0.77, 1.215), (2.665, 0.74, 1.175)],
    [(-2.75, 0.88, 2.4), (-2.6, 0.9, 2.42), (-2.2, 0.91, 2.43), (0.8, 0.91, 2.43), (1.0, 0.9, 2.3), (1.4, 0.93, 1.85), (1.72, 0.96, 1.37), (1.8, 0.78, 1.4), (2.2, 0.62, 1.305), (2.5, 0.6, 1.225), (2.67, 0.58, 1.18)],
    [(-2.75, 0.58, 2.46), (-2.2, 0.6, 2.475), (0.8, 0.6, 2.475), (0.98, 0.6, 2.33), (1.4, 0.62, 1.86), (1.82, 0.64, 1.415), (2.2, 0.42, 1.31), (2.5, 0.4, 1.23), (2.68, 0.39, 1.185)],
    [(-2.75, 0.29, 2.47), (-2.2, 0.3, 2.49), (0.8, 0.3, 2.49), (0.97, 0.3, 2.34), (1.4, 0.31, 1.87), (1.86, 0.32, 1.42), (2.2, 0.21, 1.315), (2.5, 0.2, 1.235), (2.69, 0.195, 1.188)],
    [(-2.75, 0.0, 2.475), (-2.2, 0.0, 2.495), (0.8, 0.0, 2.495), (0.96, 0.0, 2.345), (1.4, 0.0, 1.875), (1.88, 0.0, 1.422), (2.2, 0.0, 1.318), (2.5, 0.0, 1.238), (2.69, 0.0, 1.19)],
  ]
  ends_front = [l[-1][0] for l in lines]
  ends_rear = [l[0][0] for l in lines]
  stations = [
    'rear',
    [e + 0.04 for e in ends_rear],
    [e + 0.12 for e in ends_rear],
    -2.2,
    -1.0,
    per(lines, {0: 0.5, 11: 0.4}),
    per(lines, {0: 0.54, 11: 0.6}),
    per(lines, {0: 0.9, 11: 1.0}),
    per(lines, {0: 1.32, 7: 1.33, 8: 1.35, 9: 1.355, 10: 1.36, 11: 1.4}),
    per(lines, {0: 1.42, 8: 1.66, 9: 1.667, 10: 1.665, 11: 1.72, 12: 1.82, 13: 1.86, 14: 1.88}),
    per(lines, {0: 1.5, 8: 1.75, 9: 1.8, 12: 1.9, 13: 1.94, 14: 1.96}),
    per(lines, {0: 2.3, 9: 2.25}),
    [e - 0.12 for e in ends_front],
    [e - 0.04 for e in ends_front],
    'front',
  ]

  def regions(s, k):
    # Spans: 0-1 the rear's corner, 2-3 the back of the load space, 4 the sliding door, 5 the
    # B-pillar, 6-7 the cab door (the windscreen over it), 8 the quarter glass, 9 the cowl, 10 the
    # hood and fender, 11-13 the front's corner
    if k <= 3:
      return 'under'
    if k == 4:
      return 'body'
    top = k >= 11
    if s <= 3:
      return 'roof' if top else 'body'
    if s == 4:
      if top:
        return 'roof'
      return ('door.side', 'body') if k <= 9 else 'body'
    if s == 5:
      if top:
        return 'roof'
      return 'pillar' if k == 9 else 'body'
    if s in (6, 7):
      if top:
        return 'roof' if s == 6 else 'glass.windscreen'
      if k == 10:
        return 'body'
      return 'glass.f#' if k == 9 else 'door.f#'
    if s == 8:
      if top:
        return 'glass.windscreen'
      return 'glass.q#' if k == 9 else 'body'
    if s == 9:
      return 'cowl' if top else 'body'
    if s == 10:
      return 'hood' if k >= 9 else 'body'
    if k >= 9:
      return 'hood'
    return 'bumper.f' if k <= 6 else 'body'

  grille = [(0.0, 0.72), (0.52, 0.72), (0.6, 0.8), (0.6, 1.04), (0.55, 1.1), (0.0, 1.1)]
  head = [(0.63, 0.93), (0.8, 0.93), (0.92, 0.98), (0.95, 1.13), (0.78, 1.16), (0.63, 1.12)]
  head_side = [(2.42, 0.99), (2.72, 0.95), (2.72, 1.16), (2.47, 1.17)]
  rear_win = [(0.07, 1.48), (0.74, 1.48), (0.8, 1.54), (0.8, 2.08), (0.74, 2.14), (0.07, 2.14)]
  tail = [(0.87, 0.8), (1.05, 0.8), (1.05, 1.42), (0.87, 1.42)]
  features = [
    # The back: two barn doors, the posts beside them and the header over them the body's, the bumper under
    {'kind': 'part', 'view': 'rear', 'part': 'door.b#', 'poly': [(0.0, 0.6), (0.85, 0.6), (0.85, 2.34), (0.0, 2.34)], 'near': 2.6, 'facing': 0.3},
    {'kind': 'part', 'view': 'rear', 'part': 'body', 'poly': [(0.85, 0.6), (1.1, 0.6), (1.1, 2.7), (0.0, 2.7), (0.0, 2.34), (0.85, 2.34)], 'near': 2.6, 'facing': 0.3},
    {'kind': 'paint', 'view': 'rear', 'look': 'glass', 'poly': rear_win, 'near': 2.6, 'facing': 0.5},
    {'kind': 'taillight', 'view': 'rear', 'poly': tail, 'part': 'body', 'near': 2.6, 'facing': 0.3, 'depth': 0.04,
     'bands': [{'test': lambda u, z: 0.93 < z < 1.1, 'look': 'reflector'}, {'test': lambda u, z: z > 1.18, 'look': 'led_red'}]},
    {'kind': 'paint', 'view': 'rear', 'look': 'lamp_red', 'poly': [(0.0, 2.37), (0.17, 2.37), (0.17, 2.42), (0.0, 2.42)], 'near': 2.6, 'facing': 0.5},
    {'kind': 'paint', 'view': 'rear', 'look': 'plastic', 'poly': [(0.0, 0.2), (1.1, 0.2), (1.1, 0.6), (0.0, 0.6)], 'near': 2.5, 'facing': 0.2},
    # The front: the black bumper, the big grille, the lamps
    {'kind': 'paint', 'view': 'front', 'look': 'plastic', 'poly': [(0.0, 0.2), (1.1, 0.2), (1.1, 0.71), (0.0, 0.71)], 'near': 2.3, 'facing': 0.15},
    {'kind': 'paint', 'view': 'side', 'look': 'plastic', 'poly': [(2.15, 0.3), (2.9, 0.3), (2.9, 0.71), (2.15, 0.71)], 'near': 0.8, 'facing': 0.3},
    {'kind': 'grille', 'view': 'front', 'poly': grille, 'near': 2.4, 'depth': 0.07,
     'slats': slats(grille, 0.77, 1.06, 0.07, thick=0.022, back=0.012, deep=0.04, look='plastic')},
    {'kind': 'headlight', 'view': 'front', 'poly': head, 'part': 'body', 'near': 2.4, 'facing': 0.2, 'depth': 0.06, 'back': 'reflector', 'wall': 'light_back',
     'also': [{'view': 'side', 'poly': head_side, 'near': 0.8, 'facing': 0.35}],
     'bands': [{'test': lambda u, z: u > 0.86, 'look': 'lamp_amber'}], 'lenses': [(0.72, 1.04, 0.035)]},
    {'kind': 'intake', 'view': 'front', 'poly': [(0.0, 0.4), (0.5, 0.4), (0.46, 0.5), (0.0, 0.5)], 'near': 2.4, 'depth': 0.04, 'on_looks': ('plastic',),
     'slats': slats([(0.0, 0.4), (0.5, 0.4), (0.46, 0.5), (0.0, 0.5)], 0.42, 0.48, 0.03, thick=0.01, back=0.01, deep=0.02, look='plastic')},
    {'kind': 'headlight', 'view': 'front', 'poly': [(0.66, 0.42), (0.78, 0.42), (0.8, 0.5), (0.68, 0.52)], 'near': 2.4, 'depth': 0.03, 'on_looks': ('plastic',), 'back': 'reflector'},
    # Black along its foot
    {'kind': 'paint', 'view': 'side', 'look': 'plastic', 'poly': [(-2.85, 0.38), (2.2, 0.38), (2.2, 0.68), (-2.85, 0.68)], 'near': 0.8, 'facing': 0.3},
    # The sliding door's rail behind it
    {'kind': 'paint', 'view': 'side', 'both': False, 'look': 'satin_chrome', 'poly': [(-2.55, 1.255), (-1.03, 1.255), (-1.03, 1.285), (-2.55, 1.285)], 'near': 0.8, 'facing': 0.4},
  ]
  return {
    'paint': {'rough': 0.36, 'metal': 0.0, 'coat_rough': 0.06},
    'tint': 0xf2f3f4,
    'wheels': {'front': 1.8, 'rear': -1.5, 'x': 0.86, 'radius': 0.356, 'rim': 0.2032, 'width': 0.235, 'arch': 0.42, 'style': 'steel', 'holes': 8, 'cap': 'plastic'},
    'creases': (7, 10),
    'lines': lines,
    'stations': stations,
    'regions': regions,
    'face': {
      'bottom': (0, 3),
      'top': (11, 14),
      'front_centre': [(0.0, 2.74, 0.45), (0.0, 2.76, 0.62), (0.0, 2.72, 0.85), (0.0, 2.71, 1.05)],
      'rear_centre': [(0.0, -2.75, 0.75), (0.0, -2.755, 1.4), (0.0, -2.755, 2.0)],
      'front_region': 'bumper.f',
      'rear_region': 'bumper.r',
    },
    'features': features,
    'mirror': {'at': (1.15, 1.5, 1.62), 'size': (0.17, 0.08, 0.3), 'look': 'plastic', 'stalk': 'plastic', 'round': 0.3},
    'handles': [{'part': 'door.f#', 'y': 0.72, 'z': 1.14, 'look': 'plastic', 'length': 0.14}, {'part': 'door.side', 'side': 'r', 'y': 0.36, 'z': 1.12, 'look': 'plastic', 'length': 0.14}],
    'plates': [{'view': 'front', 'z': 0.6, 'out': 0.004, 'part': 'bumper.f', 'text': 'GXM 2391', 'size': (0.305, 0.152)}, {'view': 'rear', 'z': 0.43, 'out': 0.004, 'part': 'bumper.r', 'text': 'GXM 2391'}],
    'wipers': [{'from': (0.55, 1.83, 1.42), 'to': (-0.2, 1.74, 1.47)}, {'from': (-0.25, 1.86, 1.42), 'to': (-0.86, 1.73, 1.45)}],
    'exhausts': [{'at': (-0.6, -2.62, 0.38), 'r': 0.032}],
    'extras': [van_back],
  }


def van_back(design, tree, look):
  """The van's step at the back (on its bumper), the barn doors' handle and hinges."""
  import bmesh
  import bpy
  from mathutils import Matrix, Vector
  import car_model
  out = {}
  step = car_model.Mesh('step')
  b = car_model.rounded_box((1.5, 0.22, 0.06), 0.25)
  step.add(b, 'plastic', Matrix.Translation((0, -2.83, 0.4)))
  for x in (-0.5, 0.5):
    s = bmesh.new()
    bmesh.ops.create_cube(s, size=1)
    bmesh.ops.scale(s, vec=(0.06, 0.14, 0.06), verts=s.verts)
    step.add(s, 'plastic', Matrix.Translation((x, -2.73, 0.4)))
  out['bumper.r'] = step.object(design)
  for side in ('r', 'l'):
    sx = 1 if side == 'r' else -1
    m = car_model.Mesh('barn')
    # The handle on the right door, near its inner edge; two hinges on its outer edge
    if side == 'r':
      h = car_model.rounded_box((0.16, 0.03, 0.035), 0.4)
      m.add(h, 'plastic', Matrix.Translation((0.14, -2.775, 1.2)))
    for z in (0.95, 2.05):
      g = car_model.rounded_box((0.07, 0.04, 0.09), 0.3)
      m.add(g, 'plastic', Matrix.Translation((sx * 0.84, -2.77, z)))
    out[f'door.b{side}'] = m.object(design)
  return out


DESIGNS = {'sedan': sedan, 'taxi': taxi, 'van': van}
