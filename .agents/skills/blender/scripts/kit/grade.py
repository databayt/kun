"""grade.py — compositor chain on scene.compositing_node_group (5.x): glare, colour balance (warm gain, cool lift),
vignette (ellipse mask → blur → multiply), grain. Removed in 5.x: Composite, Texture, Map Value, Sun Beams — there is
no Composite node: the Group Output is the render output. Menu inputs (Type, Quality…) are sockets now, set by string.
Prints what was available and used."""
import numpy as np
import bpy
from ._util import say, new, out, wire

GROUP = "grade_main"


def _menu(n, name, val):
    try:
        n.inputs[name].default_value = val
    except Exception as e:
        say("menu %s.%s=%r not applied: %s" % (n.bl_idname, name, val, str(e)[:100]))


def _val(n, name, v):
    try:
        n.inputs[name].default_value = v
    except Exception as e:
        say("input %s.%s=%r not applied: %s" % (n.bl_idname, name, v, str(e)[:100]))


def _vec(n, name, vals):
    cur = n.inputs[name].default_value
    n.inputs[name].default_value = tuple(vals[:len(cur)]) + tuple(cur[len(vals):])


def build(scene=None, glare=0.4, vignette=0.28, grain=0.05, warm=0.06, cool_lift=0.03):
    sc = scene or bpy.context.scene
    old = bpy.data.node_groups.get(GROUP)
    if old:
        bpy.data.node_groups.remove(old)
    t = bpy.data.node_groups.new(GROUP, "CompositorNodeTree"); sc.compositing_node_group = t
    sc.render.use_compositing = True
    t.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    used = []
    rl = new(t, "CompositorNodeRLayers", -1000, 0); rl.scene = sc; used.append("RLayers")
    go = new(t, "NodeGroupOutput", 1900, 0)
    cur = out(rl, "Image")

    g = new(t, "CompositorNodeGlare", -700, 0); used.append("Glare"); wire(t, cur, g.inputs["Image"])
    _menu(g, "Type", "Bloom"); _menu(g, "Quality", "Medium"); _val(g, "Strength", glare); _val(g, "Threshold", 1.0)
    _val(g, "Size", 0.6); cur = out(g, "Image")

    cb = new(t, "CompositorNodeColorBalance", -400, 0); used.append("ColorBalance"); wire(t, cur, cb.inputs["Image"])
    _menu(cb, "Type", "Lift/Gamma/Gain")
    for s in cb.inputs:
        if s.type == "RGBA" and s.name == "Lift":
            s.default_value = (1 - cool_lift * 0.3, 1.0, 1 + cool_lift, 1)
        if s.type == "RGBA" and s.name == "Gain":
            s.default_value = (1 + warm, 1 + warm * 0.4, 1 - warm, 1)
    cur = out(cb, "Image")

    if vignette > 0:
        em = new(t, "CompositorNodeEllipseMask", -400, -500); used.append("EllipseMask")
        _vec(em, "Position", (0.5, 0.5)); _vec(em, "Size", (1.05, 0.95))
        bl = new(t, "CompositorNodeBlur", -150, -500); used.append("Blur"); wire(t, out(em, "Mask"), bl.inputs["Image"])
        _menu(bl, "Type", "Gaussian"); _vec(bl, "Size", (150.0, 150.0))
        fma = new(t, "ShaderNodeMath", 100, -500, operation="MULTIPLY_ADD"); used.append("Math")
        wire(t, out(bl, "Image"), fma.inputs[0]); fma.inputs[1].default_value = vignette; fma.inputs[2].default_value = 1.0 - vignette
        cc = new(t, "CompositorNodeCombineColor", 300, -500); used.append("CombineColor")
        for k in ("Red", "Green", "Blue"):
            wire(t, fma.outputs["Value"], cc.inputs[k])
        cur = _mix(t, cur, out(cc, "Image"), "MULTIPLY", 1.0, 1450, used)

    if grain > 0:
        rng = np.random.default_rng(3)
        img = bpy.data.images.get("kit_grain") or bpy.data.images.new("kit_grain", 1024, 1024)
        v = np.clip(0.5 + rng.normal(0, 0.18, (1024, 1024, 1)), 0, 1)
        img.pixels.foreach_set(np.concatenate([np.repeat(v, 3, 2), np.ones((1024, 1024, 1))], 2).ravel().astype(np.float32))
        img.colorspace_settings.name = "Non-Color"; img.pack()
        im = new(t, "CompositorNodeImage", 600, -800); im.image = img; used.append("Image(grain)")
        sca = new(t, "CompositorNodeScale", 850, -800); used.append("Scale"); wire(t, out(im, "Image"), sca.inputs["Image"])
        _menu(sca, "Type", "Render Size"); _menu(sca, "Frame Type", "Crop")
        cur = _mix(t, cur, out(sca, "Image"), "SOFT_LIGHT", grain, 1700, used)

    wire(t, cur, go.inputs["Image"])
    say("grade: nodes used %s | glare %.2f vignette %.2f grain %.2f warm %.2f | scene.compositing_node_group=%s"
        % (used, glare, vignette, grain, warm, sc.compositing_node_group.name))
    return t


def _mix(t, a, b, blend, fac, x, used):
    m = new(t, "ShaderNodeMix", x - 200, 0, data_type="RGBA", blend_type=blend); used.append("Mix(%s)" % blend.lower())
    m.inputs[0].default_value = fac
    wire(t, a, m.inputs[6]); wire(t, b, m.inputs[7])
    return out(m, "Result", "RGBA")
