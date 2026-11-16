"""sky.py — Nishita-style sky + Sun light from azimuth/elevation, optional haze, sphere light probe.
Azimuth is a compass bearing: 0 = +Y (north), 90 = +X (east). Elevation above horizon, degrees."""
import math
import bpy
from mathutils import Vector
from ._util import say, purge, link, node_type, new, inp, wire, set_enum, enum_ids

P = "sky_"


def sun_vector(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))


def build(az=250, el=15, strength=3.0, angle=0.6, sky_strength=1.0, air=1.0, dust=1.0,
          disc=False, haze=0.0, haze_depth=200.0, haze_size=600.0, haze_height=90.0, probe_pos=None, probe_radius=120.0, probe_res=None):
    sc = bpy.context.scene
    purge(P)
    w = bpy.data.worlds.get(P + "world") or bpy.data.worlds.new(P + "world")
    w.use_nodes = True; sc.world = w
    t = w.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    sky = new(t, "ShaderNodeTexSky", -400, 0)
    kind = set_enum(sky, "sky_type", "MULTIPLE_SCATTERING", "SINGLE_SCATTERING")
    sky.sun_elevation = math.radians(el)
    sky.sun_rotation = math.radians(az)  # calibrated by render: rotation 0 = north (+Y), 90 = east (+X)
    # sun_disc off by default: with the disc on, its world light is unshadowed and doubles the Sun light
    sky.sun_disc = disc; sky.sun_size = math.radians(0.55); sky.sun_intensity = 1.0
    sky.air_density = air; sky.ozone_density = 1.0
    for k in ("aerosol_density", "dust_density"):
        if hasattr(sky, k):
            setattr(sky, k, dust)
    bg = new(t, "ShaderNodeBackground", -150, 0); inp(bg, "Strength", sky_strength)
    outn = new(t, "ShaderNodeOutputWorld", 100, 0)
    wire(t, sky.outputs["Color"], bg.inputs["Color"]); wire(t, bg.outputs["Background"], outn.inputs["Surface"])
    if haze > 0:
        # A world volume renders the whole frame black in this EEVEE build (5.3, headless Metal; checked with a
        # plain Background + Volume Scatter), so haze is a bounded box volume around the scene instead.
        import bmesh
        me = bpy.data.meshes.new(P + "haze"); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
        hz = bpy.data.objects.new(P + "haze", me); link(hz); hz.scale = (haze_size, haze_size, haze_height); hz.location = (0, 0, haze_height / 2 - 5)
        hz.display_type = "BOUNDS"; hz.hide_select = True
        m = bpy.data.materials.new(P + "haze"); m.use_nodes = True; mt = m.node_tree
        for nd in list(mt.nodes):
            mt.nodes.remove(nd)
        o = new(mt, "ShaderNodeOutputMaterial", 300, 0); v = new(mt, "ShaderNodeVolumeScatter", 0, 0)
        inp(v, "Density", haze); inp(v, "Anisotropy", 0.4); wire(mt, v.outputs["Volume"], o.inputs["Volume"])
        me.materials.append(m)
        e = sc.eevee
        e.use_volume_custom_range = True; e.volumetric_start = 0.1; e.volumetric_end = haze_depth
    # EEVEE would also extract the sky's sun disc as a second shadow-casting sun; the Sun light below is the only one
    w.sun_threshold = 1.0e6
    d = bpy.data.lights.new(P + "sun", "SUN")
    d.energy = strength; d.angle = math.radians(angle); d.use_shadow = True
    so = bpy.data.objects.new(P + "sun", d); link(so)
    so.rotation_euler = sun_vector(az, el).to_track_quat("Z", "Y").to_euler()
    w.probe_resolution = set_enum_val(w, "probe_resolution", probe_res or "1024")
    pr = None
    if probe_pos is not None:
        lp = bpy.data.lightprobes.new(P + "probe", "SPHERE")
        for k, v in (("influence_distance", probe_radius), ("clip_start", 0.5)):
            if hasattr(lp, k):
                setattr(lp, k, v)
        pr = bpy.data.objects.new(P + "probe", lp); link(pr); pr.location = probe_pos
    say("sky applied: type=%s az=%s el=%s sun=%.1f angle=%s sky_rot=%.1fdeg haze=%s probe=%s world_probe_res=%s"
        % (kind, az, el, strength, angle, math.degrees(sky.sun_rotation), haze, bool(pr), w.probe_resolution))
    return so


def set_enum_val(w, prop, want):
    ids = enum_ids(w, prop)
    return want if want in ids else ids[-1] if ids else None
