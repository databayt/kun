import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from kit import polyhaven, scatter, materials
import common as C


def run(ctx):
    p = ctx["params"]; t = bpy.data.objects["terrain_main"]
    tree = polyhaven.append_model(polyhaven.fetch_model(p.get("tree", "island_tree_02"), "1k"), "tree")
    grass = polyhaven.append_model(polyhaven.fetch_model(p.get("grass", "shrub_04"), "1k"), "grass")
    materials.remap_gltf_materials(tree); materials.remap_gltf_materials(grass)
    for c in (tree, grass):  # glTF arrives Y-up-converted; park the sources at the origin, grounded
        for o in c.objects:
            o.location = (0, 0, o.location.z)
    scatter.scatter(t, tree, density=p.get("tree_density", 0.0014), mask_attribute=None, exclude=["mask_road", "mask_shore", "mask_verge_inner"][:2],
                    seed=7, scale_range=(0.8, 1.35), min_distance=14.0, name="trees", decimate=0.06)
    scatter.scatter(t, grass, density=p.get("grass_density", 0.35), mask_attribute="mask_verge", exclude=["mask_road", "mask_shore"],
                    seed=11, scale_range=(1.0, 2.2), min_distance=0.5, name="grass", decimate=0.08)
    for c in (tree, grass):
        print("[toy] instances", c.name, scatter.count_instances(t, c))
