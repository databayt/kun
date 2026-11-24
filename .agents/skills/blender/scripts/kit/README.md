# kit — headless Blender 5.x scene toolkit

Run anything with `bash .claude/scripts/blender.sh render <script.py> -- <args>`. Modules are small, idempotent
(re-running replaces their own `<prefix>_*` objects), seeded, and print what they applied. Import as
`from kit import terrain, water, sky, ...` inside a stage (`stage.py` puts the right path on `sys.path`).
`_util.py` holds shared helpers (nodes found by type, MENU/enum assignment, slotted-action fcurves).

**introspect.py** — prints Blender version, engines, EEVEE ray-tracing props, the compositor node types this build
has, sky types and enabled add-ons; writes the same as JSON. `blender.sh render kit/introspect.py -- out.json`.

**stage.py** — the stage runner. `--blend in.blend|NEW --stage mod.py --out ckpt.blend --probe probe.png
[--probe-frame N] [--camera NAME] [--res 854x480] [--params p.json] [--probe-samples 12]`. Opens or creates the blend,
imports `mod.py`, calls `run(ctx)` (`ctx = {args, params, scene, kit}`), saves the checkpoint, then renders one
low-sample probe (a temporary overview camera / neutral world / sun are added if the scene has none, and removed;
settings are restored) and prints timings. Any exception prints a trace and exits 1.

**terrain.py** — `build(name, size_xy, res, height_fn | heightmap_png, masks)` makes a displaced grid with POINT
attributes and vertex groups `mask_<key>` from `masks={"road": {"type": "road", "points": [...], "width": 6,
"falloff": 2}, "shore": {"type": "shore", "z": 0.1}, "lawn": {"type": "lawn", "polygons": [...]}}`.
`road_strip(terrain, points, width)` drapes a Catmull-Rom road mesh on the ground; `height_at(terrain, x, y)` samples it.

**water.py** — `build(name, terrain=, level=, center=, size=, res=)`: a lake plane with Principled water
(Transmission Weight 1, IOR 1.33, roughness 0.03), noise-bump ripples whose 4D phase is driven by `frame*speed`, and a
shallow→deep colour ramp from a `depth` attribute (water level minus terrain height).

**sky.py** — `build(az, el, strength, angle, sky_strength, haze=, probe_pos=)`: Nishita sky (multiple scattering)
plus a Sun light placed from compass azimuth (0 = +Y, 90 = +X) and elevation; optional haze volume with a restricted
range and a sphere light probe. The sky's sun disc is off by default (it would light the scene twice).

**materials.py** — `principled(name, base, rough, metal, normal_tex?, bump?)`, `corrugated(name, color, wave_scale)`
(painted steel with procedural ridges), `timber`, `murram`, `grass_ground`, `ground` (grass + murram/sand blended by
the terrain mask attributes), and `remap_gltf_materials(collection)` (sRGB base colour, sane roughness, no emission,
texture-driven metallic removed).

**polyhaven.py** — `search(type, categories, tags)`, `fetch_model(id, res)`, `fetch_texture(id, res)`,
`fetch_hdri(id, res)` (public API, User-Agent `kun-blender-kit`, cache `~/.local/share/databayt/polyhaven/<id>/`),
and `append_model(path) -> collection`. Models default to glTF (jpg textures); keep res at 1k–2k.

**scatter.py** — `scatter(target, instance_collection, density, mask_attribute, seed, scale_range, rot_random,
min_distance, max_camera_distance, exclude=[...], decimate=)`: a geometry-nodes modifier — Poisson Distribute Points on
Faces → Instance on Points (random pick from the collection, random scale/Z rotation) joined to the original mesh.
`count_instances(target, collection)` verifies through the evaluated depsgraph. Scanned trees are ~1M tris: use `decimate`.

**camrig.py** — `build(beats, cameras=, fps=, resample=, shake=)` with beats `[{t, pos, target, lens}]`: an animated
path Empty and target Empty (Bezier, auto-clamped, optionally Catmull-Rom resampled so it never stops at a beat),
cameras parented to the path with Track To (level horizon) and lens keys, optional Noise F-modifier shake, scene fps and
frame range set. Default cameras: landscape 1920x1072 and portrait 1080x2332 (resolution stored on the camera).

**render_settings.py** — `final(scene, samples, raytrace, motion_blur, view, look)`, `probe(scene)`,
`workbench_previz(scene)`. Enums are assigned through try/except and the applied values printed.

**grade.py** — `build(scene, glare, vignette, grain, warm)` creates a compositor group on
`scene.compositing_node_group`: Glare (bloom), Colour Balance (warm gain, cool lift), vignette (ellipse mask → blur →
multiply), grain (a generated noise image soft-lit in; 5.x has no compositor noise node). The Group Output is the render output.

**render_chunks.sh** — `render_chunks.sh <blend> <outdir> <start> <end> [--chunk 240] [--fps 24] [--camera NAME]
[--res WxH] [--min-free-gb 8]`. Renders each chunk with `blender -b -s a -e b -a`, encodes it to
`chunk-<a>-<b>.mp4` (libx264 CRF 12, yuv420p, BT.709), deletes that chunk's PNGs, skips chunks whose mp4 exists (resume),
refuses to run below the free-disk floor, and finally concatenates `full.mp4`.

**examples/toy/** — the proof scene, five stages run through `stage.py`: `s1_terrain`, `s2_water_sky`, `s3_scatter`,
`s4_camera_grade` (shared constants in `common.py`).
