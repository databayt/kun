"""introspect.py — what this Blender build offers. blender.sh render kit/introspect.py -- out.json"""
import bpy, sys, json

def args():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

def enum(owner, prop):
    try:
        return [i.identifier for i in owner.bl_rna.properties[prop].enum_items]
    except Exception as e:
        return "ERR " + str(e)

def node_types(tree_type):
    """Node classes usable in a tree type, found by instantiating on a scratch tree."""
    out = []
    tree = bpy.data.node_groups.new("_probe", tree_type)
    for name in sorted(dir(bpy.types)):
        cls = getattr(bpy.types, name)
        if not (isinstance(cls, type) and issubclass(cls, bpy.types.Node)) or cls.__name__ == "Node":
            continue
        try:
            n = tree.nodes.new(name); out.append(name); tree.nodes.remove(n)
        except Exception:
            pass
    bpy.data.node_groups.remove(tree)
    return out

def main():
    sc = bpy.context.scene
    info = {"version": bpy.app.version_string, "python": sys.version.split()[0]}
    info["engines"] = enum(sc.render, "engine")
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = eng; info["eevee_engine_id"] = eng; break
        except TypeError:
            pass
    info["eevee_props"] = [p.identifier for p in sc.eevee.bl_rna.properties
                           if any(k in p.identifier for k in ("ray", "fast_gi", "shadow", "gtao", "volume", "motion", "taa", "light_threshold"))]
    info["view_transforms"] = enum(sc.view_settings, "view_transform")
    info["looks_agx"] = None
    try:
        sc.view_settings.view_transform = "AgX"; info["looks_agx"] = enum(sc.view_settings, "look")
    except TypeError:
        pass
    info["has_scene_node_tree"] = hasattr(sc, "node_tree")
    info["has_compositing_node_group"] = hasattr(sc, "compositing_node_group")
    try:
        info["compositor_nodes"] = node_types("CompositorNodeTree")
    except Exception as e:
        info["compositor_nodes"] = "ERR " + str(e)
    try:
        info["sky_types"] = None
        w = bpy.data.worlds.new("_p"); w.use_nodes = True
        n = w.node_tree.nodes.new("ShaderNodeTexSky"); info["sky_types"] = enum(n, "sky_type")
    except Exception as e:
        info["sky_types"] = "ERR " + str(e)
    info["addons_enabled"] = sorted(bpy.context.preferences.addons.keys())
    a = args()
    print(json.dumps(info, indent=1))
    if a:
        with open(a[0], "w") as f:
            json.dump(info, f, indent=1)
        print("wrote", a[0])

main()
