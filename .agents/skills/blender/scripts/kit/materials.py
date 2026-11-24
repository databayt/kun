"""materials.py — PBR helpers (Principled by type, procedural bumps). Every material is named mat_<name>
and rebuilt from scratch when called again (idempotent)."""
import bpy
from ._util import say, new, inp, out, wire, node_type

N = "mat_"


def _fresh(name):
    m = bpy.data.materials.get(N + name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(N + name); m.use_nodes = True
    t = m.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    o = new(t, "ShaderNodeOutputMaterial", 700, 0)
    b = new(t, "ShaderNodeBsdfPrincipled", 400, 0)
    wire(t, b.outputs["BSDF"], o.inputs["Surface"])
    return m, t, b


def _bump(t, b, height_socket, strength, dist=0.02):
    bp = new(t, "ShaderNodeBump", 200, -300); inp(bp, "Strength", strength); inp(bp, "Distance", dist)
    wire(t, height_socket, bp.inputs["Height"]); wire(t, bp.outputs["Normal"], b.inputs["Normal"])


def _noise(t, scale, x=-600, y=0, detail=6.0, rough=0.55, coord=None):
    tc = coord or new(t, "ShaderNodeTexCoord", x - 300, y)
    n = new(t, "ShaderNodeTexNoise", x, y); inp(n, "Scale", scale); inp(n, "Detail", detail); inp(n, "Roughness", rough)
    wire(t, tc.outputs["Object"], n.inputs["Vector"])
    return n, tc


def _ramp(t, fac, stops, x=-300, y=0):
    r = new(t, "ShaderNodeValToRGB", x, y)
    r.color_ramp.elements[0].position = stops[0][0]; r.color_ramp.elements[0].color = stops[0][1]
    r.color_ramp.elements[1].position = stops[-1][0]; r.color_ramp.elements[1].color = stops[-1][1]
    for pos, col in stops[1:-1]:
        e = r.color_ramp.elements.new(pos); e.color = col
    wire(t, fac, r.inputs["Fac"])
    return r


def principled(name, base=(0.5, 0.5, 0.5, 1), rough=0.5, metal=0.0, normal_tex=None, bump=None):
    """normal_tex: image path or Image (non-colour) → Normal Map; bump: float strength of a fine noise bump."""
    m, t, b = _fresh(name)
    inp(b, "Base Color", tuple(base) if len(base) == 4 else tuple(base) + (1,))
    inp(b, "Roughness", rough); inp(b, "Metallic", metal)
    if normal_tex:
        img = normal_tex if isinstance(normal_tex, bpy.types.Image) else bpy.data.images.load(normal_tex, check_existing=True)
        img.colorspace_settings.name = "Non-Color"
        tx = new(t, "ShaderNodeTexImage", -100, -400); tx.image = img
        nm = new(t, "ShaderNodeNormalMap", 150, -400)
        wire(t, tx.outputs["Color"], nm.inputs["Color"]); wire(t, nm.outputs["Normal"], b.inputs["Normal"])
    elif bump:
        n, _ = _noise(t, 80, y=-400, detail=4)
        _bump(t, b, n.outputs["Fac"], bump)
    say("material", m.name, "rough", rough, "metal", metal, "bump", bump)
    return m


def corrugated(name, color=(0.12, 0.28, 0.5, 1), wave_scale=14.0, depth=1.0, rough=0.42, metal=0.35, axis="Z"):
    """Painted corrugated steel: sine ridges (object-space, metres) + fine grain bump + subtle paint variation."""
    m, t, b = _fresh(name)
    tc = new(t, "ShaderNodeTexCoord", -900, 0)
    w = new(t, "ShaderNodeTexWave", -600, -300)
    w.wave_type = "BANDS"; w.bands_direction = axis if axis in ("X", "Y", "Z") else "Z"; w.wave_profile = "SIN"
    inp(w, "Scale", wave_scale); inp(w, "Distortion", 0.0); inp(w, "Detail", 0.0)
    wire(t, tc.outputs["Object"], w.inputs["Vector"])
    g, _ = _noise(t, 220, x=-600, y=-600, detail=3, coord=tc)
    mixh = new(t, "ShaderNodeMath", -350, -400); mixh.operation = "MULTIPLY_ADD"
    wire(t, w.outputs["Fac"], mixh.inputs[0]); mixh.inputs[1].default_value = 1.0
    wire(t, g.outputs["Fac"], mixh.inputs[2])
    _bump(t, b, mixh.outputs["Value"], depth, dist=0.03)
    v, _ = _noise(t, 3.0, x=-600, y=250, detail=5, coord=tc)
    mix = new(t, "ShaderNodeMix", -100, 200, data_type="RGBA")
    inp(mix, "Factor", 0.18, "VALUE")
    inp(mix, "A", tuple(color), "RGBA"); inp(mix, "B", tuple(c * 0.55 for c in color[:3]) + (1,), "RGBA")
    wire(t, v.outputs["Fac"], mix.inputs[0])
    wire(t, out(mix, "Result", "RGBA"), b.inputs["Base Color"])
    inp(b, "Roughness", rough); inp(b, "Metallic", metal); inp(b, "Coat Weight", 0.25); inp(b, "Coat Roughness", 0.3)
    say("material", m.name, "corrugated colour", tuple(round(c, 3) for c in color), "wave_scale", wave_scale)
    return m


def timber(name, color=(0.36, 0.2, 0.09, 1), rough=0.7, scale=6.0):
    m, t, b = _fresh(name)
    tc = new(t, "ShaderNodeTexCoord", -900, 0)
    w = new(t, "ShaderNodeTexWave", -600, 0); w.wave_type = "RINGS"; w.rings_direction = "Z"
    inp(w, "Scale", scale); inp(w, "Distortion", 6.0); inp(w, "Detail", 3.0)
    wire(t, tc.outputs["Object"], w.inputs["Vector"])
    r = _ramp(t, w.outputs["Fac"], [(0.2, tuple(c * 0.7 for c in color[:3]) + (1,)), (0.8, tuple(color))], x=-300)
    wire(t, r.outputs["Color"], b.inputs["Base Color"]); inp(b, "Roughness", rough)
    _bump(t, b, w.outputs["Fac"], 0.4, dist=0.01)
    say("material", m.name, "timber")
    return m


def murram(name="murram", base=(0.46, 0.2, 0.1, 1), scale=2.2):
    """Gravel/murram: red-brown laterite with pebble voronoi bump and dust variation."""
    m, t, b = _fresh(name)
    tc = new(t, "ShaderNodeTexCoord", -900, 0)
    n, _ = _noise(t, scale, x=-600, y=200, coord=tc)
    r = _ramp(t, n.outputs["Fac"], [(0.35, tuple(c * 0.7 for c in base[:3]) + (1,)), (0.65, (0.62, 0.34, 0.2, 1))], x=-300, y=200)
    wire(t, r.outputs["Color"], b.inputs["Base Color"])
    v = new(t, "ShaderNodeTexVoronoi", -600, -250); inp(v, "Scale", 90); wire(t, tc.outputs["Object"], v.inputs["Vector"])
    _bump(t, b, v.outputs["Distance"], 0.6, dist=0.02)
    inp(b, "Roughness", 0.92)
    say("material", m.name, "murram")
    return m


def grass_ground(name="grass", green_a=(0.1, 0.17, 0.035, 1), green_b=(0.26, 0.3, 0.07, 1), macro=0.045):
    return ground(name, green_a, green_b, macro, use_masks=False)


def ground(name="ground", green_a=(0.1, 0.17, 0.035, 1), green_b=(0.26, 0.3, 0.07, 1), macro=0.045,
           use_masks=True, road=(0.46, 0.2, 0.1, 1), sand=(0.3, 0.24, 0.14, 1), mask_road="mask_road", mask_shore="mask_shore"):
    """Terrain material: grass with two-scale macro variation; blends to murram (mask_road) and wet sand (mask_shore)
    from mesh attributes written by terrain.build."""
    m, t, b = _fresh(name)
    tc = new(t, "ShaderNodeTexCoord", -1200, 0)
    big, _ = _noise(t, macro * 10, x=-900, y=300, detail=3, coord=tc)
    fine, _ = _noise(t, 6.0, x=-900, y=0, detail=8, coord=tc)
    grass = _ramp(t, big.outputs["Fac"], [(0.3, green_a), (0.7, green_b)], x=-600, y=300)
    dark = new(t, "ShaderNodeMix", -350, 250, data_type="RGBA", blend_type="MULTIPLY")
    inp(dark, "Factor", 0.5, "VALUE"); wire(t, fine.outputs["Fac"], dark.inputs[0])
    wire(t, grass.outputs["Color"], dark.inputs[6]); inp(dark, "B", (0.8, 0.82, 0.7, 1), "RGBA")
    col = out(dark, "Result", "RGBA")
    if use_masks:
        for attr, c, y in ((mask_shore, sand, -150), (mask_road, road, -350)):
            a = new(t, "ShaderNodeAttribute", -600, y); a.attribute_type = "GEOMETRY"; a.attribute_name = attr
            mx = new(t, "ShaderNodeMix", -150 + (-y) // 10, y, data_type="RGBA")
            wire(t, a.outputs["Fac"], mx.inputs[0]); wire(t, col, mx.inputs[6]); inp(mx, "B", c, "RGBA")
            col = out(mx, "Result", "RGBA")
    wire(t, col, b.inputs["Base Color"]); inp(b, "Roughness", 0.9)
    _bump(t, b, fine.outputs["Fac"], 0.5, dist=0.05)
    say("material", m.name, "ground masks" if use_masks else "grass only")
    return m


def remap_gltf_materials(coll, dielectric=True):
    """Tidy imported glTF materials: sRGB colour textures, sane roughness, no leftover emission, backface culling off;
    dielectric=True also cuts texture-driven Metallic (Poly Haven glTF wires a roughness-map channel into it: black foliage)."""
    seen = set(); fixed = {"srgb": 0, "rough": 0, "emission": 0, "metal": 0}
    objs = coll.all_objects if hasattr(coll, "all_objects") else coll.objects
    for o in objs:
        for s in getattr(o, "material_slots", []):
            m = s.material
            if not m or m in seen or not m.use_nodes:
                continue
            seen.add(m)
            b = node_type(m.node_tree, "BSDF_PRINCIPLED")
            if not b:
                continue
            bc = b.inputs["Base Color"]
            for l in bc.links:
                if l.from_node.type == "TEX_IMAGE" and l.from_node.image:
                    l.from_node.image.colorspace_settings.name = "sRGB"; fixed["srgb"] += 1
            mt = b.inputs["Metallic"]
            if dielectric and mt.links:
                m.node_tree.links.remove(mt.links[0]); mt.default_value = 0.0; fixed["metal"] += 1
            r = b.inputs["Roughness"]
            if not r.links and r.default_value < 0.25:
                r.default_value = 0.45; fixed["rough"] += 1
            if not b.inputs["Emission Color"].links and b.inputs["Emission Strength"].default_value > 0:
                b.inputs["Emission Strength"].default_value = 0.0; fixed["emission"] += 1
            m.use_backface_culling = False
    say("remap_gltf_materials: %d materials, fixes %s" % (len(seen), fixed))
    return fixed
