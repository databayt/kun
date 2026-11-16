import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from kit import camrig, render_settings, grade, terrain
import common as C


def run(ctx):
    sc = ctx["scene"]; t = bpy.data.objects["terrain_main"]
    def at(x, y, dz):
        return [x, y, float(terrain.height_at(t, x, y)) + dz]
    beats = [
        {"t": 0.0, "pos": at(-28, -88, 1.7), "target": at(-8, -50, 1.8), "lens": 28},
        {"t": 1.0, "pos": at(-14, -52, 1.7), "target": at(6, -16, 2.2), "lens": 30},
        {"t": 2.0, "pos": at(8, -14, 1.9), "target": at(10, 30, 2.8), "lens": 32},
        {"t": 3.0, "pos": at(10, 22, 2.1), "target": at(28, 80, 3.2), "lens": 35},
    ]
    camrig.build(beats, fps=24, resample=0.5, shake=0.03)
    render_settings.final(sc, samples=int(ctx["params"].get("samples", 48)), raytrace=True, motion_blur=0.4, view="AgX")
    grade.build(sc)
    sc.render.resolution_x, sc.render.resolution_y = 854, 480
