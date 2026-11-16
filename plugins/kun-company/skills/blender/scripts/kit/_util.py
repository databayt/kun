"""_util.py — shared helpers for the kit (5.x-safe: nodes by type, enums read not guessed)."""
import bpy


def say(*a):
    print("[kit]", *a, flush=True)


def purge(prefix):
    """Remove objects/meshes/materials/node groups/lights/cameras whose name starts with prefix (idempotency)."""
    n = 0
    for o in list(bpy.data.objects):
        if o.name.startswith(prefix):
            bpy.data.objects.remove(o, do_unlink=True); n += 1
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.node_groups, bpy.data.lights,
                 bpy.data.cameras, bpy.data.lightprobes, bpy.data.curves):
        for d in list(coll):
            if d.name.startswith(prefix) and d.users == 0:
                coll.remove(d)
    for c in list(bpy.data.collections):
        if c.name.startswith(prefix) and not c.objects:
            bpy.data.collections.remove(c)
    return n


def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if c.name not in parent.children:
        try:
            parent.children.link(c)
        except RuntimeError:
            pass
    return c


def link(obj, coll=None):
    coll = coll or bpy.context.scene.collection
    if obj.name not in coll.objects:
        coll.objects.link(obj)
    return obj


def node_type(tree, t):
    return next((n for n in tree.nodes if n.type == t), None)


def inp(node, name, value, kind=None, nth=0):
    """Set the nth input called `name` (optionally of socket type `kind`); returns the socket.
    5.x has several same-named sockets (type-dependent) and MENU sockets that take identifier strings."""
    socks = [s for s in node.inputs if name in (s.name, s.identifier) and (kind is None or s.type == kind)]
    if not socks:
        raise KeyError("%s has no input %r (%s)" % (node.bl_idname, name, kind))
    s = socks[nth]
    if value is not None and hasattr(s, "default_value"):
        try:
            s.default_value = value
        except TypeError as e:
            raise TypeError("%s.%s <- %r: %s" % (node.bl_idname, name, value, e))
    return s


def out(node, name, kind=None, nth=0):
    socks = [s for s in node.outputs if name in (s.name, s.identifier) and (kind is None or s.type == kind)]
    if not socks:
        raise KeyError("%s has no output %r" % (node.bl_idname, name))
    return socks[nth]


def wire(tree, a, b):
    tree.links.new(a, b)


def new(tree, idname, x=0, y=0, **props):
    n = tree.nodes.new(idname)
    n.location = (x, y)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def enum_ids(owner, prop):
    return [i.identifier for i in owner.bl_rna.properties[prop].enum_items]


def set_enum(owner, prop, *candidates):
    """Assign the first candidate the build accepts; returns what stuck (or None)."""
    for c in candidates:
        try:
            setattr(owner, prop, c)
            return c
        except (TypeError, ValueError):
            continue
    return None


def fcurves(idblock):
    """FCurves of a datablock's action — 5.x layered actions (action.fcurves is gone)."""
    ad = idblock.animation_data
    if not ad or not ad.action:
        return []
    act, slot = ad.action, ad.action_slot
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    from bpy_extras import anim_utils
    cb = anim_utils.action_get_channelbag_for_slot(act, slot)
    return list(cb.fcurves) if cb else []
