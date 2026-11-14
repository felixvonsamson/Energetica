# Throwaway prototype script: type annotations add nothing here.
# ruff: noqa
"""PROTOTYPE (issue #1440): preprocessing for the raster-depth hero variant.

Reads the original banner and ../depth/banner-depth.png and writes, next to this file:

- maps.png   full size, RGB. R = depth for parallax (255 = nearest; turbine blades
             replaced by what is behind them, near edges dilated into far, slightly
             blurred). G = water mask (spillways + lake). B = sky mask (where clouds drift).
- rotor.png  full size, RGB. R = blade fill mask (where the patch replaces the banner),
             G = blade alpha (what gets redrawn rotating), B = owning turbine (60 * (index + 1)).
- patch.png  crop of the turbine area with the blades painted out (diffusion inpainting).
- sky.png    1/8 size, RGB. Cloud-free sky gradient, used under the drifting clouds.

Run with the throwaway venv (numpy, scipy, Pillow):
  ~/.cache/energetica-proto-1440/venv/bin/python make_maps.py [--debug]
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = Path(__file__).parent
BANNER = HERE.parents[2] / "assets" / "energetica_landing_banner.webp"
DEPTH = HERE.parent / "depth" / "banner-depth.png"
DEBUG = "--debug" in sys.argv

img = np.asarray(Image.open(BANNER).convert("RGB")).astype(np.float32)
dep = np.asarray(Image.open(DEPTH).convert("L")).astype(np.float32)
H, W = dep.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# Shared with raster-depth/shaders.ts (keep in sync). Hub = rotation centre, R = rotor radius,
# core = hub disc that stays static, nacelle = static box (x0, y0, x1, y1), mast = (x offset from hub, half width).
# The small turbine at (630.6, 284.4) stays static: its blades are too faint against the haze and
# the dam to cut out cleanly (the inpainted background showed a blue smear).
TURBINES = [
    dict(hub=(730.5, 186.0), R=100, core=6.0, nacelle=(741, 181, 758, 197), mast=(5.0, 7.5)),
    dict(hub=(836.0, 245.5), R=72, core=4.5, nacelle=(842, 241, 854, 248), mast=(3.0, 6.0)),
    dict(hub=(938.0, 275.0), R=36, core=3.0, nacelle=(936, 272, 943, 278), mast=(1.2, 3.5)),
]
PATCH = (620, 75, 1000, 340)  # x0, y0, x1, y1 of patch.png, covers every rotor disc
# Painted steam plumes stay attached to their towers instead of drifting with the clouds.
PLUMES = [(990, 30, 1265, 178), (1320, 70, 1500, 188)]


def save(name, arr):
    Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8)).save(HERE / name, optimize=True)


def debug(name, arr):
    if DEBUG:
        (HERE / "_debug").mkdir(exist_ok=True)
        Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8)).save(HERE / "_debug" / name)


def inpaint(rgb, unknown, iters=600):
    """Diffusion fill of `unknown` pixels from their surroundings."""
    out = rgb.copy()
    known = ~unknown
    filled = known.copy()
    for s in (1.5, 4, 12, 36):  # coarse initial guess: normalised convolution
        w = ndi.gaussian_filter(known.astype(np.float32), s)
        v = np.stack([ndi.gaussian_filter(rgb[..., c] * known, s) for c in range(3)], -1)
        take = ~filled & (w > 1e-3)
        out[take] = v[take] / w[take][:, None]
        filled |= take
    k = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], np.float32) / 4
    for _ in range(iters):
        avg = np.stack([ndi.convolve(out[..., c], k, mode="nearest") for c in range(3)], -1)
        out[unknown] = avg[unknown]
    return out


# ---------- turbines: blade alpha, fill mask, inpainted patch ----------
in_core = np.zeros((H, W), bool)
in_disc = np.zeros((H, W), bool)
for t in TURBINES:
    hx, hy = t["hub"]
    r = np.hypot(xx - hx, yy - hy)
    x0, y0, x1, y1 = t["nacelle"]
    nacelle = (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    mast = (np.abs(xx - hx - t["mast"][0]) <= t["mast"][1] + (yy - hy) * 0.02) & (yy > hy + t["core"])
    in_core |= ((r <= t["core"]) | nacelle | mast) & (r <= t["R"] + 4)
    in_disc |= r <= t["R"] + 4

bg_dep = ndi.grey_opening(dep, size=(17, 17))
thin = np.clip((dep - bg_dep - 3) / 10, 0, 1) * in_disc  # thin near structures: blades (+ mast)
px0, py0, px1, py1 = PATCH
crop = np.s_[py0:py1, px0:px1]


def inpaint_crop(unknown):
    out = img.copy()
    out[crop] = inpaint(img[crop], unknown[crop])
    return out


rough = ndi.binary_dilation(thin > 0.05, iterations=3) & in_disc & ~in_core
bg1 = inpaint_crop(rough | in_core & in_disc)
diff = np.abs(img - bg1).max(-1)
alpha = np.clip((diff - 6) / 40, 0, 1) * ndi.binary_dilation(thin > 0.05, iterations=2) * in_disc * ~in_core
alpha = ndi.grey_closing(alpha, size=(2, 2))
# Keep only blade pieces connected to a hub, and remember which turbine owns them so a
# rotor never picks up its neighbour's blades.
lab, _ = ndi.label(alpha > 0.04)
owner_of_label = np.zeros(lab.max() + 1, np.uint8)
# Loose pieces (e.g. a blade tip cut off by the threshold) go to the nearest hub...
centroids = ndi.center_of_mass(alpha > 0.04, lab, range(1, lab.max() + 1))
for label, (cy, cx) in enumerate(centroids, start=1):
    dist = [np.hypot(cx - t["hub"][0], cy - t["hub"][1]) / t["R"] for t in TURBINES]
    if min(dist) <= 1.05:
        owner_of_label[label] = int(np.argmin(dist)) + 1
# ...but anything touching a hub belongs to that hub.
for i, t in enumerate(TURBINES):
    near_hub = np.hypot(xx - t["hub"][0], yy - t["hub"][1]) <= max(t["core"] + 4, t["R"] * 0.25)
    owner_of_label[np.unique(lab[near_hub & (lab > 0)])] = i + 1
owner = owner_of_label[lab]
owner = np.where(alpha > 0, ndi.grey_dilation(owner, size=(5, 5)), 0)
alpha = alpha * (owner > 0)
fill = ndi.binary_dilation(alpha > 0.03, iterations=2) & ~in_core
background = inpaint_crop(fill)
debug("blade_alpha.png", alpha[crop] * 255)
debug("debladed.png", np.where(fill[..., None], background, img)[crop])

save("patch.png", background[crop])
fill_soft = ndi.gaussian_filter(fill.astype(np.float32), 0.7) * (fill | ndi.binary_dilation(fill))
save("rotor.png", np.stack([fill_soft * 255, alpha * 255, owner * 60.0], -1))

debladed = np.where(fill_soft[..., None] > 0, img * (1 - fill_soft[..., None]) + background * fill_soft[..., None], img)
dep_bg = np.where(fill, ndi.grey_opening(dep, size=(21, 21)), dep)

# ---------- parallax depth: dilate near into far, then soften ----------
d = ndi.grey_dilation(dep_bg, size=(5, 5))
d = ndi.gaussian_filter(d, 1.5)
d = np.maximum(d, dep_bg)  # never let the blur pull a near pixel back
debug("depth.png", d)

# ---------- sky mask ----------
r, g, b = debladed[..., 0], debladed[..., 1], debladed[..., 2]
skyish = (dep_bg <= 2.5) & (b > 200) & (yy < 340)
for x0, y0, x1, y1 in PLUMES:
    skyish &= ~((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1))
skyish = ndi.binary_opening(skyish, iterations=2)
lab, n = ndi.label(skyish)
sizes = ndi.sum(skyish, lab, range(1, n + 1))
skyish = np.isin(lab, 1 + np.flatnonzero(sizes > 2000))
sky = ndi.binary_erosion(skyish, iterations=1)
sky_soft = ndi.gaussian_filter(sky.astype(np.float32), 1.0) * skyish

# ---------- cloud-free sky plate ----------
blue = b - r
local_best = ndi.maximum_filter1d(np.where(sky, blue, -999), 301, axis=1)
clear = sky & (blue >= local_best - 10)
plate = np.zeros_like(img)
done = np.zeros((H, W), bool)
for sx, sy in ((60, 3), (150, 6), (400, 15), (1200, 40)):
    w = ndi.gaussian_filter(clear.astype(np.float32), (sy, sx))
    v = np.stack([ndi.gaussian_filter(debladed[..., c] * clear, (sy, sx)) for c in range(3)], -1)
    take = ~done & (w > 0.02)
    plate[take] = v[take] / w[take][:, None]
    done |= take
plate = ndi.gaussian_filter(plate, (2, 8, 0))
debug("plate.png", np.where(sky[..., None], plate, img * 0.4))
debug("residual.png", np.where(sky[..., None], 128 + (debladed - plate), 0))
small = Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).resize((W // 8, H // 8), Image.BOX)
small.save(HERE / "sky.png", optimize=True)

# ---------- water ----------
water_box = np.zeros((H, W), bool)
poly_spill = (xx >= 212) & (xx <= 452) & (yy >= 330) & (yy <= 455)
poly_lake = (xx >= 285) & (xx <= 540) & (yy >= 440) & (yy <= 560)
water_box = poly_spill | poly_lake
waterish = water_box & (b > 190) & (b - r > 12) & (dep < 60)
waterish = ndi.binary_opening(waterish, iterations=1)
water = ndi.gaussian_filter(waterish.astype(np.float32), 1.0) * ndi.binary_dilation(waterish)
debug("water.png", np.where(water[..., None] > 0.5, img, img * 0.3))

save("maps.png", np.stack([d, water * 255, sky_soft * 255], -1))
print("wrote maps.png rotor.png patch.png sky.png to", HERE)
