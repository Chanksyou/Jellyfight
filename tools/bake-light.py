# Bakes an act's light into its shell picture with Blender's Cycles (tools/bake-light.mjs runs it).
#   python3 tools/bake-light.py <act.glb> <lights.json> <out folder> [samples]
# Needs Blender as a Python module: pip install bpy (Blender 5.3; CPU is enough, a graphics card is used if there is one).
# In: the act as played (tools/bake-light-page.js: the shell meshes, named "shell:...", carry a second UV map
# laid out on the shell picture; "fixture:..." are the pieces round a lamp) and the light list.
# Out: <out>/<set>.webp, one per light set (the lamps; act 4's daylight too), top row first: the light reaching
# each texel per unit of albedo (diffuse direct + bounce), divided by the act's top value and sRGB-encoded
# (the game's GPU decodes it), and the top value in the log line. Needs Pillow for WebP (pip install pillow).
import bpy, json, sys, os, time, math
from mathutils import Vector
import numpy as np
from PIL import Image

glb, lights_file, out = sys.argv[1:4]
L = json.load(open(lights_file))
samples = int(sys.argv[4]) if len(sys.argv) > 4 else (L.get('samples') or 256)
W, H = L['atlas']
t0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=glb)

# every surface diffuse only, no glow of its own: the bake is light arriving, its colour comes from the game's textures
shell = []
for o in scene.objects:
    if o.type != 'MESH':
        continue
    for slot in o.material_slots:
        m = slot.material
        b = m and m.node_tree and next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b:
            b.inputs['Roughness'].default_value = 1.0
            b.inputs['Metallic'].default_value = 0.0
            for k in ('Specular IOR Level', 'Emission Strength', 'Coat Weight', 'Sheen Weight'):
                if k in b.inputs: b.inputs[k].default_value = 0.0
    if o.name.startswith('fixture:'):
        o.visible_shadow = False          # a lamp's own shade and bulb don't shadow it
    if o.name.startswith('shell:'):
        shell.append(o)

img = bpy.data.images.new('ShellLight', W, H, float_buffer=True, alpha=True)
img.colorspace_settings.name = 'Non-Color'
for o in shell:
    uv = o.data.uv_layers
    if len(uv) < 2:
        raise SystemExit(f'{o.name} has no shell UV map')
    uv.active = uv[1]                     # bake into the shell picture; textures keep reading the first map (active_render)
    uv[0].active_render = True
    for slot in o.material_slots:
        nt = slot.material.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.nodes.active = tex

def light(spec):
    kind = spec['kind']
    d = bpy.data.lights.new(spec.get('name', kind), {'point': 'POINT', 'spot': 'SPOT', 'sun': 'SUN', 'area': 'AREA'}[kind])
    d.color = spec['color'][:3]
    d.energy = spec['watts'] if kind != 'sun' else spec['strength']
    o = bpy.data.objects.new(d.name, d)
    scene.collection.objects.link(o)
    if kind in ('point', 'spot'):
        d.shadow_soft_size = spec.get('radius', 0.03)
        o.location = spec['at']
    if kind == 'spot':
        d.spot_size = min(math.pi, 2 * spec['angle'])
        d.spot_blend = spec.get('blend', 0.3)
        o.rotation_euler = (Vector(spec['to']) - Vector(spec['at'])).to_track_quat('-Z', 'Y').to_euler()
    if kind == 'sun':
        d.angle = math.radians(spec.get('soft', 2))
        o.rotation_euler = Vector(spec['dir']).normalized().to_track_quat('-Z', 'Y').to_euler()
    if kind == 'area':
        d.shape = 'RECTANGLE'
        d.size, d.size_y = spec['size']
        o.location = spec['at']
        o.rotation_euler = Vector(spec['dir']).normalized().to_track_quat('-Z', 'Y').to_euler()
        if 'spread' in spec: d.spread = math.radians(spec['spread'])
    return o

# Cycles has no denoiser for bakes: a cross-bilateral filter over the covered texels smooths the sampling
# noise, keeping shadow edges (texels that differ a lot in brightness don't blend) and never reading
# uncovered texels (other planes' gaps)
def denoise(rgb, covered, radius=3, passes=2, spread=0.35):
    mask = covered.astype(np.float32)
    lum = lambda c: c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722
    for _ in range(passes):
        acc = np.zeros_like(rgb); wsum = np.zeros(rgb.shape[:2], np.float32)
        l0 = lum(rgb)
        pad = lambda a: np.pad(a, [(radius, radius), (radius, radius)] + [(0, 0)] * (a.ndim - 2))
        prgb, pl, pm = pad(rgb), pad(l0), pad(mask)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                sl = (slice(radius + dy, radius + dy + rgb.shape[0]), slice(radius + dx, radius + dx + rgb.shape[1]))
                rel = (pl[sl] - l0) / (spread * (l0 + pl[sl]) * 0.5 + 1e-4)
                w = pm[sl] * np.exp(-(dx * dx + dy * dy) / (2 * (radius * 0.6) ** 2) - rel * rel)
                acc += prgb[sl] * w[..., None]; wsum += w
        rgb = np.where(wsum[..., None] > 0, acc / np.maximum(wsum, 1e-8)[..., None], rgb)
    return (rgb * mask[..., None]).astype(np.float32)

made = {}
for spec in L['lamps'] + L['extra']:
    made.setdefault(spec.get('set', 'lamps'), []).append(light(spec))

world = bpy.data.worlds.new('Night')
world.use_nodes = True
scene.world = world
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0   # the game's own fill stays live

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
device = 'CPU'
for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type != 'CPU']
        if gpus:
            for d in prefs.devices: d.use = d.type != 'CPU'
            scene.cycles.device = 'GPU'
            device = kind
            break
    except Exception:
        pass
scene.cycles.samples = samples
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 0
scene.cycles.transmission_bounces = 0
scene.cycles.sample_clamp_indirect = 4.0     # fireflies from bounce off small bright spots
bake = scene.render.bake
bake.use_pass_direct = True
bake.use_pass_indirect = True
bake.use_pass_color = False
bake.margin = 3
bake.margin_type = 'EXTEND'

bpy.ops.object.select_all(action='DESELECT')
for o in shell: o.select_set(True)
bpy.context.view_layer.objects.active = shell[0]

pictures = {}
log = {'device': device, 'samples': samples, 'shell_objects': len(shell), 'sets': {}}
for name in L['sets']:
    for s, objs in made.items():
        for o in objs: o.hide_render = s != name
    tb = time.time()
    img.pixels.foreach_set(np.zeros(W * H * 4, dtype=np.float32))   # alpha 0: the bake marks the texels it covers
    bpy.ops.object.bake(type='DIFFUSE', use_clear=False)
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)[::-1]   # Blender's rows start at the bottom
    pictures[name] = denoise(px[:, :, :3], px[:, :, 3] > 0.5) * float(L.get('exposure', 1))
    log['sets'][name] = {'seconds': round(time.time() - tb, 1), 'lights': len(made.get(name, []))}

# one top value for the act (both of act 4's pictures): a hair under the brightest texels, so a few hot ones
# right under a bulb clip instead of costing every other texel its precision
lit = np.concatenate([p.max(axis=2).ravel() for p in pictures.values()])
lit = lit[lit > 1e-5]
top = float(np.percentile(lit, 99.9)) if lit.size else 1.0
for name, rgb in pictures.items():
    c = np.clip(rgb / top, 0, 1)
    c = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    Image.fromarray((c * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(out, name + '.webp'), 'WEBP', quality=int(L.get('quality', 88)), method=6)
log['top'] = round(top, 5)
log['seconds'] = round(time.time() - t0, 1)
print('JELLY_BAKE_DONE ' + json.dumps(log), flush=True)
