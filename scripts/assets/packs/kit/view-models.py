#!/usr/bin/env python3
# The kit's view models (PACK=kit): the raw Tripo takes of the launcher, the rocket and the machine
# gun (assets-src/packs/kit/props/raw/<name>/model.glb) to public/packs/kit/models/<name>.glb and
# index.json, which src/demo/launcher.ts (loadKit) reads.
#
#   PACK=kit ~/.local/bin/blender -b --factory-startup --python scripts/assets/packs/kit/view-models.py [-- launcher rocket gun] [--no-render]
#
# Not process-props.py: these are held and fired, not thrown about, so no collider and no mass, and
# what the game needs is where the tube or the barrel is. Each take is welded, decimated to its
# budget, squared to the axes with its length along -Z (three.js; `yaw` turns the muzzle or the nose
# that way), scaled to `metres`, and mirrored if the take shows the other side (`mirror`); then its
# axis is found (circles fitted to the ends of the tube, to the gun's muzzle brake and shroud, or the
# rocket's middle) and laid exactly along -Z, with the origin on it: at the pistol grip for the
# launcher and the gun (what the view model turns about), halfway along for the rocket (what it spins
# about). index.json gives the launcher's muzzle and rear on that axis, and the gun's muzzle and
# ejection port (`eject`, from props.mjs). The gun's magazine is cut off as a mesh of its own, a
# child named 'magazine' (`magazine`, below). The maps stay PBR: colour, normal, and Tripo's
# occlusion / roughness / metalness texture (its roughness remapped by the prop's `roughnessRemap`,
# then kept within its `roughness` and `metalness`), whose occlusion (blank as it comes) gets an AO
# bake: the world's screen-space AO doesn't reach the view model.

import json
import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from io_scene_gltf2.blender.com.material_helpers import create_settings_group, get_gltf_node_name
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[4]
os.environ['PACK'] = 'kit'
# process-props.py's helpers (import, weld, decimate, export, previews). It calls main() on its last
# line, so run everything but that.
_src = ROOT / 'scripts/assets/process-props.py'
pp = {'__file__': str(_src), '__name__': 'process_props'}
exec(compile(_src.read_text().rsplit('\nmain()', 1)[0], str(_src), 'exec'), pp)

OUT, RAW, INDEX = pp['OUT'], pp['RAW'], pp['INDEX']
import_glb = pp['import_glb']
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
NO_RENDER = '--no-render' in argv
ONLY = [a for a in argv if not a.startswith('--')]


def circle(p):
  """Least-squares circle through 2D points: (centre, radius)."""
  A = np.c_[2 * p, np.ones(len(p))]
  b = (p ** 2).sum(1)
  (cx, cy, c), *_ = np.linalg.lstsq(A, b, rcond=None)
  return np.array([cx, cy]), math.sqrt(c + cx * cx + cy * cy)


def end_circle(v, at, depth):
  """The circle of the tube or barrel at y = at (an end, or the gun's shroud): the vertices within
  `depth` of it, seen along Y (x, z)."""
  s = v[np.abs(v[:, 1] - at) < depth]
  centre, r = circle(s[:, [0, 2]])
  # Ignore what stands off the rim (a sight post, a bracket) and fit again
  d = np.linalg.norm(s[:, [0, 2]] - centre, axis=1)
  centre, r = circle(s[d < r * 1.15][:, [0, 2]])
  return np.array([centre[0], at, centre[1]]), r


def align(obj, a, b):
  """Turn and move the mesh so the axis a -> b (Blender) runs along +Y through the origin."""
  d = Vector(b - a).normalized()
  pp['transform'](obj, d.rotation_difference(Vector((0, 1, 0))).to_matrix().to_4x4() @ Matrix.Translation(Vector(-a)))


def hold(obj, back, front, below):
  """Lay the axis back -> front along +Y, then slide the origin along it to the pistol grip: what
  hangs more than `below` m under the axis comes in two lumps (the launcher's two grips, the gun's
  magazine and grip), split at the widest gap along the axis; the grip is the one behind. Returns
  the lumps' ends along the axis, from the back (before the slide)."""
  align(obj, back, front)
  v = pp['verts_of'](obj)
  y = np.sort(v[v[:, 2] < -below][:, 1])
  split = np.argmax(np.diff(y))
  pp['transform'](obj, Matrix.Translation(Vector((0, -y[:split + 1].mean(), 0))))
  return y[0], y[split], y[split + 1], y[-1]


def bake_occlusion(obj, distance=0.06, samples=128):
  """Ambient occlusion baked (Cycles, rays out to `distance` m) into the red channel of the
  occlusion / roughness / metalness map, and that channel wired to the exporter's occlusion. Returns
  the mean over the texels in use."""
  scene = bpy.context.scene
  scene.render.engine = 'CYCLES'
  pp['use_gpu'](scene)
  scene.cycles.samples = samples
  scene.world = bpy.data.worlds.new('bake')
  scene.world.light_settings.distance = distance
  nt = obj.material_slots[0].material.node_tree
  orm = next(n.image for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image.name.endswith('_metal_rough'))
  w, h = orm.size
  ao = bpy.data.images.new('ao', w, h, float_buffer=True, is_data=True)
  target = nt.nodes.new('ShaderNodeTexImage')
  target.image = ao
  nt.nodes.active = target
  for o in scene.objects:
    o.select_set(o == obj)
  bpy.context.view_layer.objects.active = obj
  bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
  nt.nodes.remove(target)
  a = np.empty(w * h * 4, np.float32)
  ao.pixels.foreach_get(a)
  b = np.empty(w * h * 4, np.float32)
  orm.pixels.foreach_get(b)
  b[0::4] = a[0::4]
  orm.pixels.foreach_set(b)
  orm.update()
  group = bpy.data.node_groups.get(get_gltf_node_name()) or create_settings_group(get_gltf_node_name())
  out = nt.nodes.new('ShaderNodeGroup')
  out.node_tree = group
  split = next(n for n in nt.nodes if n.type == 'SEPARATE_COLOR')
  nt.links.new(split.outputs['Red'], out.inputs['Occlusion'])
  covered = a[0::4][a[0::4] > 0]
  return float(covered.mean())


def mirror(obj):
  """Mirror the mesh left to right (X), its faces turned back out. The UVs stay: the maps go with it."""
  pp['transform'](obj, Matrix.Scale(-1, 4, Vector((1, 0, 0))))
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
  bm.to_mesh(obj.data)
  bm.free()


def remap_roughness(obj, points):
  """Roughness (the metal/rough map's green) through `points` [[from...], [to...]], straight between
  them and held at the ends. It makes a glossy take rougher and keeps its order and spread (rubber
  rougher than paint), where a clamp (`roughness`) flattens it to one value."""
  img = pp['linked_image'](pp['principled'](obj.material_slots[0].material).inputs['Roughness'])
  a = pp['pixels_of'](img)
  a[..., 1] = np.interp(a[..., 1], *points)
  pp['store_pixels'](img, a)
  print(f'  roughness remapped {points[0]} -> {points[1]}')


def magazine(obj, cut):
  """Cut the magazine off as a mesh of its own: what hangs under the plane `cut` m under the axis
  (the receiver's underside), joined to the lowest point (the magazine's foot; the grip and the
  trigger guard are pieces of their own). It's a child of the gun named 'magazine', its origin in
  the middle of its top, where it seats. Returns it."""
  bm = bmesh.new()
  bm.from_mesh(obj.data)
  bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, -cut), plane_no=(0, 0, 1))

  def under(f):
    return all(v.co.z < -cut + 1e-6 for v in f.verts)

  foot = min(bm.verts, key=lambda v: v.co.z)
  inside = set(foot.link_faces)
  todo = list(inside)
  # Through shared corners, not only edges: the decimated take has faces meeting at a corner alone
  while todo:
    for v in todo.pop().verts:
      for f in v.link_faces:
        if f not in inside and under(f):
          inside.add(f)
          todo.append(f)
  # The copy keeps the faces' order: the magazine is the same faces in it
  bm.faces.index_update()
  picked = {f.index for f in inside}
  part = bm.copy()
  part.faces.index_update()
  bmesh.ops.delete(bm, geom=list(inside), context='FACES')
  bm.to_mesh(obj.data)
  bm.free()
  bmesh.ops.delete(part, geom=[f for f in part.faces if f.index not in picked], context='FACES')
  top = np.array([v.co[:] for v in part.verts if abs(v.co.z + cut) < 1e-4]).mean(0)
  mesh = bpy.data.meshes.new('magazine')
  part.to_mesh(mesh)
  part.free()
  mesh.materials.append(obj.data.materials[0])
  mesh.transform(Matrix.Translation(Vector(-top)))
  mag = bpy.data.objects.new('magazine', mesh)
  bpy.context.scene.collection.objects.link(mag)
  mag.parent = obj
  mag.location = Vector(top)
  return mag


def export(obj, path):
  """process-props.py's export of the object and its children: that one selects only the object,
  and the exporter leaves out what isn't selected. Its settings are a copy of that one's, to keep in
  step with it (tests/gun-model.test.ts checks they match)."""
  for o in bpy.context.scene.objects:
    o.select_set(o == obj or o.parent == obj)
  bpy.context.view_layer.objects.active = obj
  path.parent.mkdir(parents=True, exist_ok=True)
  bpy.ops.export_scene.gltf(
    filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
    export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
    export_image_format='WEBP', export_image_quality=pp['WEBP_QUALITY'], export_animations=False,
    export_skins=False, export_morph=False, export_cameras=False, export_lights=False, export_extras=False,
  )


def lifted(path):
  """An import standing the model on the ground (its origin is on its axis): the previews'."""
  meshes = import_glb(path)
  low = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in meshes)
  for o in meshes:
    if o.parent is None:
      o.location.z -= low
  bpy.context.view_layer.update()
  return meshes


def process(prop):
  name = prop['name']
  pp['reset']()
  meshes = import_glb(RAW / name / 'model.glb')
  raw_tris = sum(pp['tri_count'](o.data) for o in meshes)
  obj = pp['flatten_and_join'](meshes, name)
  pp['weld'](obj)
  pp['decimate'](obj, prop['maxTriangles'])
  # Square to the axes, front (+Y in Blender, -Z in three.js) by `yaw`, to size; origin at the bottom centre
  pp['orient_scale_place'](obj, prop)
  if prop.get('mirror'):
    mirror(obj)
  v = pp['verts_of'](obj)
  lo, hi = v.min(0), v.max(0)
  length = hi[1] - lo[1]
  entry = {'file': f'{name}.glb'}
  if name == 'launcher':
    front, r_front = end_circle(v, hi[1], 0.015 * length)
    back, r_back = end_circle(v, lo[1], 0.015 * length)
    lumps = hold(obj, back, front, 2.2 * r_front)
    v = pp['verts_of'](obj)
    entry['muzzle'] = [0.0, 0.0, -round(float(v[:, 1].max()), 4)]
    entry['rear'] = [0.0, 0.0, -round(float(v[:, 1].min()), 4)]
    print(f'[{name}] muzzle rim r {r_front:.3f}, rear rim r {r_back:.3f}; grips at {lumps[0]:.3f}..{lumps[1]:.3f} and {lumps[2]:.3f}..{lumps[3]:.3f} m from the rear')
  elif name == 'gun':
    # The barrel's axis: circles fitted to the end of the muzzle brake and to the shroud a quarter
    # of the way back (clear of the front sight)
    front, r_front = end_circle(v, hi[1], 0.015 * length)
    back, r_back = end_circle(v, hi[1] - 0.25 * length, 0.01 * length)
    lumps = hold(obj, back, front, 0.15 * length)
    v = pp['verts_of'](obj)
    entry['muzzle'] = [0.0, 0.0, -round(float(v[:, 1].max()), 4)]
    entry['eject'] = prop['eject']
    print(f'[{name}] bore r {r_front:.3f}, shroud r {r_back:.3f}; grip at {lumps[0]:.3f}..{lumps[1]:.3f}, magazine at {lumps[2]:.3f}..{lumps[3]:.3f} m from the shroud')
  else:
    # Symmetric about its axis (fins and all): the bounding box's middle
    c = (lo + hi) / 2
    align(obj, np.array([c[0], lo[1], c[2]]), np.array([c[0], hi[1], c[2]]))
    pp['transform'](obj, Matrix.Translation(Vector((0, -length / 2, 0))))
    v = pp['verts_of'](obj)
  pp['reshade'](obj)
  pp['tidy_names'](obj, name)
  textures = pp['shrink_textures'](obj, prop['textureSize'])
  if prop.get('roughnessRemap'):
    remap_roughness(obj, prop['roughnessRemap'])
  pp['limit_maps'](obj, prop)
  occlusion = bake_occlusion(obj)
  if prop.get('magazine'):
    mag = magazine(obj, prop['magazine'])
    print(f'[{name}] magazine: {pp["tri_count"](mag.data)} tris, seated at {[round(float(x), 4) for x in pp["to_three"](mag.location)]}')
  out = OUT / f'{name}.glb'
  export(obj, out)
  lo, hi = v.min(0), v.max(0)
  entry['size'] = [round(float(s), 4) for s in np.abs(np.array(pp['to_three'](hi - lo)))]
  entry['triangles'] = pp['glb_triangles'](out)
  entry['description'] = prop['description']
  print(f'[{name}] raw {raw_tris} tris -> {entry["triangles"]}; textures {textures}; mean occlusion {occlusion:.2f}; size {entry["size"]} m; {out.stat().st_size / 1e6:.2f} MB')
  return entry


def main():
  pp['import_glb'] = lifted  # what render_preview imports with
  props = [p for p in pp['load_props']() if not ONLY or p['name'] in ONLY]
  index = json.loads(INDEX.read_text()) if INDEX.exists() else {}
  for prop in props:
    index[prop['name']] = process(prop)
    INDEX.write_text(json.dumps(index, indent=2) + '\n')
    if not NO_RENDER:
      dev, outs = pp['render_preview'](OUT / f'{prop["name"]}.glb', prop['name'])
      print(f'[{prop["name"]}] preview ({dev}): {", ".join(outs)}')


main()
