import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from kit import water, sky, render_settings
import common as C


def run(ctx):
    t = bpy.data.objects["terrain_main"]
    water.build("lake", terrain=t, level=0.0, center=C.LAKE_C, size=(88, 88), res=140)
    sky.build(az=250, el=15, strength=5.0, sky_strength=0.4, angle=0.6, haze=0.0, haze_depth=250, probe_pos=(C.LAKE_C[0], C.LAKE_C[1], 6.0), probe_radius=120)
