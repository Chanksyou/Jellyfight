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

# The furniture's light grid: a 2 cm cube at every point outside the solids, each face one texel of the grid
# picture, so baking it gives the light arriving from each of 6 directions (+x, -x, +y, -y, +z, -z in the game's
# axes). Nothing else sees the cubes. Picture layout: column f * W + x, row z * H + y (the game's grid indices).
G = L.get('grid')
grid_obj = grid_img = None
if G:
    gw, gh, gd = G['dims']
    inside = np.fromfile(G['inside'], dtype=np.uint8).reshape(gd, gh, gw)
    GW, GH = gw * 6, gh * gd
    zz, yy, xx = np.nonzero(inside == 0)
    n = len(xx)
    c = np.stack([G['min'][0] + xx * G['step'], G['min'][1] + yy * G['step'], G['min'][2] + zz * G['step']], 1)   # game x, y, z
    h = 0.01
    # each face: 4 corners (game axes) offset from the centre, and its direction index
    faces = []
    for f, (ax, sg) in enumerate([(0, 1), (0, -1), (1, 1), (1, -1), (2, 1), (2, -1)]):
        a, b = [(1, 2), (2, 0), (0, 1)][ax]   # a x b = +ax, so the corners run counter-clockwise seen from outside
        quad = []
        for (ua, ub) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            o = np.zeros(3); o[ax] = sg * h; o[a] = ua * h; o[b] = ub * h * sg   # winding flips with the side, so the face looks outward
            quad.append(o)
        faces.append((f, quad))
    verts = np.zeros((n, 24, 3), np.float32)
    uvs = np.zeros((n, 24, 2), np.float32)
    for f, quad in faces:
        u0 = (f * gw + xx) / GW
        v0 = 1 - (zz * gh + yy + 1) / GH            # Blender's v starts at the bottom row
        for k, (o, (du, dv)) in enumerate(zip(quad, ((0.05, 0.05), (0.95, 0.05), (0.95, 0.95), (0.05, 0.95)))):
            verts[:, f * 4 + k] = c + o
            uvs[:, f * 4 + k] = np.stack([u0 + du / GW, v0 + dv / GH], 1)
    bverts = verts[..., [0, 2, 1]] * np.array([1, -1, 1], np.float32)   # three (x, y, z) -> Blender (x, -z, y)
    mesh = bpy.data.meshes.new('grid')
    mesh.vertices.add(n * 24)
    mesh.vertices.foreach_set('co', bverts.ravel())
    mesh.loops.add(n * 24)
    mesh.loops.foreach_set('vertex_index', np.arange(n * 24, dtype=np.int32))
    mesh.polygons.add(n * 6)
    mesh.polygons.foreach_set('loop_start', np.arange(0, n * 24, 4, dtype=np.int32))
    mesh.update()
    uvl = mesh.uv_layers.new(name='grid')
    uvl.data.foreach_set('uv', uvs.ravel())
    grid_obj = bpy.data.objects.new('grid', mesh)
    scene.collection.objects.link(grid_obj)
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(grid_obj, k, False)
    grid_img = bpy.data.images.new('GridLight', GW, GH, float_buffer=True, alpha=True)
    grid_img.colorspace_settings.name = 'Non-Color'
    gm = bpy.data.materials.new('grid')
    gm.use_nodes = True
    gb = next(nd for nd in gm.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
    gb.inputs['Base Color'].default_value = (1, 1, 1, 1)
    gb.inputs['Roughness'].default_value = 1.0
    gt = gm.node_tree.nodes.new('ShaderNodeTexImage')
    gt.image = grid_img
    gm.node_tree.nodes.active = gt
    mesh.materials.append(gm)
    # check the faces look outward: the +x face of the first cube must point along Blender's +x
    nrm = np.zeros(n * 6 * 3, np.float32); mesh.polygons.foreach_get('normal', nrm)
    want = np.array([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0]], np.float32)   # game +x -x +y -y +z -z in Blender's axes
    assert np.allclose(nrm[:18].reshape(6, 3), want, atol=1e-3), f'grid faces look the wrong way: {nrm[:18]}'

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

# a point inside a solid takes the mean of its lit neighbours, spreading outward until every point has light
def fill_inside(g, inside):
    g = g.copy(); todo = inside.astype(bool).copy()
    for _ in range(64):
        if not todo.any(): break
        acc = np.zeros_like(g); cnt = np.zeros(todo.shape, np.float32)
        for ax in (0, 1, 2):
            for d in (1, -1):
                ok = np.roll(~todo, d, axis=ax); val = np.roll(g, d, axis=ax + 1)
                edge = [slice(None)] * 3; edge[ax] = 0 if d == 1 else -1; ok[tuple(edge)] = False   # no wrapping round the grid
                acc += val * ok[None, ..., None]; cnt += ok
        now = todo & (cnt > 0)
        g[:, now] = acc[:, now] / cnt[now][None, :, None]
        todo &= ~now
    return g

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
if grid_obj: grid_obj.select_set(True)
bpy.context.view_layer.objects.active = shell[0]

pictures, grids = {}, {}
log = {'device': device, 'samples': samples, 'shell_objects': len(shell), 'sets': {}}
for name in L['sets']:
    for s, objs in made.items():
        for o in objs: o.hide_render = s != name
    tb = time.time()
    img.pixels.foreach_set(np.zeros(W * H * 4, dtype=np.float32))   # alpha 0: the bake marks the texels it covers
    if grid_img: grid_img.pixels.foreach_set(np.zeros(GW * GH * 4, dtype=np.float32))
    bpy.ops.object.bake(type='DIFFUSE', use_clear=False)
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)[::-1]   # Blender's rows start at the bottom
    pictures[name] = denoise(px[:, :, :3], px[:, :, 3] > 0.5) * float(L.get('exposure', 1))
    if grid_img:
        gx = np.empty(GW * GH * 4, dtype=np.float32)
        grid_img.pixels.foreach_get(gx)
        gx = gx.reshape(GH, GW, 4)[::-1, :, :3] * float(L.get('exposure', 1))
        grids[name] = fill_inside(gx.reshape(gd, gh, 6, gw, 3).transpose(2, 0, 1, 3, 4), inside)   # [f, z, y, x, rgb]
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
if grids:
    # the grid: values are smooth, so a square root keeps the dark end (the GPU interpolates, then the game squares)
    gtop = float(np.percentile(np.concatenate([g.max(axis=4).ravel() for g in grids.values()]), 99.9)) or 1.0
    for name, g in grids.items():
        q = np.sqrt(np.clip(g / gtop, 0, 1))                                    # [f, z, y, x, rgb]
        tile = q.transpose(1, 2, 0, 3, 4).reshape(gd * gh, 6 * gw, 3)           # row z * H + y, column f * W + x
        Image.fromarray((tile * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(out, name + '-grid.webp'), 'WEBP', quality=int(L.get('quality', 88)), method=6)
    log['gridTop'] = round(gtop, 5)
log['seconds'] = round(time.time() - t0, 1)
print('JELLY_BAKE_DONE ' + json.dumps(log), flush=True)
