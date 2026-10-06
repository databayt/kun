# Replace a baked-in transparency checkerboard with a flat studio background.
# Background = light, near-neutral pixels connected to the image border (flood fill), then a soft edge.
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.int16)
h, w, _ = im.shape
mx, mn = im.max(2), im.min(2)
cand = (mn > 175) & ((mx - mn) < 22)           # light and grey-ish: the checker squares
bg = np.zeros((h, w), bool); q = deque()
for x in range(w):
    for y in (0, h - 1):
        if cand[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if cand[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))
alpha = Image.fromarray(((~bg) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
studio = Image.new("RGB", (w, h), (226, 231, 236))
# gentle vertical light falloff, like a portrait backdrop
g = np.linspace(1.03, 0.96, h)[:, None, None]
studio = Image.fromarray(np.clip(np.asarray(studio) * g, 0, 255).astype(np.uint8))
res = Image.composite(Image.open(src).convert("RGB"), studio, alpha)
# square head-and-shoulders crop for the avatar circle
side = min(w, h); top = max(0, int(h * 0.02)); left = (w - side) // 2
res = res.crop((left, top, left + side, top + side)).resize((900, 900), Image.LANCZOS)
res.save(out, quality=92)
print("bg share", round(bg.mean(), 3))
