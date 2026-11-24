"""camrig.py — camera path from beats [{t, pos, target, lens}]: a path Empty (position) and a target Empty,
both with smooth Bezier keys; cameras are children of the path Empty with Track To / Damped Track to the target, so several
cameras (landscape + portrait) share one path. Optional Catmull-Rom resample avoids stops at beats."""
import json
import bpy
from mathutils import Vector
from ._util import say, purge, link, fcurves, collection

P = "cam_"


def _catmull(vals, ts, dt):
    """Catmull-Rom (non-uniform → parametrised per segment) through (ts, vals); returns dense (t, v) lists."""
    n = len(vals); out_t, out_v = [], []
    ext_v = [vals[0] * 2 - vals[1]] + list(vals) + [vals[-1] * 2 - vals[-2]]
    for i in range(n - 1):
        p0, p1, p2, p3 = ext_v[i], ext_v[i + 1], ext_v[i + 2], ext_v[i + 3]
        k = max(1, round((ts[i + 1] - ts[i]) / dt))
        for j in range(k):
            u = j / k
            out_t.append(ts[i] + u * (ts[i + 1] - ts[i]))
            out_v.append(0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u ** 3))
    out_t.append(ts[-1]); out_v.append(vals[-1])
    return out_t, out_v


def _key(obj, prop, series, fps, handle="AUTO_CLAMPED"):
    for f, v in series:
        setattr(obj, prop, v) if not isinstance(v, (tuple, list, Vector)) else setattr(obj, prop, v)
        obj.keyframe_insert(prop, frame=f)
    for fc in fcurves(obj):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"; kp.handle_left_type = kp.handle_right_type = handle


def _lens_key(cam, series):
    for f, v in series:
        cam.lens = v; cam.keyframe_insert("lens", frame=f)
    for fc in fcurves(cam):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"; kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"


def _shake(obj, prop, amp, fps, seedoff):
    for i, fc in enumerate(fcurves(obj)):
        if fc.data_path != prop:
            continue
        m = fc.modifiers.new("NOISE"); m.scale = fps * 1.6; m.strength = amp; m.phase = seedoff * 7.3 + i * 3.1; m.depth = 1
        m.blend_type = "ADD"


def build(beats, cameras=None, fps=24, resample=0.5, shake=0.0, name="rig", frame_start=1, track="track_to"):
    """beats: list or JSON path. cameras: [{"name","res":(w,h)}]; default one landscape 1920x1072 + one portrait 1080x2332."""
    if isinstance(beats, str):
        beats = json.load(open(beats))
    cameras = cameras or [{"name": "landscape", "res": (1920, 1072)}, {"name": "portrait", "res": (1080, 2332)}]
    sc = bpy.context.scene; purge(P + name)
    ts = [b["t"] for b in beats]; sc.render.fps = fps
    f = lambda t: frame_start + t * fps
    coll = collection("camera")
    path = bpy.data.objects.new(P + name + "_path", None); path.empty_display_type = "SPHERE"; path.empty_display_size = 0.4; link(path, coll)
    tgt = bpy.data.objects.new(P + name + "_target", None); tgt.empty_display_type = "PLAIN_AXES"; link(tgt, coll)
    for obj, key in ((path, "pos"), (tgt, "target")):
        cols = [[b[key][a] for b in beats] for a in range(3)]
        if resample and len(beats) > 2:
            dense = [_catmull(c, ts, resample) for c in cols]; tt = dense[0][0]
            series = [(f(t), Vector((dense[0][1][i], dense[1][1][i], dense[2][1][i]))) for i, t in enumerate(tt)]
        else:
            series = [(f(t), Vector(b[key])) for t, b in zip(ts, beats)]
        _key(obj, "location", series, fps)
        if shake:
            _shake(obj, "location", shake * (0.5 if key == "pos" else 1.0), fps, 1 if key == "pos" else 2)
    made = []
    for c in cameras:
        cd = bpy.data.cameras.new(P + name + "_" + c["name"]); cd.sensor_width = 36.0; cd.clip_end = 3000
        co = bpy.data.objects.new(P + name + "_" + c["name"], cd); link(co, coll); co.parent = path
        tr = co.constraints.new("TRACK_TO" if track == "track_to" else "DAMPED_TRACK"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"
        if track == "track_to":
            tr.up_axis = "UP_Y"  # Z-up world: keeps the horizon level (Damped Track lets roll drift)
        _lens_key(cd, [(f(b["t"]), b.get("lens", 35)) for b in beats])
        co["res_x"], co["res_y"] = c["res"]
        made.append(co)
    sc.frame_start = frame_start; sc.frame_end = int(round(f(ts[-1])))
    sc.camera = made[0]; sc.render.resolution_x, sc.render.resolution_y = made[0]["res_x"], made[0]["res_y"]
    say("camrig %s: %d beats over %.1fs @%dfps, frames %d..%d, cameras %s, resample %s, shake %s"
        % (name, len(beats), ts[-1] - ts[0], fps, sc.frame_start, sc.frame_end, [(o.name, o["res_x"], o["res_y"]) for o in made], resample, shake))
    return made, path, tgt
