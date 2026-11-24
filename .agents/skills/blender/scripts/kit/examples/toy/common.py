"""Shared toy-scene constants (stage modules import this by path via sys.path insertion in each stage)."""
import numpy as np

SIZE = (200.0, 200.0)
LAKE_C = (-62.0, 12.0)
ROAD = [(-30, -95), (-12, -45), (12, -8), (8, 38), (30, 92)]


def height(x, y):
    hill = 5.5 * np.exp(-((x - 45) ** 2 + (y - 55) ** 2) / (2 * 38 ** 2))
    roll = 0.7 * np.sin(x * 0.045 + 1.3) * np.cos(y * 0.037) + 0.25 * np.sin(x * 0.13) * np.sin(y * 0.11)
    lake = 5.0 * np.exp(-((x - LAKE_C[0]) ** 2 + ((y - LAKE_C[1]) * 1.3) ** 2) / (2 * 26 ** 2))
    return 2.0 + hill + roll - lake
