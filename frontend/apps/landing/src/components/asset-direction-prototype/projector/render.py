# ruff: noqa
"""PROTOTYPE (#1469): renders every still for the asset-direction gallery.

run (throwaway venv outside the repo, see ../README.md):
    ~/.cache/energetica-proto-1440/venv/bin/python render.py           # everything
    ~/.cache/energetica-proto-1440/venv/bin/python render.py --png     # also PNG previews in previews/

writes ../renders/**/*.svg and ../renders/manifest.json, which the gallery page reads.
"""

import json
import math
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import palettes  # noqa: E402  (imports the facility modules)
import tiles  # noqa: E402
from core import Camera, Look, OrthoCamera, Scene, fmt, norm  # noqa: E402
from stylize import stylize  # noqa: E402

OUT = HERE.parent / "renders"
PREV = HERE / "previews"

# ---------------------------------------------------------------- the fixed map camera

MAP_AZ = 30.0  # degrees round from the front: a hex vertex points at the viewer
MAP_EL = 30.0  # degrees above the horizon (true isometric would be 35.3)
TILE_PX = 96  # map-tile size on screen, image width
CARD_PX = 320  # facility card size, image width
VB_W = 1.9 * tiles.R  # viewBox around one tile, in world units (the camera scale is 1 px/unit)
VB_H = 2.15 * tiles.R
VB_BOTTOM = 0.5 * tiles.R + tiles.SLAB * math.cos(math.radians(MAP_EL)) + 4

DEFAULT_STYLE = {"palette": "brief", "light": "left", "outline": "none", "texture": "flat"}


def _mirror_sun(sun):
    """The default sun mirrored about the camera's view direction (key light from the right)."""
    c = (math.sin(math.radians(MAP_AZ)), -math.cos(math.radians(MAP_AZ)))
    sx, sz = sun[0], sun[2]
    d = sx * c[0] + sz * c[1]
    return norm((2 * d * c[0] - sx, sun[1], 2 * d * c[1] - sz))


LIGHTS = {
    "left": ("Key light from the left", {}),
    "right": ("Key light from the right", {"sun": _mirror_sun(Look().sun)}),
    "high": (
        "High, soft light",
        {"sun": norm((-0.30, 1.0, -0.22)), "shadow_amount": 0.26, "light_amount": 0.14, "shadow_opacity": 0.16},
    ),
}
OUTLINES = {
    "none": "No lines",
    "tinted": "Edges in a darker tint of each face",
    "ink": "Edges in one dark ink",
    "silhouette": "Outer contour only",
}
TEXTURES = {"flat": "Flat", "grain": "Light grain", "marker": "Loose marker fill (with ink edges)"}


def make_look(palette, light, fac):
    over = palettes.apply(palette, fac)
    look = Look(**over)
    for k, v in LIGHTS[light][1].items():
        setattr(look, k, v)
    return look


def map_scene(look, prefix):
    cam = OrthoCamera.orbit((0, 0, 0), MAP_AZ, MAP_EL, 1.0, (1000, 1000))
    return Scene(cam, look, prefix=prefix)


def map_viewbox(cam, center=(0, 0, 0), w=VB_W, h=VB_H, bottom=VB_BOTTOM):
    u, v = cam.project(center)
    return (u - w / 2, v + bottom - h, w, h)


def finish(s, viewbox, style, px, seed=0):
    svg = s.to_svg(viewbox=viewbox, parallax=False, fit="meet")
    return stylize(svg, outline=style["outline"], texture=style["texture"], px=px, seed=seed)


# ---------------------------------------------------------------- renders


def render_tile(key, style, size_px, prefix):
    look = make_look(style["palette"], style["light"], key)
    s = map_scene(look, prefix)
    tiles.MARKS.clear()
    tiles.tile_with(s, key)
    vb = map_viewbox(s.cam)
    return finish(s, vb, style, size_px / VB_W)


CLOSEUP_W = {
    "nuclear": 70,
    "wind": 26,
    "wind_one": 40,
    "offshore": 34,
    "solar": 36,
    "hydro_dam": 60,
    "coal_mine": 42,
    "battery": 34,
}


def render_closeup(key, style, size_px, prefix):
    look = make_look(style["palette"], style["light"], key)
    s = map_scene(look, prefix)
    tiles.MARKS.clear()
    tiles.tile_with(s, key)
    w = CLOSEUP_W[key]
    h = w * 1.1
    u, v = s.cam.project(tiles.MARKS["closeup"])
    vb = (u - w / 2, v - h / 2, w, h)
    svg = finish(s, vb, style, size_px / w)
    return svg.replace('preserveAspectRatio="xMidYMid meet"', 'preserveAspectRatio="xMidYMid slice"')


FREE_CAM = {
    # key: (azimuth, elevation, distance, target height, focal)
    "nuclear": (-28, 9, 520, 40, 900),
    "wind": (-38, 6, 420, 45, 760),
    "wind_one": (-30, 5, 380, 50, 760),
    "offshore": (-20, 4, 400, 30, 760),
    "solar": (-30, 16, 330, 0, 900),
    "hydro_dam": (-24, 12, 470, 25, 900),
    "coal_mine": (-36, 14, 360, 15, 900),
    "battery": (-34, 11, 300, 6, 900),
}


def render_free(key, style, size_px, prefix):
    look = make_look(style["palette"], style["light"], key)
    az, el, dist, ty, f = FREE_CAM[key]
    a, e = math.radians(az), math.radians(el)
    target = (0, ty, 0)
    eye = (dist * math.cos(e) * math.sin(a), ty + dist * math.sin(e), -dist * math.cos(e) * math.cos(a))
    s = Scene(Camera.look_at(eye, target, f=f, size=(1000, 700)), look, prefix=prefix)
    tiles.MARKS.clear()
    tiles.tile_with(s, key)
    x0, y0, x1, y1 = s.bbox
    cx, cy, w = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, (y1 - y0) * 10 / 7) * 1.12
    vb = (cx - w / 2, cy - w * 0.7 / 2, w, w * 0.7)
    sky = "#efe9dc" if style["palette"] != "banner" else "#d6eff6"
    bg = f'<rect x="{vb[0] - w}" y="{vb[1] - w}" width="{3 * w}" height="{3 * w}" fill="{sky}"/>'
    svg = s.to_svg(viewbox=vb, parallax=False, fit="slice", background=bg)
    return stylize(svg, outline=style["outline"], texture=style["texture"], px=size_px / vb[2])


# a patch of map: axial hex coordinates (q, r) -> what stands there
MINIMAP = {
    (0, 0): "nuclear",
    (0, -1): "wind", (1, -1): "hydro_dam", (1, 0): "battery", (0, 1): "solar", (-1, 1): "coal_mine", (-1, 0): "offshore",
    (-1, -1): "water", (-2, 0): "water", (-2, 1): "water", (0, -2): "forest", (1, -2): "grass", (2, -2): "forest",
    (2, -1): "grass", (2, 0): "forest", (1, 1): "grass", (-2, 2): "water", (-1, 2): "grass", (0, 2): "forest",
}  # fmt: skip


def axial_to_xz(q, r):
    # flat-topped hexes in world space: neighbours sit along the edge normals
    x = tiles.R * 1.5 * q
    z = tiles.R * math.sqrt(3) * (r + q / 2)
    return x, -z  # negative r runs away from the viewer


def render_minimap(style, px_per_unit, prefix):
    look = make_look(style["palette"], style["light"], None)
    s = map_scene(look, prefix)
    for (q, r), key in MINIMAP.items():
        x, z = axial_to_xz(q, r)
        if key in {f[0] for f in tiles.FACILITIES}:
            palettes.apply(style["palette"], key)  # route this facility's accent
        tiles.tile_with(s, key, x, z)
    x0, y0, x1, y1 = s.bbox
    m = 10
    vb = (x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m)
    return finish(s, vb, style, px_per_unit), vb


# ---------------------------------------------------------------- main


def write(rel, svg, manifest_entry, png=False):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(svg)
    manifest_entry["src"] = rel
    manifest_entry["kb"] = round(len(svg.encode()) / 1024, 1)
    if png:
        import resvg_py

        PREV.mkdir(exist_ok=True)
        q = PREV / rel.replace("/", "__").replace(".svg", ".png")
        q.write_bytes(bytes(resvg_py.svg_to_bytes(svg_string=svg, width=int(manifest_entry.get("w", 320)) * 2)))
    return manifest_entry


def main(argv):
    png = "--png" in argv
    if "--quick" in argv:  # iteration: card-size map renders of the named facilities, PNG only
        PREV.mkdir(exist_ok=True)
        import resvg_py

        pal = next((a[2:] for a in argv if a[2:] in palettes.PALETTES), "brief")
        for key in [a for a in argv if not a.startswith("--")] or [f[0] for f in tiles.FACILITIES]:
            st = {**DEFAULT_STYLE, "palette": pal}
            for size in (TILE_PX, CARD_PX):
                svg = render_tile(key, st, size, f"q{key[:3]}{size}")
                (PREV / f"q-{key}-{size}.png").write_bytes(
                    bytes(resvg_py.svg_to_bytes(svg_string=svg, width=size * (1 if size == TILE_PX else 2)))
                )
        return
    only = [a for a in argv if not a.startswith("--")]
    if OUT.exists() and not only:
        shutil.rmtree(OUT)
    facs = [f for f in tiles.FACILITIES if not only or f[0] in only]
    m = {
        "camera": {"azimuth": MAP_AZ, "elevation": MAP_EL, "tilePx": TILE_PX, "cardPx": CARD_PX},
        "facilities": [{"key": k, "label": lbl} for k, lbl, _, _ in tiles.FACILITIES],
        "palettes": {k: v["label"] for k, v in palettes.PALETTES.items()},
        "lights": {k: v[0] for k, v in LIGHTS.items()},
        "outlines": OUTLINES,
        "textures": TEXTURES,
        "default": DEFAULT_STYLE,
        "renders": [],
    }
    R = m["renders"]

    def add(section, key, style, size, svg, **extra):
        name = "-".join([style["palette"], style["light"], style["outline"], style["texture"], str(size)])
        e = {"section": section, "facility": key, "w": size, **style, **extra}
        R.append(write(f"{section}/{key}/{name}.svg", svg, e, png))

    for key, label, _, _ in facs:
        print(key, flush=True)
        # 1. palettes on the map camera, default style
        for pal in palettes.PALETTES:
            st = {**DEFAULT_STYLE, "palette": pal}
            for size in (TILE_PX, CARD_PX):
                add("map", key, st, size, render_tile(key, st, size, f"{key[:3]}{pal[0]}{size}"))
        # 2. the open questions, one axis at a time, in every palette (the page switches palette)
        for pal in palettes.PALETTES:
            for axis, opts in (("light", LIGHTS), ("outline", OUTLINES), ("texture", TEXTURES)):
                for opt in opts:
                    st = {**DEFAULT_STYLE, "palette": pal, axis: opt}
                    if st == {**DEFAULT_STYLE, "palette": pal}:
                        continue  # the default is already in section 1
                    for size in (TILE_PX, CARD_PX):
                        add(
                            "style",
                            key,
                            st,
                            size,
                            render_tile(key, st, size, f"{key[:3]}{pal[0]}{axis[0]}{opt[:2]}{size}"),
                            axis=axis,
                        )
        # 3. close-up and 4. free camera, in every palette
        for pal in palettes.PALETTES:
            st = {**DEFAULT_STYLE, "palette": pal}
            add("closeup", key, st, CARD_PX, render_closeup(key, st, CARD_PX, f"{key[:3]}{pal[0]}c"))
            add("free", key, st, 640, render_free(key, st, 640, f"{key[:3]}{pal[0]}f"))

    if not only:
        # 5. a patch of map at tile size, every palette, default style
        for pal in palettes.PALETTES:
            st = {**DEFAULT_STYLE, "palette": pal}
            svg, vb = render_minimap(st, TILE_PX / VB_W, f"mm{pal[0]}")
            add("minimap", "all", st, round(vb[2] * TILE_PX / VB_W), svg)
            # and the style axes on the map patch too, so they can be judged at tile size together
            for axis, opts in (("light", LIGHTS), ("outline", OUTLINES), ("texture", TEXTURES)):
                for opt in opts:
                    st2 = {**st, axis: opt}
                    if st2 == st:
                        continue
                    svg, vb = render_minimap(st2, TILE_PX / VB_W, f"mm{pal[0]}{axis[0]}{opt[:2]}")
                    add("minimap", "all", st2, round(vb[2] * TILE_PX / VB_W), svg, axis=axis)
        (OUT / "manifest.json").write_text(json.dumps(m, indent=1))
    total = sum(e["kb"] for e in R)
    print(f"{len(R)} renders, {total / 1024:.1f} MB -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
