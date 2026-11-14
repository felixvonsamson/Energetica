# ruff: noqa
"""PROTOTYPE (issue #1440): renders every facility on its own, with one shared camera angle and sun,
as stand-alone SVG assets (the `facilities` variant) and PNG previews.

run (needs resvg_py for the PNGs, so use the throwaway venv):
    ~/.cache/energetica-proto-1440/venv/bin/python gallery.py            # all facilities + contact sheet
    ~/.cache/energetica-proto-1440/venv/bin/python gallery.py nuclear    # just one (fast iteration)
    ... gallery.py nuclear --outline 1.2                                  # with ink outlines

writes:
    ../projected/facilities/<key>.svg   the asset
    previews/<key>.png                  a PNG of it (gitignored scratch)
    previews/gallery.png                contact sheet of all assets (when run without keys)
"""

import importlib
import math
import pkgutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from core import Camera, Look, Scene  # noqa: E402
import facilities  # noqa: E402
import palette as P  # noqa: E402

OUT = HERE.parent / "projected" / "facilities"
PREV = HERE / "previews"

# One camera direction for every asset: from the front right, a bit above. The sun comes from
# the upper left (core.Look.sun), so fronts are lit and right-hand sides are in shade.
AZIMUTH = 32.0  # degrees, camera swung round to the right of the front
ELEVATION = 22.0  # degrees above the horizon


def facility_modules():
    return {m.name: importlib.import_module(f"facilities.{m.name}") for m in pkgutil.iter_modules(facilities.__path__)}


def render(key, mod, outline=0.0):
    w, h, d = mod.EXTENT
    span = max(w, h, d)
    target = (0, h * 0.4, 0)
    dist = span * 3.2
    az, el = math.radians(AZIMUTH), math.radians(ELEVATION)
    eye = (dist * math.cos(el) * math.sin(az), target[1] + dist * math.sin(el), -dist * math.cos(el) * math.cos(az))
    cam = Camera.look_at(eye, target, f=1000, size=(1000, 1000))
    s = Scene(cam, Look(outline=outline), prefix=f"f-{key}")
    # a patch of grass to stand on, so shadows and pads read
    # offset towards where shadows fall (away from the sun: +x, +z)
    r = max(w, d) * 0.85
    s.ground(
        [
            (r * 0.18 + r * math.cos(2 * math.pi * i / 48), r * 0.12 + r * 0.8 * math.sin(2 * math.pi * i / 48))
            for i in range(48)
        ],
        P.grass,
        prio=-10,
    )
    mod.build(s)
    return s.to_svg(parallax=False, fit="meet")


def to_png(svg, path, width=900):
    import resvg_py

    data = resvg_py.svg_to_bytes(svg_string=svg, width=width)
    path.write_bytes(bytes(data))


def main(argv):
    outline = 0.0
    if "--outline" in argv:
        i = argv.index("--outline")
        outline = float(argv[i + 1])
        argv = argv[:i] + argv[i + 2 :]
    mods = facility_modules()
    keys = argv or sorted(mods)
    OUT.mkdir(parents=True, exist_ok=True)
    PREV.mkdir(exist_ok=True)
    pngs = []
    for key in keys:
        svg = render(key, mods[key], outline)
        (OUT / f"{key}.svg").write_text(svg)
        png = PREV / f"{key}.png"
        to_png(svg, png)
        pngs.append(png)
        print(f"{key}: {len(svg) / 1024:.1f} KB -> {png}")
    if not argv:
        from PIL import Image

        ims = [Image.open(p).convert("RGBA") for p in pngs]
        cols = 3
        cw = max(im.width for im in ims)
        ch = max(im.height for im in ims)
        sheet = Image.new("RGBA", (cw * cols, ch * math.ceil(len(ims) / cols)), "#f3f1ea")
        for i, im in enumerate(ims):
            sheet.alpha_composite(
                im, ((i % cols) * cw + (cw - im.width) // 2, (i // cols) * ch + (ch - im.height) // 2)
            )
        sheet.convert("RGB").save(PREV / "gallery.png")
        print("contact sheet ->", PREV / "gallery.png")


if __name__ == "__main__":
    main(sys.argv[1:])
