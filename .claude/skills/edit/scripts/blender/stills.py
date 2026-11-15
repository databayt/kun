"""stills.py — a camera over still images, rendered headless in Blender (kun's stills film).

  blender.sh render stills.py -- scene.json outdir [--aspect landscape|portrait] [--scale 0.5]
                                 [--legs id1,id2] [--frames 1,91,180]

Schema: stills.schema.md (next to this file). Output: <outdir>/<leg>/<aspect>/00001.png ...
Colour-exact by construction: emission-only material, sRGB textures, Standard view transform,
no look, exposure 0, 1 sample, minimal film filter, no dither. Look shader nodes up by type.
"""
import bpy, json, math, os, sys, time

# ---- args ----------------------------------------------------------------------------------
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
pos = [a for a in argv if not a.startswith('--')]
def opt(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
if len(pos) < 2:
    sys.exit('usage: blender.sh render stills.py -- scene.json outdir [--aspect A] [--scale S] [--legs a,b] [--frames 1,2]')
# values of options are not positionals
vals = {opt(n) for n in ('--aspect', '--scale', '--legs', '--frames') if n in argv}
pos = [a for a in pos if a not in vals]
SCENE, OUT = os.path.abspath(pos[0]), os.path.abspath(pos[1])
ONLY_ASPECT = opt('--aspect')
SCALE = float(opt('--scale', 1))
ONLY_LEGS = opt('--legs').split(',') if opt('--legs') else None
ONLY_FRAMES = {int(x) for x in opt('--frames').split(',')} if opt('--frames') else None

spec = json.load(open(SCENE))
FPS = spec.get('fps', 30)
ASPECTS = spec.get('aspects', {'landscape': [1920, 1072], 'portrait': [1080, 2332]})
base_dir = os.path.dirname(SCENE)

def ov(obj, aspect):
    """An object with its per-aspect override ("landscape": {...} / "portrait": {...}) merged in."""
    o = dict(obj)
    o.update(obj.get(aspect, {}) or {})
    for a in ('landscape', 'portrait'):
        o.pop(a, None)
    return o

def path_of(p):
    return p if os.path.isabs(p) else os.path.join(base_dir, p)

# ---- easing --------------------------------------------------------------------------------
EASE = {
    'linear': lambda u: u,
    'inOutSine': lambda u: -(math.cos(math.pi * u) - 1) / 2,
    'inOutCubic': lambda u: 4 * u ** 3 if u < .5 else 1 - (-2 * u + 2) ** 3 / 2,
    'outCubic': lambda u: 1 - (1 - u) ** 3,
    'inCubic': lambda u: u ** 3,
}
def ease(name, u):
    return EASE.get(name or 'inOutSine', EASE['inOutSine'])(max(0.0, min(1.0, u)))

# ---- Blender scene -------------------------------------------------------------------------
def enum_ids(owner, prop):
    return [i.identifier for i in owner.bl_rna.properties[prop].enum_items]

def setup_render(scene):
    eng = [e for e in enum_ids(scene.render, 'engine') if 'EEVEE' in e]
    if not eng:
        sys.exit('no EEVEE engine in this Blender: ' + str(enum_ids(scene.render, 'engine')))
    scene.render.engine = eng[0]
    r = scene.render
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGB'
    r.image_settings.color_depth = '8'
    r.image_settings.compression = 3
    r.film_transparent = False
    r.filter_size = 0.0          # no film-filter blur: pixel-exact at 1:1
    r.dither_intensity = 0.0
    r.use_motion_blur = False
    r.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard'
    for cand in ('None', 'NONE'):      # the look enum is dynamic: read the error's list, never assume
        try:
            scene.view_settings.look = cand
            break
        except TypeError:
            pass
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.view_settings.use_curve_mapping = False
    scene.display_settings.display_device = 'sRGB'
    ee = scene.eevee
    for k, v in (('taa_render_samples', 1), ('use_gtao', False), ('use_bloom', False), ('use_ssr', False),
                 ('use_raytracing', False), ('use_shadows', False), ('use_volumetric_shadows', False)):
        if hasattr(ee, k):
            try: setattr(ee, k, v)
            except Exception: pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('stills-world')
    if hasattr(scene.world, 'color'):
        scene.world.color = (0, 0, 0)

def clear_scene():
    for o in [o for o in bpy.data.objects if o.name.startswith('i-')]:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)

def load_image(path):
    if not os.path.exists(path):
        sys.exit('missing image: ' + path)
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    return img

def make_material(img, name, size=(1, 1), feather=0.0):
    """Emission-only: texture -> emission (strength 1), mixed with transparent by
    opacity * texture alpha * edge feather."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    def math(op, a=None, b=None):
        m = N('ShaderNodeMath'); m.operation = op
        if a is not None and not isinstance(a, (int, float)): nt.links.new(a, m.inputs[0])
        elif a is not None: m.inputs[0].default_value = a
        if b is not None and not isinstance(b, (int, float)): nt.links.new(b, m.inputs[1])
        elif b is not None: m.inputs[1].default_value = b
        return m
    out, mix, tr, em, tx = (N('ShaderNodeOutputMaterial'), N('ShaderNodeMixShader'),
                            N('ShaderNodeBsdfTransparent'), N('ShaderNodeEmission'), N('ShaderNodeTexImage'))
    tx.image = img
    tx.interpolation = 'Linear'       # mipmapped on the GPU: no aliasing when zoomed far out
    tx.extension = 'EXTEND'
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(tx.outputs['Color'], em.inputs['Color'])
    opacity = math('MULTIPLY', 1.0, 1.0)            # inputs[0] = opacity (set per frame), [1] = 1
    opacity_input = opacity.inputs[0]
    chain = opacity.outputs['Value']
    if img.channels == 4 and img.alpha_mode != 'NONE' and img.depth in (32, 64, 128):
        chain = math('MULTIPLY', chain, tx.outputs['Alpha']).outputs['Value']
    if feather > 0:
        uv = N('ShaderNodeTexCoord'); sep = N('ShaderNodeSeparateXYZ')
        nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
        def edge(comp, extent):
            inv = math('SUBTRACT', 1.0, sep.outputs[comp])
            mn = math('MINIMUM', sep.outputs[comp], inv.outputs['Value'])
            return math('MULTIPLY', mn.outputs['Value'], extent).outputs['Value']
        d = math('MINIMUM', edge('X', size[0]), edge('Y', size[1]))
        t = math('DIVIDE', d.outputs['Value'], feather * min(size))
        rng = N('ShaderNodeMapRange'); rng.interpolation_type = 'SMOOTHSTEP'; rng.clamp = True
        nt.links.new(t.outputs['Value'], rng.inputs['Value'])
        chain = math('MULTIPLY', chain, rng.outputs['Result']).outputs['Value']
    nt.links.new(chain, mix.inputs['Fac'])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[1])
    nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    opacity_input.default_value = 1.0
    mat.use_backface_culling = False
    try: mat.surface_render_method = 'BLENDED'
    except Exception: pass
    try: mat.blend_method = 'BLEND'
    except Exception: pass
    return mat, opacity_input

def build_world(aspect):
    """Resolve the image tree for one aspect -> {id: node} with world rects (x, y down, w, h)."""
    clear_scene()
    nodes, order = {}, []
    for idx, raw in enumerate(spec['images']):
        im = ov(raw, aspect)
        img = load_image(path_of(im['src']))
        iw, ih = img.size
        nodes[im['id']] = dict(id=im['id'], img=img, iw=iw, ih=ih, parent=im.get('parent'), rect=im.get('rect'), idx=idx, feather=im.get('feather', 0.0))
        order.append(im['id'])
    def resolve(n):
        if 'world' in n:
            return
        if not n['parent']:
            n['depth'] = 0
            n['world'] = (0.0, 0.0, 1.0, n['ih'] / n['iw'])
            return
        p = nodes[n['parent']]
        resolve(p)
        px, py, pw, ph = p['world']
        r = n['rect']
        w = r[2] * pw
        h = r[3] * ph if len(r) > 3 else w * n['ih'] / n['iw']
        n['depth'] = p['depth'] + 1
        n['world'] = (px + r[0] * pw, py + r[1] * ph, w, h)
    for n in nodes.values():
        resolve(n)
    for n in nodes.values():
        x, y, w, h = n['world']
        z = 0.01 * n['depth'] + 0.0005 * n['idx']
        me = bpy.data.meshes.new('m-' + n['id'])
        me.from_pydata([(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(name='UV')
        for loop, c in zip(me.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            uv.data[loop.index].uv = c
        ob = bpy.data.objects.new('i-' + n['id'], me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = (x + w / 2, -(y + h / 2), z)
        mat, op = make_material(n['img'], 'mat-' + n['id'], (w, h), n['feather'])
        me.materials.append(mat)
        n['obj'], n['op'] = ob, op
    return nodes

def cam_world(nodes, key, aspect_ratio):
    """A camera key -> (cx, cy_down, visible_height) in world units."""
    n = nodes[key['image']]
    x, y, w, h = n['world']
    return (x + key['c'][0] * w, y + key['c'][1] * h, key['h'] * h)

def camera_at(keys, t, A):
    """keys: [(t, (cx, cy, vh), ease)] sorted. Returns (cx, cy, vh) at time t."""
    if t <= keys[0][0]:
        return keys[0][1]
    if t >= keys[-1][0]:
        return keys[-1][1]
    for (t0, a, _), (t1, b, e) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = ease(e, (t - t0) / (t1 - t0)) if t1 > t0 else 1.0
            vh = a[2] * math.exp(math.log(b[2] / a[2]) * u)
            if abs(math.log(b[2] / a[2])) > 0.05:
                s = (vh - a[2]) / (b[2] - a[2])     # centre follows the zoom about its fixed point
            else:
                s = u
            return (a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, vh)
    return keys[-1][1]

def spline_at(keys, t, ease_ends):
    """Catmull-Rom (uniform in time, Hermite form) through every key over (cx, cy, ln vh)."""
    P = [(k[1][0], k[1][1], math.log(k[1][2])) for k in keys]
    T = [k[0] for k in keys]
    n = len(P)
    if t <= T[0]:
        return keys[0][1]
    if t >= T[-1]:
        return keys[-1][1]
    def same(a, b):
        return all(abs(P[a][c] - P[b][c]) < 1e-9 for c in range(3))
    def tangent(i):
        # a key equal to its neighbour is a hold: zero velocity there, so the held frames don't drift
        if (i > 0 and same(i, i - 1)) or (i < n - 1 and same(i, i + 1)):
            return (0.0, 0.0, 0.0)
        if i == 0 or i == n - 1:
            if ease_ends:
                return (0.0, 0.0, 0.0)            # zero velocity at the leg ends = ease in/out
            j, k = (0, 1) if i == 0 else (n - 2, n - 1)
        else:
            j, k = i - 1, i + 1
        dt = (T[k] - T[j]) or 1.0
        return tuple((P[k][c] - P[j][c]) / dt for c in range(3))
    for i in range(n - 1):
        if T[i] <= t <= T[i + 1]:
            h = (T[i + 1] - T[i]) or 1.0
            u = (t - T[i]) / h
            m0, m1 = tangent(i), tangent(i + 1)
            h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
            v = [h00 * P[i][c] + h10 * h * m0[c] + h01 * P[i + 1][c] + h11 * h * m1[c] for c in range(3)]
            return (v[0], v[1], math.exp(v[2]))
    return keys[-1][1]

def opacity_at(keys, t, smooth, carried):
    if not keys:
        return carried
    if t <= keys[0][0]:
        return carried if keys[0][0] > 0 and t < keys[0][0] else keys[0][1]
    if t >= keys[-1][0]:
        return keys[-1][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 1.0
            if smooth:
                u = u * u * (3 - 2 * u)
            return v0 + (v1 - v0) * u
    return keys[-1][1]

# ---- main ----------------------------------------------------------------------------------
scene = bpy.context.scene
setup_render(scene)
cam_data = bpy.data.cameras.new('stills-cam')
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'HORIZONTAL'    # ortho_scale = visible width
cam_data.clip_start, cam_data.clip_end = 0.1, 100
cam = bpy.data.objects.new('stills-cam', cam_data)
scene.collection.objects.link(cam)
cam.rotation_euler = (0, 0, 0)
scene.camera = cam

t_all = time.time()
frames_done = 0
aspects = [a for a in ASPECTS if not ONLY_ASPECT or a == ONLY_ASPECT]
if not aspects:
    sys.exit('no such aspect: %s (have %s)' % (ONLY_ASPECT, list(ASPECTS)))

for aspect in aspects:
    W0, H0 = ASPECTS[aspect]
    W, H = max(2, int(round(W0 * SCALE / 2)) * 2), max(2, int(round(H0 * SCALE / 2)) * 2)
    scene.render.resolution_x, scene.render.resolution_y = W, H
    A = W0 / H0
    nodes = build_world(aspect)
    # state carries across legs: roots visible, children hidden
    last_cam = None
    state = {i: (1.0 if not n['parent'] else 0.0) for i, n in nodes.items()}
    for leg in spec['legs']:
        n_frames = int(round(leg['seconds'] * FPS))
        raw_keys = sorted(leg['keys'], key=lambda k: k['t'])
        keys = []
        for ki, k in enumerate(raw_keys):
            k = ov(k, aspect)
            if ki == 0 and leg.get('carry') and last_cam is not None:
                keys.append((k['t'], last_cam, k.get('ease')))   # join the previous leg: no jump
            else:
                keys.append((k['t'], cam_world(nodes, k, A), k.get('ease')))
        spline = leg.get('interp') == 'spline' and len(keys) > 1
        last_cam = keys[-1][1]
        op_keys = {}
        for o in leg.get('opacity', []):
            o = ov(o, aspect)
            op_keys[o['image']] = (sorted([tuple(k) for k in o['keys']]), o.get('curve') == 'smooth')
        skip = ONLY_LEGS is not None and leg['id'] not in ONLY_LEGS
        carried = dict(state)
        if not skip:
            d = os.path.join(OUT, leg['id'], aspect)
            os.makedirs(d, exist_ok=True)
            t_leg = time.time()
            done_leg = 0
            for fi in range(n_frames):
                if ONLY_FRAMES is not None and (fi + 1) not in ONLY_FRAMES:
                    continue
                t = fi / FPS
                cx, cy, vh = spline_at(keys, t, leg.get('easeEnds', False)) if spline else camera_at(keys, t, A)
                cam.location = (cx, -cy, 10)
                cam_data.ortho_scale = vh * A
                for i, n in nodes.items():
                    ks, sm = op_keys.get(i, ([], False))
                    v = opacity_at(ks, t, sm, carried[i])
                    n['op'].default_value = v
                    n['obj'].hide_render = v <= 0.0
                scene.render.filepath = os.path.join(d, '%05d.png' % (fi + 1))
                bpy.ops.render.render(write_still=True)
                done_leg += 1
                frames_done += 1
                if done_leg % 30 == 0 or fi == n_frames - 1:
                    print('[stills] %s %s %d/%d  %.2f s/frame' % (leg['id'], aspect, fi + 1, n_frames, (time.time() - t_leg) / done_leg), flush=True)
        # the state the next leg inherits: each image's last opacity
        for i, (ks, sm) in op_keys.items():
            if ks:
                state[i] = ks[-1][1]
    print('[stills] aspect %s done (%dx%d)' % (aspect, W, H), flush=True)

dt = time.time() - t_all
print('[stills] %d frames in %.1f s = %.3f s/frame -> %s' % (frames_done, dt, dt / max(1, frames_done), OUT))
