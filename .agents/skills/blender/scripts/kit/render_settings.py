"""render_settings.py — EEVEE presets for 5.x: final(), probe(), workbench_previz(). Enums are read, not assumed."""
import bpy
from ._util import say, set_enum, enum_ids


def _engine(sc):
    got = set_enum(sc.render, "engine", "BLENDER_EEVEE", "BLENDER_EEVEE_NEXT")
    if not got:
        raise RuntimeError("no EEVEE engine in %s" % enum_ids(sc.render, "engine"))
    return got


def _view(sc, view, look):
    vs = sc.view_settings
    v = set_enum(vs, "view_transform", view, "AgX", "Standard")
    l = None
    if look:
        l = set_enum(vs, "look", look, "AgX - " + look, "None")
    return v, l


def final(scene, samples=64, raytrace=True, motion_blur=0.4, view="AgX", look=None, filter_px=1.2):
    sc = scene; applied = {"engine": _engine(sc)}
    e = sc.eevee
    e.taa_render_samples = samples
    e.use_raytracing = bool(raytrace)
    if raytrace:
        applied["ray_method"] = set_enum(e, "ray_tracing_method", "SCREEN", "PROBE")
        o = e.ray_tracing_options
        o.screen_trace_quality = 0.5; o.screen_trace_thickness = 0.3; o.use_denoise = True
        applied["ray_res"] = set_enum(o, "resolution_scale", "1", "2")
    e.use_fast_gi = True
    applied["fast_gi"] = set_enum(e, "fast_gi_method", "GLOBAL_ILLUMINATION")
    e.use_shadows = True; e.shadow_ray_count = 2; e.shadow_step_count = 8
    e.use_volumetric_shadows = False
    e.volumetric_samples = 48; e.volumetric_tile_size = "2"
    sc.render.filter_size = filter_px
    sc.render.use_motion_blur = motion_blur > 0
    if motion_blur > 0:
        sc.render.motion_blur_shutter = motion_blur
    sc.render.film_transparent = False
    sc.render.use_compositing = True
    applied["view"], applied["look"] = _view(sc, view, look)
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_depth = "8"
    applied.update(samples=samples, raytrace=bool(raytrace), motion_blur=motion_blur, filter=filter_px)
    say("render_settings.final applied", applied)
    return applied


def probe(scene, samples=12):
    sc = scene; applied = {"engine": _engine(sc)}
    e = sc.eevee
    e.taa_render_samples = samples; e.use_raytracing = False; e.use_fast_gi = False
    e.shadow_ray_count = 1; e.shadow_step_count = 4; e.volumetric_samples = 16
    sc.render.use_motion_blur = False; sc.render.use_compositing = False
    sc.render.resolution_percentage = 100
    applied["view"], _ = _view(sc, "AgX", None)
    applied["samples"] = samples
    say("render_settings.probe applied", applied)
    return applied


def workbench_previz(scene):
    sc = scene
    set_enum(sc.render, "engine", "BLENDER_WORKBENCH")
    sh = sc.display.shading
    sh.light = "STUDIO"; sh.color_type = "SINGLE"; sh.single_color = (0.65, 0.65, 0.65)
    sh.show_shadows = True; sh.show_cavity = True
    sc.render.use_motion_blur = False; sc.render.use_compositing = False
    _view(sc, "Standard", None)
    say("render_settings.workbench_previz applied engine", sc.render.engine)
    return {"engine": sc.render.engine}
