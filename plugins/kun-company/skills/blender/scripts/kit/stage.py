"""stage.py — run one scene stage, checkpoint it, render a probe frame.

  blender.sh render kit/stage.py -- --blend in.blend|NEW --stage stage_module.py --out ckpt.blend \
      --probe probe.png [--probe-frame N] [--camera NAME] [--res 854x480] [--params params.json]

The stage module defines run(ctx); ctx = {"args": Namespace-as-dict, "params": dict, "scene": scene, "kit": kit dir}.
Stage modules import the kit as `from kit import terrain, sky, ...`. Exit status is 1 on any exception."""
import argparse
import importlib.util
import json
import os
import sys
import time
import traceback

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))  # so `import kit.x` works


def parse():
    ap = argparse.ArgumentParser(prog="stage.py")
    ap.add_argument("--blend", default="NEW"); ap.add_argument("--stage", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--probe"); ap.add_argument("--probe-frame", type=int); ap.add_argument("--camera")
    ap.add_argument("--res", default="854x480"); ap.add_argument("--params"); ap.add_argument("--probe-samples", type=int, default=12)
    return ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def _overview_camera(scene):
    """No camera in the blend yet: frame everything from above-behind so early stages still get a probe."""
    from mathutils import Vector
    pts = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == "MESH" and not o.hide_render and o.display_type != "BOUNDS" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))) if pts else Vector((-50, -50, 0))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))) if pts else Vector((50, 50, 10))
    c, d = (lo + hi) / 2, max((hi - lo).x, (hi - lo).y, 20)
    cd = bpy.data.cameras.new("kit_probe_cam"); cd.lens = 28; cd.clip_end = 5000
    co = bpy.data.objects.new("kit_probe_cam", cd); scene.collection.objects.link(co)
    co.location = c + Vector((d * 0.15, -d * 0.75, d * 0.45)); co.rotation_euler = (c - co.location).to_track_quat("-Z", "Y").to_euler()
    return co


def main():
    a = parse(); t0 = time.time()
    params = json.load(open(a.params)) if a.params else {}
    if a.blend == "NEW":
        bpy.ops.wm.read_factory_settings(use_empty=True)
    else:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a.blend))
    sc = bpy.context.scene
    spec = importlib.util.spec_from_file_location("stage_mod", os.path.abspath(a.stage)); mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    ctx = {"args": vars(a), "params": params, "scene": sc, "kit": HERE}
    t1 = time.time(); mod.run(ctx); t2 = time.time()
    out = os.path.abspath(a.out); os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    print("[stage] stage %s ran %.1fs; checkpoint %s (%.1f MB)" % (os.path.basename(a.stage), t2 - t1, out, os.path.getsize(out) / 1e6))
    if a.probe:
        from kit import render_settings
        keep = dict(engine=sc.render.engine, rx=sc.render.resolution_x, ry=sc.render.resolution_y, pct=sc.render.resolution_percentage,
                    cam=sc.camera, frame=sc.frame_current, path=sc.render.filepath, comp=sc.render.use_compositing,
                    mb=sc.render.use_motion_blur, spp=sc.eevee.taa_render_samples, rt=sc.eevee.use_raytracing, gi=sc.eevee.use_fast_gi, view=sc.view_settings.view_transform)
        tmpcam = None
        if a.camera:
            sc.camera = bpy.data.objects[a.camera]
        elif sc.camera is None:
            tmpcam = sc.camera = _overview_camera(sc)
        tmpw = tmpl = None  # early stages have no sky/sun yet: a temporary neutral one, removed after the probe
        if sc.world is None:
            tmpw = sc.world = bpy.data.worlds.new("kit_probe_world"); tmpw.use_nodes = True
            bg = next(n for n in tmpw.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs["Color"].default_value = (0.55, 0.65, 0.8, 1); bg.inputs["Strength"].default_value = 1.0
        if not any(o.type == "LIGHT" for o in sc.objects):
            ld = bpy.data.lights.new("kit_probe_sun", "SUN"); ld.energy = 3.0
            tmpl = bpy.data.objects.new("kit_probe_sun", ld); sc.collection.objects.link(tmpl); tmpl.rotation_euler = (0.9, 0.2, 0.6)
        w, h = (int(v) for v in a.res.lower().split("x")); sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.resolution_percentage = 100
        if a.probe_frame is not None:
            sc.frame_set(a.probe_frame)
        render_settings.probe(sc, samples=a.probe_samples)
        sc.render.filepath = os.path.abspath(a.probe); sc.render.image_settings.file_format = "PNG"
        os.makedirs(os.path.dirname(os.path.abspath(a.probe)), exist_ok=True)
        t3 = time.time(); bpy.ops.render.render(write_still=True)
        print("[stage] probe %s rendered in %.1fs (%dx%d, %d spp)" % (a.probe, time.time() - t3, w, h, a.probe_samples))
        # restore in-memory settings (checkpoint was saved before the probe)
        sc.render.engine = keep["engine"]; sc.render.resolution_x, sc.render.resolution_y = keep["rx"], keep["ry"]
        sc.render.resolution_percentage = keep["pct"]; sc.camera = keep["cam"]; sc.render.filepath = keep["path"]
        sc.render.use_compositing = keep["comp"]; sc.render.use_motion_blur = keep["mb"]; sc.eevee.taa_render_samples = keep["spp"]
        sc.eevee.use_raytracing = keep["rt"]; sc.eevee.use_fast_gi = keep["gi"]; sc.view_settings.view_transform = keep["view"]
        if tmpcam:
            bpy.data.objects.remove(tmpcam, do_unlink=True)
        if tmpl:
            bpy.data.objects.remove(tmpl, do_unlink=True)
        if tmpw:
            sc.world = None; bpy.data.worlds.remove(tmpw)
    print("[stage] total %.1fs" % (time.time() - t0))


try:
    main()
except SystemExit:
    raise
except BaseException:
    traceback.print_exc()
    print("[stage] FAILED", file=sys.stderr)
    sys.exit(1)
