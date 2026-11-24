import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import terrain, materials
import common as C


def run(ctx):
    masks = {
        "road": {"type": "road", "points": C.ROAD, "width": 6.0, "falloff": 1.5},
        "verge": {"type": "road", "points": C.ROAD, "width": 16.0, "falloff": 14.0},
        "shore": {"type": "shore", "z": 0.15, "falloff": 1.3},
        "lawn": {"type": "lawn", "polygons": [[(25, -70), (80, -60), (85, -10), (35, -20)]], "falloff": 6.0},
    }
    ground = materials.ground("ground")
    t = terrain.build("main", C.SIZE, res=200, height_fn=C.height, masks=masks, material=ground)
    r = terrain.road_strip(t, C.ROAD, width=6.0, material=materials.murram("murram"))
    ctx["scene"].unit_settings.system = "METRIC"
