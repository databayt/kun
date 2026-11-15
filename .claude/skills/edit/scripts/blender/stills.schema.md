# stills.json — a camera over still images

`stills.py` renders a "stills film": an orthographic camera that moves over still images, zooms into
a sub-rectangle of one image while a child image takes over, and writes PNG frames. Headless, free.

```bash
blender.sh render stills.py -- scene.json outdir [--aspect landscape|portrait] [--scale 0.5] \
                                [--legs id1,id2] [--frames 1,91,180]
blender.sh stills scene.json outdir [--aspect …] [--scale …] [--legs …]   # render + encode each leg
```

Frames land in `<outdir>/<leg>/<aspect>/00001.png…`; `blender.sh stills` encodes each leg+aspect to
`<outdir>/<leg>-<aspect>.mp4` (mezzanine: H.264 CRF 10, yuv420p, tv-range BT.709, tagged). FilmCraft
imports it like any clip (`assemble.mjs` item `{"type":"clip","src":{"16:9":…,"9:16":…}}`).
`--scale 0.5` renders half-size proxies; `--frames` (1-based, comma list) renders only those frames
(no encode), for checking a moment. Measured on the M4: ~0.12 s/frame at 1920x1072.

## Scene

```json
{
  "fps": 30,
  "aspects": { "landscape": [1920, 1072], "portrait": [1080, 2332] },
  "images": [
    { "id": "farm", "src": "/abs/outlook.jpg" },
    { "id": "studio", "src": "/abs/studio-hero.jpg", "parent": "farm", "rect": [0.60, 0.33, 0.12], "feather": 0.12 },
    { "id": "hero", "src": "/abs/desktop-1920.webp", "parent": "farm", "rect": [0.3, 0.05, 0.4],
      "portrait": { "src": "/abs/mobile-1920.webp", "rect": [0.45, 0.02, 0.1] } }
  ],
  "legs": [
    { "id": "01-open", "seconds": 6,
      "keys": [ { "t": 0, "image": "hero", "c": [0.5, 0.5], "h": 1.0 },
                { "t": 6, "image": "farm", "c": [0.5, 0.5], "h": 1.0, "ease": "inOutSine" } ],
      "opacity": [ { "image": "hero", "keys": [[0, 1], [2.5, 1], [4.5, 0]] } ] }
  ]
}
```

Relative `src` paths resolve against the scene file's folder.

### `aspects`
`name -> [width, height]`. Defaults above (1920x1072 landscape, 1080x2332 portrait). Any names work;
`landscape` / `portrait` are the override keys used below. `--scale` rounds sizes to even.

### `images` (a tree)
- A root image (no `parent`) occupies world x in [0, 1], y in [0, H/W] (y down, image terms).
- A child's `rect` = `[x, y, w]` or `[x, y, w, h]` in the parent's normalized coordinates (0..1 of the
  parent's width and height). Without `h` the child keeps its own pixel aspect.
- Children draw above parents (a small z step per tree depth, then list order).
- `feather` (0..0.5, default 0): a soft alpha ramp at the image's edges, as a fraction of its
  shorter side (smoothstep 0 at the edge to 1 at `feather` in), multiplied with opacity. Use it so a
  child fading in over its parent shows no hard rectangle.
- Textures load at full resolution, sRGB, linear interpolation (GPU mipmaps: no aliasing when far out).

### `legs[]`
`id`, `seconds` (frames = seconds x fps; the last frame is 1/fps short of the final key, so legs join
with no repeated frame), `keys[]`, optional `opacity[]`, `interp`, `easeEnds`, `carry`.

**Camera key**: `t` (s), `image`, `c` = frame centre in that image's normalized coords, `h` = visible
frame height as a fraction of that image's height, optional `ease`. Both aspects share `c` and `h`, so
the portrait frame is a narrow upright slice of the same view. `h = 1`, `c = [.5, .5]` on an image whose
aspect equals the output aspect fills the frame exactly.

**Default motion** (`interp` omitted): per segment, from key i to key i+1 (the `ease` on the arriving key
i+1 shapes it; `linear`, `inOutSine` (default), `inOutCubic`, `outCubic`, `inCubic`). Keys convert to
world (centre, frame height); the frame height interpolates in **log space**. When
`|ln(h1/h0)| > 0.05` the centre follows the zoom about its fixed point: `s = (h(t) - h0)/(h1 - h0)`
applied to the centre, so a push into a point feels natural; otherwise the centre eases with `t`.
Before the first key and after the last the camera holds.

**`"interp": "spline"`** (leg level): the path goes through every key with continuous velocity, a
Catmull-Rom (uniform in time, using the keys' `t`) over world cx, world cy and ln(frame height). End
tangents are clamped from the neighbour; with `"easeEnds": true` the camera starts and stops at rest
(zero end velocity: an ease-in at the first key and ease-out at the last). Per-key `ease` is not used
in spline mode.
Two equal keys in a row are a **hold**: the camera has zero velocity at both, so the frames between them stay still (e.g. a still first second on a hero frame).

**`"carry": true`** (leg level): the first key is taken from the previous leg's final camera state, so
legs join with no jump; `image`, `c`, `h` may be omitted on that first key (it still needs `t`).

**`opacity[]`**: `{ "image", "keys": [[seconds, value], ...], "curve": "smooth"? }`. Linear between keys
(`"curve": "smooth"` = smoothstep). Before its first key an image keeps the opacity it carried in;
after the last it holds. State carries across legs. Defaults: roots 1, children 0 (opacity 0 = not rendered).

### Per-aspect overrides
Any image, camera key or opacity entry may carry a `"landscape": {…}` / `"portrait": {…}` object (the
aspect's name); its fields override for that aspect only (different `src`, `rect`, `c`, `h`, `keys`).

## Rendering guarantees
Emission-only material (texture to emission strength 1, mixed with transparent by opacity x texture alpha
x feather), sRGB textures, view transform Standard, look None, exposure 0, film filter 0, dither 0,
1 sample, no bloom/AO/motion blur, 8-bit PNG. Proof: a frame of a 1920x1072 image at `h = 1` in a
1920x1072 output differs from the source by mean 0.000 / max 0 (of 255).
