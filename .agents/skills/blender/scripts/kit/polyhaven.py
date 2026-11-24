"""polyhaven.py — headless Poly Haven (CC0) client: search, fetch_model/texture/hdri into a cache, append_model.
Public API, no key. Cache: ~/.local/share/databayt/polyhaven/<id>/<res>/. Models default to glTF (jpg textures,
~10x smaller than the .blend's PNGs) — keep res at 1k–2k, disk is tight."""
import hashlib
import json
import os
import urllib.request
import bpy
from ._util import say, collection, link

API = "https://api.polyhaven.com"
UA = "kun-blender-kit"
CACHE = os.path.expanduser("~/.local/share/databayt/polyhaven")


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _json(path):
    return json.loads(_get(API + path))


def search(type="models", categories=None, tags=None, limit=40):
    """-> [{id, name, categories, tags, dims_m, downloads}] sorted by downloads. categories/tags: str or list."""
    q = "?t=" + type
    if categories:
        q += "&c=" + ",".join([categories] if isinstance(categories, str) else categories).replace(" ", "%20")
    d = _json("/assets" + q); want = set([tags] if isinstance(tags, str) else tags or [])
    rows = []
    for k, v in d.items():
        if want and not want & set(v.get("tags", [])):
            continue
        dims = [round(x / 1000, 2) for x in v.get("dimensions", [])] or None
        rows.append({"id": k, "name": v.get("name"), "categories": v.get("categories"), "tags": v.get("tags", [])[:6],
                     "dims_m": dims, "downloads": v.get("download_count", 0)})
    rows.sort(key=lambda r: -r["downloads"])
    return rows[:limit]


def _download(url, dest, md5=None):
    if os.path.exists(dest) and (not md5 or hashlib.md5(open(dest, "rb").read()).hexdigest() == md5):
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    data = _get(url)
    if md5 and hashlib.md5(data).hexdigest() != md5:
        raise IOError("md5 mismatch " + url)
    with open(dest, "wb") as f:
        f.write(data)
    return dest


def _entry(entry, root):
    main = _download(entry["url"], os.path.join(root, os.path.basename(entry["url"])), entry.get("md5"))
    for rel, inc in (entry.get("include") or {}).items():
        _download(inc["url"], os.path.join(root, rel), inc.get("md5"))
    return main


def fetch_model(id, res="2k", fmt="gltf"):
    """-> path to .gltf (default) or .blend, textures/bins alongside. Falls back to the other format."""
    files = _json("/files/" + id)
    for f in (fmt, "blend" if fmt == "gltf" else "gltf"):
        if f not in files:
            continue
        sizes = files[f]; r = res if res in sizes else sorted(sizes)[0]
        root = os.path.join(CACHE, id, r, f)
        path = _entry(sizes[r][f], root)
        say("polyhaven model %s %s %s -> %s" % (id, r, f, path)); return path
    raise KeyError("no gltf/blend for " + id)


def fetch_texture(id, res="1k", maps=("Diffuse", "nor_gl", "Rough", "Displacement", "arm")):
    """-> {map: path} (jpg preferred, png fallback)."""
    files = _json("/files/" + id); got = {}
    for m in maps:
        if m not in files:
            continue
        sizes = files[m]; r = res if res in sizes else sorted(sizes)[0]
        fmt = "jpg" if "jpg" in sizes[r] else next(iter(sizes[r]))
        got[m] = _download(sizes[r][fmt]["url"], os.path.join(CACHE, id, r, os.path.basename(sizes[r][fmt]["url"])), sizes[r][fmt].get("md5"))
    say("polyhaven texture", id, res, sorted(got)); return got


def fetch_hdri(id, res="1k"):
    files = _json("/files/" + id); sizes = files["hdri"]; r = res if res in sizes else sorted(sizes)[0]
    e = sizes[r].get("hdr") or next(iter(sizes[r].values()))
    p = _download(e["url"], os.path.join(CACHE, id, r, os.path.basename(e["url"])), e.get("md5"))
    say("polyhaven hdri", id, r, p); return p


def append_model(path, name=None):
    """Import a fetched model (.gltf/.glb/.blend) into a collection named ph_<name>; returns the collection."""
    name = name or os.path.splitext(os.path.basename(path))[0]
    coll = bpy.data.collections.get("ph_" + name) or bpy.data.collections.new("ph_" + name)
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    if path.endswith((".gltf", ".glb")):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            coll.objects.link(o)
    else:
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
        new = [o for o in dst.objects if o]
        for o in new:
            coll.objects.link(o)
    say("append_model %s: %d objects -> %s" % (os.path.basename(path), len(new), coll.name))
    return coll
