"""water.py — lake plane with Principled water: transmission 1, IOR 1.33, ripples, depth-colour ramp from a
`depth` vertex attribute (water level minus ground height, sampled from the terrain). Phase driven by frame."""
import numpy as np
import bpy
from ._util import say, purge, link, collection, new, inp, out, wire
from . import terrain as _terrain

P = "water_"


def build(name="lake", terrain=None, level=0.0, center=(0, 0), size=(100, 100), res=120, ripple_scale=14.0,
          ripple_strength=0.08, ripple_speed=0.05, shallow=(0.12, 0.38, 0.36, 1), deep=(0.015, 0.07, 0.09, 1), max_depth=4.0):
    purge(P + name)
    n = res + 1; xs = np.linspace(-size[0] / 2, size[0] / 2, n) + center[0]; ys = np.linspace(-size[1] / 2, size[1] / 2, n) + center[1]
    X, Y = np.meshgrid(xs, ys)
    me = bpy.data.meshes.new(P + name)
    me.from_pydata(np.stack([X.ravel(), Y.ravel(), np.full(n * n, level)], 1).tolist(), [],
                   [(j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i) for j in range(res) for i in range(res)])
    me.update()
    if terrain is not None:
        depth = np.clip(level - _terrain.height_at(terrain, X.ravel(), Y.ravel()), 0, None)
    else:
        depth = np.full(n * n, max_depth)
    me.attributes.new("depth", "FLOAT", "POINT").data.foreach_set("value", depth.astype(np.float32))
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(P + name, me); link(ob, collection("water"))
    m = bpy.data.materials.new(P + name); m.use_nodes = True; t = m.node_tree
    for nd in list(t.nodes):
        t.nodes.remove(nd)
    o = new(t, "ShaderNodeOutputMaterial", 900, 0); b = new(t, "ShaderNodeBsdfPrincipled", 600, 0); wire(t, b.outputs["BSDF"], o.inputs["Surface"])
    inp(b, "Transmission Weight", 1.0); inp(b, "IOR", 1.33); inp(b, "Roughness", 0.03); inp(b, "Metallic", 0.0)
    at = new(t, "ShaderNodeAttribute", -700, 250); at.attribute_type = "GEOMETRY"; at.attribute_name = "depth"
    mr = new(t, "ShaderNodeMapRange", -450, 250); inp(mr, "From Min", 0.0); inp(mr, "From Max", max_depth); inp(mr, "To Min", 0.0); inp(mr, "To Max", 1.0); mr.clamp = True
    wire(t, out(at, "Fac"), mr.inputs["Value"])
    rp = new(t, "ShaderNodeValToRGB", -200, 250)
    rp.color_ramp.elements[0].color = shallow; rp.color_ramp.elements[1].color = deep
    wire(t, out(mr, "Result"), rp.inputs["Fac"]); wire(t, rp.outputs["Color"], b.inputs["Base Color"])
    tc = new(t, "ShaderNodeTexCoord", -900, -200)
    nz = new(t, "ShaderNodeTexNoise", -600, -200); nz.noise_dimensions = "4D"
    inp(nz, "Scale", ripple_scale / 10.0); inp(nz, "Detail", 3.0); inp(nz, "Roughness", 0.6)
    wire(t, tc.outputs["Object"], nz.inputs["Vector"])
    drv = nz.inputs["W"].driver_add("default_value"); drv.driver.type = "SCRIPTED"; drv.driver.expression = "frame*%s" % ripple_speed
    bp = new(t, "ShaderNodeBump", 300, -300); inp(bp, "Strength", ripple_strength * 5); inp(bp, "Distance", 0.1)
    wire(t, out(nz, "Fac"), bp.inputs["Height"]); wire(t, bp.outputs["Normal"], b.inputs["Normal"])
    if hasattr(m, "use_raytrace_refraction"):
        m.use_raytrace_refraction = True
    me.materials.append(m)
    say("water %s: level %.2f, %dx%d m, depth max %.2f m, IOR 1.33 transmission 1, ripple phase = frame*%s"
        % (ob.name, level, size[0], size[1], float(depth.max()), ripple_speed))
    return ob
