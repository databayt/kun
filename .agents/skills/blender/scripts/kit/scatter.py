"""scatter.py — geometry-nodes scatter: Poisson Distribute Points on Faces → Instance on Points (random pick
from a collection) with density from a mask attribute/vertex group, optional exclusion masks, camera culling.
Instances stay instances (no Realize). count_instances() verifies through the evaluated depsgraph."""
import math
import bpy
from ._util import say, purge, new, inp, out, wire, set_enum

P = "scatter_"


def _gn(name):
    t = bpy.data.node_groups.new(P + name, "GeometryNodeTree")
    t.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    t.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    return t


def _attr(t, name, x, y):
    n = new(t, "GeometryNodeInputNamedAttribute", x, y, data_type="FLOAT"); inp(n, "Name", name)
    return out(n, "Attribute")


def scatter(target, instance_collection, density=0.05, mask_attribute=None, seed=0, scale_range=(0.8, 1.2),
            rot_random=1.0, min_distance=0.0, max_camera_distance=None, camera=None, exclude=(), name=None, hide_source=True, decimate=None):
    """density in points per m². mask_attribute: vertex group / float attribute (0..1) scaling density.
    exclude: attribute names whose presence removes points (e.g. ["mask_road", "mask_shore"]).
    decimate: Decimate(collapse) ratio added to every source object — scanned Poly Haven trees are ~1M tris each and
    instances multiply that (island_tree_02 x36 = 38M tris = 28 s/frame at 854x480)."""
    name = name or instance_collection.name
    purge(P + name)
    t = _gn(name); gi = new(t, "NodeGroupInput", -900, 0); go = new(t, "NodeGroupOutput", 1500, 0)
    d = new(t, "GeometryNodeDistributePointsOnFaces", -500, 0)
    set_enum_prop(d, "distribute_method", "POISSON")
    wire(t, out(gi, "Geometry"), d.inputs["Mesh"])
    inp(d, "Distance Min", min_distance); inp(d, "Density Max", density); inp(d, "Seed", seed)
    fac = None
    if mask_attribute:
        fac = _attr(t, mask_attribute, -900, -250)
    for i, ex in enumerate(exclude):
        a = _attr(t, ex, -900, -400 - 120 * i)
        inv = new(t, "ShaderNodeMath", -700, -400 - 120 * i, operation="SUBTRACT"); inv.inputs[0].default_value = 1.0
        wire(t, a, inv.inputs[1])
        if fac is None:
            fac = inv.outputs["Value"]
        else:
            mul = new(t, "ShaderNodeMath", -550, -400 - 120 * i, operation="MULTIPLY")
            wire(t, fac, mul.inputs[0]); wire(t, inv.outputs["Value"], mul.inputs[1]); fac = mul.outputs["Value"]
    if fac is not None:
        wire(t, fac, d.inputs["Density Factor"])
    ci = new(t, "GeometryNodeCollectionInfo", -500, 300); inp(ci, "Collection", instance_collection)
    inp(ci, "Separate Children", True); inp(ci, "Reset Children", True)
    iop = new(t, "GeometryNodeInstanceOnPoints", 100, 0)
    wire(t, out(d, "Points"), iop.inputs["Points"]); wire(t, out(ci, "Instances"), iop.inputs["Instance"])
    inp(iop, "Pick Instance", True)
    nkids = max(1, len(instance_collection.objects))
    ri = new(t, "FunctionNodeRandomValue", -200, 250, data_type="INT")
    inp(ri, "Min", 0, "INT"); inp(ri, "Max", nkids - 1, "INT"); inp(ri, "Seed", seed + 1)
    wire(t, out(new(t, "GeometryNodeInputIndex", -400, 200), "Index"), ri.inputs["ID"])
    wire(t, out(ri, "Value", "INT"), iop.inputs["Instance Index"])
    rs = new(t, "FunctionNodeRandomValue", -200, 100, data_type="FLOAT")
    inp(rs, "Min", scale_range[0], "VALUE"); inp(rs, "Max", scale_range[1], "VALUE"); inp(rs, "Seed", seed + 2)
    cx = new(t, "ShaderNodeCombineXYZ", 0, 100)
    for k in ("X", "Y", "Z"):
        wire(t, out(rs, "Value", "VALUE"), cx.inputs[k])
    wire(t, cx.outputs["Vector"], iop.inputs["Scale"])
    rr = new(t, "FunctionNodeRandomValue", -200, -50, data_type="FLOAT")
    inp(rr, "Min", 0.0, "VALUE"); inp(rr, "Max", 2 * math.pi * rot_random, "VALUE"); inp(rr, "Seed", seed + 3)
    ce = new(t, "ShaderNodeCombineXYZ", 0, -50); wire(t, out(rr, "Value", "VALUE"), ce.inputs["Z"])
    eu = new(t, "FunctionNodeEulerToRotation", 150, -50); wire(t, ce.outputs["Vector"], eu.inputs["Euler"])
    wire(t, out(eu, "Rotation"), iop.inputs["Rotation"])
    if max_camera_distance:
        cam = camera or bpy.context.scene.camera
        oi = new(t, "GeometryNodeObjectInfo", -500, -600); inp(oi, "Object", cam)
        vm = new(t, "ShaderNodeVectorMath", -250, -600, operation="DISTANCE")
        wire(t, out(oi, "Location"), vm.inputs[1]); wire(t, out(new(t, "GeometryNodeInputPosition", -450, -700), "Position"), vm.inputs[0])
        cmp = new(t, "ShaderNodeMath", -50, -600, operation="LESS_THAN");
        wire(t, vm.outputs["Value"], cmp.inputs[0]); cmp.inputs[1].default_value = max_camera_distance
        wire(t, cmp.outputs["Value"], iop.inputs["Selection"])
    jn = new(t, "GeometryNodeJoinGeometry", 1200, 0)  # keep the terrain itself, add the instances
    wire(t, out(gi, "Geometry"), jn.inputs[0]); wire(t, out(iop, "Instances"), jn.inputs[0]); wire(t, jn.outputs["Geometry"], go.inputs[0])
    mod = target.modifiers.new(P + name, "NODES"); mod.node_group = t
    if decimate:
        for o in instance_collection.objects:
            if o.type == "MESH" and not any(m.type == "DECIMATE" for m in o.modifiers):
                dm = o.modifiers.new("kit_decimate", "DECIMATE"); dm.ratio = decimate
    if hide_source:
        for o in instance_collection.objects:
            o.hide_render = False
        _hide(instance_collection)
    say("scatter %s on %s: density %.3f/m² min_dist %s mask %s exclude %s seed %d scale %s rot %.1f cull %s kids %d decimate %s"
        % (name, target.name, density, min_distance, mask_attribute, list(exclude), seed, scale_range, rot_random, max_camera_distance, nkids, decimate))
    return mod


def set_enum_prop(n, prop, val):
    if hasattr(n, prop):
        set_enum(n, prop, val)


def _hide(coll):
    def walk(lc):
        if lc.collection == coll:
            lc.hide_viewport = True; return True
        return any(walk(c) for c in lc.children)
    walk(bpy.context.view_layer.layer_collection)


def count_instances(target, collection=None):
    """Instances produced by `target`'s modifiers, via the evaluated depsgraph; collection= counts one source set."""
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    n = sum(1 for i in dg.object_instances if i.is_instance and i.parent and i.parent.original == target
            and (collection is None or collection in i.object.original.users_collection))
    say("count_instances(%s%s) = %d" % (target.name, "/" + collection.name if collection else "", n))
    return n
