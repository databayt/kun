"""terrain.py — displaced grid + mask attributes/vertex groups, and a road strip that hugs the ground.
Masks are written as float POINT attributes AND vertex groups named mask_<key> (shaders read the attribute,
scatter reads either)."""
import math
import numpy as np
import bpy
from ._util import say, purge, link, collection

P = "terrain_"


def _smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def _seg_dist(px, py, pts):
    """min distance from each (px,py) to polyline pts (Nx2)."""
    d = np.full(px.shape, 1e9)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy or 1e-9
        t = np.clip(((px - ax) * vx + (py - ay) * vy) / L2, 0, 1)
        d = np.minimum(d, np.hypot(px - (ax + t * vx), py - (ay + t * vy)))
    return d


def _in_poly(px, py, poly):
    inside = np.zeros(px.shape, bool); n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        c = ((y1 > py) != (y2 > py)) & (px < (x2 - x1) * (py - y1) / ((y2 - y1) or 1e-9) + x1)
        inside ^= c
    return inside


def _mask(spec, x, y, z):
    kind = spec["type"]
    if kind == "road":
        pts = np.array(spec["points"], float)[:, :2]
        d = _seg_dist(x, y, pts); w = spec.get("width", 6.0) / 2; f = spec.get("falloff", 2.0)
        return 1 - _smooth((d - w) / f)
    if kind == "shore":
        f = spec.get("falloff", 2.0)
        return 1 - _smooth((z - spec["z"]) / f)
    if kind == "lawn":
        f = spec.get("falloff", 4.0); m = np.zeros(x.shape)
        for poly in spec["polygons"]:
            poly = np.array(poly, float)[:, :2]
            inside = _in_poly(x, y, poly)
            ring = np.concatenate([poly, poly[:1]])
            d = _seg_dist(x, y, ring)
            m = np.maximum(m, np.where(inside, 1.0, 1 - _smooth(d / f)))
        return m
    raise ValueError("mask type %r" % kind)


def _load_heightmap(path, scale):
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[:, :, 0] * scale


def build(name="main", size_xy=(200.0, 200.0), res=200, height_fn=None, heightmap_png=None, height_scale=10.0,
          masks=None, material=None, seed=0):
    """res = cells per side. height_fn(x, y) -> z (numpy-vectorised). masks = {key: {"type": road|shore|lawn, ...}}."""
    purge(P + name)
    sx, sy = size_xy
    xs = np.linspace(-sx / 2, sx / 2, res + 1); ys = np.linspace(-sy / 2, sy / 2, res + 1)
    X, Y = np.meshgrid(xs, ys)
    if heightmap_png:
        hm = _load_heightmap(heightmap_png, height_scale)
        iy = np.clip(((Y / sy + .5) * (hm.shape[0] - 1)).astype(int), 0, hm.shape[0] - 1)
        ix = np.clip(((X / sx + .5) * (hm.shape[1] - 1)).astype(int), 0, hm.shape[1] - 1)
        Z = hm[iy, ix]
    elif height_fn:
        Z = np.asarray(height_fn(X, Y), float) * np.ones_like(X)
    else:
        Z = np.zeros_like(X)
    n = res + 1
    co = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1).astype(np.float32)
    idx = np.arange(n * n).reshape(n, n)
    quads = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1, 4)
    me = bpy.data.meshes.new(P + name)
    me.from_pydata(co.tolist(), [], quads.tolist()); me.update()
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), bool))
    lv = np.empty(len(me.loops), np.int32); me.loops.foreach_get("vertex_index", lv)
    uv = me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", np.stack([X.ravel()[lv] / sx + .5, Y.ravel()[lv] / sy + .5], 1).ravel().astype(np.float32))
    ob = bpy.data.objects.new(P + name, me); link(ob, collection("terrain"))
    xf, yf, zf = X.ravel(), Y.ravel(), Z.ravel(); report = {}
    for key, spec in (masks or {}).items():
        m = np.clip(_mask(spec, xf, yf, zf), 0, 1).astype(np.float32)
        att = me.attributes.new("mask_" + key, "FLOAT", "POINT"); att.data.foreach_set("value", m)
        vg = ob.vertex_groups.new(name="mask_" + key)
        for i in np.nonzero(m > 0.01)[0]:
            vg.add([int(i)], float(m[i]), "REPLACE")
        report[key] = (int((m > 0.5).sum()), round(float(m.mean()), 3))
    if material:
        me.materials.append(material)
    ob["terrain_res"] = res; ob["terrain_size"] = (sx, sy)
    say("terrain %s: %dx%d verts, z %.2f..%.2f, masks(>0.5 verts, mean) %s" % (ob.name, n, n, Z.min(), Z.max(), report))
    return ob


def height_at(ob, x, y):
    """Bilinear ground height at world (x, y) arrays/scalars (terrain unrotated at origin)."""
    n = ob["terrain_res"] + 1; sx, sy = ob["terrain_size"]
    co = np.empty(n * n * 3, np.float32); ob.data.vertices.foreach_get("co", co)
    Z = co.reshape(n, n, 3)[:, :, 2]
    u = np.clip((np.asarray(x, float) / sx + .5) * (n - 1), 0, n - 1.001); v = np.clip((np.asarray(y, float) / sy + .5) * (n - 1), 0, n - 1.001)
    i, j = u.astype(int), v.astype(int); fu, fv = u - i, v - j
    return (Z[j, i] * (1 - fu) * (1 - fv) + Z[j, i + 1] * fu * (1 - fv) + Z[j + 1, i] * (1 - fu) * fv + Z[j + 1, i + 1] * fu * fv)


def _catmull(pts, step):
    pts = np.array(pts, float)[:, :2]; ext = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]]); out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]; L = np.linalg.norm(p2 - p1); k = max(2, int(L / step))
        for t in np.linspace(0, 1, k, endpoint=False):
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1]); return np.array(out)


def road_strip(terrain, points, width=6.0, name="road", step=1.5, lift=0.04, across=4, material=None, crown=0.06):
    """Road mesh along a polyline (Catmull-Rom smoothed) draped on `terrain`; UV v runs along the road (metres/width)."""
    purge(P + name)
    c = _catmull(points, step); tan = np.gradient(c, axis=0); tan /= np.linalg.norm(tan, axis=1)[:, None]
    nrm = np.stack([-tan[:, 1], tan[:, 0]], 1); off = np.linspace(-width / 2, width / 2, across + 1)
    V = []; 
    for p, nv in zip(c, nrm):
        for o in off:
            q = p + nv * o
            V.append((q[0], q[1], float(height_at(terrain, q[0], q[1])) + lift + crown * (1 - abs(o) / (width / 2)) ** 1))
    rows = len(c); W = across + 1; F = []; UV = []
    dist = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(c, axis=0), axis=1))])
    for r in range(rows - 1):
        for k in range(across):
            a = r * W + k; F.append((a, a + 1, a + W + 1, a + W))
    me = bpy.data.meshes.new(P + name); me.from_pydata(V, [], F); me.update()
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uv.data[li].uv = ((vi % W) / across, dist[vi // W] / width)
    for p in me.polygons:
        p.use_smooth = True
    if material:
        me.materials.append(material)
    ob = bpy.data.objects.new(P + name, me); link(ob, collection("terrain"))
    say("road_strip %s: %d verts, length %.1f m, width %s" % (ob.name, len(V), dist[-1], width))
    return ob
