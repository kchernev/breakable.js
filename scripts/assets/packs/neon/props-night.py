# Night previews of Neon Alley's finished props (after props-post.py, which process-props.py's own
# previews come before): each lineup of models from public/packs/neon/models stands on a dark wet
# floor under a deep blue sky with a cyan, a magenta and an amber light, seen from the front. A
# copy's paint is tinted as the game draws it: the colour map times its tint where the map's alpha
# says (process-props.py's `paint`; without a tint, the model's own from index.json).
#
#   blender -b --factory-startup --python scripts/assets/packs/neon/props-night.py
#
# Writes assets-src/packs/neon/props/previews/night_<lineup>.png.

import json
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
MODELS = ROOT / 'public/packs/neon/models'
PREVIEWS = ROOT / 'assets-src/packs/neon/props/previews'

# Tints as src/demo/worlds/neon/props.ts gives them
RED, CHARCOAL, POWDER, BUTTER = 0xd04848, 0x50545c, 0x9cc4f0, 0xf8dc78
BLUE, YELLOW, GREEN, GREY = 0x3a78e8, 0xf8c830, 0x48b060, 0x8a9096
LINEUPS = {
  'props': [('bin', None), ('crate', None), ('crates', None), ('cart', None), ('scooter', None)],
  'scooters': [('scooter', CHARCOAL), ('scooter', BUTTER), ('scooter', POWDER), ('scooter', RED), ('scooter', None)],
  'plastics': [('bin', BLUE), ('bin', GREY), ('bin', None), ('crate', YELLOW), ('crate', BLUE), ('crate', None), ('crates', GREEN), ('crates', None)],
}
INDEX = json.loads((MODELS / 'index.json').read_text())


def linear(hex_):
  c = [((hex_ >> s) & 255) / 255 for s in (16, 8, 0)]
  return [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]


def tint(objects, colour):
  """The colour map times `colour` as far as its alpha says."""
  for o in objects:
    for slot in o.material_slots:
      nt = slot.material.node_tree
      bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
      tex = bsdf.inputs['Base Color'].links[0].from_node
      mix = nt.nodes.new('ShaderNodeMix')
      mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
      nt.links.new(tex.outputs['Alpha'], mix.inputs['Factor'])
      nt.links.new(tex.outputs['Color'], mix.inputs[6])
      mix.inputs[7].default_value = (*linear(colour), 1)
      nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])


def gpu(scene):
  prefs = bpy.context.preferences.addons['cycles'].preferences
  for kind in ('OPTIX', 'CUDA'):
    try:
      prefs.compute_device_type = kind
      prefs.refresh_devices()
    except TypeError:
      continue
    devs = [d for d in prefs.devices if d.type == kind]
    if devs:
      # Prefer a card that isn't driving the desktop (the A4000 here)
      pick = [d for d in devs if 'A4000' in d.name] or devs
      for d in prefs.devices:
        d.use = d in pick
      scene.cycles.device = 'GPU'
      return


def render(name, models):
  bpy.ops.wm.read_factory_settings(use_empty=True)
  scene = bpy.context.scene
  # Side by side along x with 0.5 m between (Blender frame: the fronts face +Y)
  x, prev = 0.0, 0.0
  for m, colour in models:
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(MODELS / f'{m}.glb'))
    new = [o for o in scene.objects if o not in before]
    colour = colour or INDEX[m].get('tint')
    if colour is not None:
      tint([o for o in new if o.type == 'MESH'], colour)
    xs = [(o.matrix_world @ v.co).x for o in new if o.type == 'MESH' for v in o.data.vertices]
    width = max(xs) - min(xs)
    x += prev / 2 + width / 2 + (0.5 if prev else 0)
    prev = width
    for o in new:
      if o.parent is None:
        o.location.x += x
  mid, span = x / 2, x + prev / 2

  bpy.ops.mesh.primitive_plane_add(size=80, location=(mid, 0, 0))
  wet = bpy.data.materials.new('wet')
  wet.use_nodes = True
  bsdf = wet.node_tree.nodes['Principled BSDF']
  bsdf.inputs['Base Color'].default_value = (0.02, 0.022, 0.026, 1)
  bsdf.inputs['Roughness'].default_value = 0.12
  bpy.context.active_object.data.materials.append(wet)

  world = bpy.data.worlds.new('night')
  world.use_nodes = True
  world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.035, 0.09, 1)
  scene.world = world
  target = Vector((mid, 0, 0.6))
  for label, loc, colour, energy in (
    ('cyan', (mid - span * 0.3, 3.0, 3.5), (0.2, 0.9, 1.0), 900),
    ('magenta', (mid + span * 0.3, 2.5, 3.0), (1.0, 0.2, 0.7), 900),
    ('amber', (mid, -3.0, 4.0), (1.0, 0.6, 0.25), 500),
  ):
    light = bpy.data.lights.new(label, 'AREA')
    light.energy, light.color, light.size = energy, colour, 2.0
    o = bpy.data.objects.new(label, light)
    o.location = loc
    o.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(o)

  cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
  cam.data.lens = 35
  scene.collection.objects.link(cam)
  scene.camera = cam
  cam.location = (mid, span * 1.0 + 1.2, 1.8)  # a 35 mm lens sees about 54° across: the whole lineup with a margin
  cam.rotation_euler = (Vector((mid, 0, 0.7)) - cam.location).to_track_quat('-Z', 'Y').to_euler()

  scene.render.engine = 'CYCLES'
  gpu(scene)
  scene.cycles.samples = 128
  scene.cycles.use_denoising = True
  scene.render.resolution_x, scene.render.resolution_y = 1400, 600
  scene.view_settings.view_transform = 'AgX'
  scene.view_settings.look = 'AgX - Punchy'
  scene.render.filepath = str(PREVIEWS / f'night_{name}.png')
  bpy.ops.render.render(write_still=True)
  print(f'[{name}] {scene.render.filepath}')


for name, models in LINEUPS.items():
  render(name, models)
