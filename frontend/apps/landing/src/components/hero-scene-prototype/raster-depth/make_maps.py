# Throwaway prototype script: type annotations add nothing here.
# ruff: noqa
"""PROTOTYPE (issue #1440): preprocessing for the raster-depth hero variant.

Splits the original banner into two depth layers plus overlays, and writes next to this file:

- fg.png     full size, RGB. Foreground layer colour (cooling towers and their steam plumes,
             vent stack, reactor, gas plant, turbine masts, H2 plant, dry cooler, batteries),
             un-mixed from the background so that compositing it over bg.png gives back the
             original pixels exactly. Black where there is no foreground.
- bg.png     full size, RGB. What is behind the foreground and behind the turbine blades,
             inpainted (OpenCV) or, behind the plumes, the cloud-free sky. Black where the
             banner itself is the background.
- layers.png full size, RGB. R = foreground alpha, G = foreground depth (extended past the
             silhouettes so the shader's fixed-point search is stable), B = where bg.png
             replaces the banner in the background layer.
- maps.png   full size, RGB. R = background depth (255 = nearest; foreground and blades
             replaced by what is behind them, lightly dilated and blurred), G = water mask,
             B = sky mask (where clouds drift).
- rotor.png  full size, RGB. G = blade alpha (redrawn rotating), B = owning turbine
             (60 * (index + 1)). R unused.
- sky.png    1/8 size, RGB. Cloud-free sky gradient, used under the drifting clouds.

Run with the throwaway venv (numpy, scipy, Pillow, opencv-python-headless):
  ~/.cache/energetica-proto-1440/venv/bin/python make_maps.py [--debug]
--debug writes inspection images to _debug/ (gitignored).
"""

import sys
from pathlib import Path

import cv2
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

# Shared with shaders.ts (same order). Hub = rotation centre, R = rotor radius, core = hub
# disc that stays static, nacelle = static box (x0, y0, x1, y1), mast = (x offset from hub,
# half width). `tips` = blade tips for a hand-drawn blade mask (the small far turbine, whose
# blades are too faint for the automatic mask); `ghosts` = extra faint blade strokes in the
# painting that are painted out but not redrawn.
TURBINES = [
    dict(hub=(730.5, 186.0), R=100, core=6.0, nacelle=(741, 181, 758, 197), mast=(5.0, 7.5)),
    dict(hub=(836.0, 245.5), R=72, core=4.5, nacelle=(842, 241, 854, 248), mast=(3.0, 6.0)),
    dict(
        hub=(630.8, 285.0),
        R=50,
        core=3.0,
        nacelle=(633, 283, 643, 290),
        mast=(1.0, 3.0),
        tips=[(614.5, 241.5), (677.5, 272.5), (603.5, 328.5)],
        ghosts=[(659.0, 316.0)],
    ),
    dict(hub=(938.0, 275.0), R=36, core=3.0, nacelle=(936, 272, 943, 278), mast=(1.2, 3.5)),
]
TURBINE_PATCH = (570, 75, 1000, 345)  # area the blade work is confined to

# Foreground objects: depth stands out from the rest of its row inside these boxes.
FG_BOXES = [
    (945, 120, 1470, 470),  # cooling towers, reactor, vent stack
    (1370, 215, 1712, 512),  # gas plant and its stacks
    (1720, 385, 2125, 572),  # dry cooler
    (440, 560, 856, 702),  # batteries
    (650, 410, 1080, 580),  # hydrogen plant
    (715, 180, 750, 400),  # turbine masts (blades are handled separately)
    (826, 240, 852, 385),
    (624, 280, 640, 380),
    (930, 270, 946, 345),
]
# Steam plumes: seed boxes just above each cooling tower mouth, a generous search box,
# and a depth just behind the tower they belong to (so it rises from inside the rim and the
# animated puffs, drawn only in front of things farther than the tower, can cover it).
PLUMES = [
    dict(seed=(1000, 140, 1110, 172), search=(960, 0, 1320, 200), depth=38),
    dict(seed=(1335, 158, 1425, 182), search=(1300, 20, 1530, 205), depth=39),
]


def save(name, arr):
    Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8)).save(HERE / name, optimize=True)


def debug(name, arr):
    if DEBUG:
        (HERE / "_debug").mkdir(exist_ok=True)
        Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8)).save(HERE / "_debug" / name)


def overlay(mask):
    """Debug view: mask at full brightness, the rest dimmed."""
    m = np.clip(mask, 0, 1)[..., None]
    return img * (0.3 + 0.7 * m)


def inpaint(rgb, unknown, radius=5, method=cv2.INPAINT_TELEA):
    src = np.clip(rgb, 0, 255).round().astype(np.uint8)
    out = cv2.inpaint(src, unknown.astype(np.uint8), radius, method)
    return np.where(unknown[..., None], out.astype(np.float32), rgb)


def inpaint_depth(d, unknown):
    src = np.clip(d, 0, 255).round().astype(np.uint8)
    out = cv2.inpaint(src, unknown.astype(np.uint8), 7, cv2.INPAINT_TELEA).astype(np.float32)
    return np.where(unknown, out, d)


def box(b):
    x0, y0, x1, y1 = b
    return (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)


def segment_dist(p0, p1):
    (x0, y0), (x1, y1) = p0, p1
    vx, vy = x1 - x0, y1 - y0
    t = np.clip(((xx - x0) * vx + (yy - y0) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(xx - (x0 + t * vx), yy - (y0 + t * vy)), t


# ---------- turbines: blade alpha, owner, fill mask ----------
in_core = np.zeros((H, W), bool)
discs = []
for t in TURBINES:
    hx, hy = t["hub"]
    r = np.hypot(xx - hx, yy - hy)
    nacelle = box(t["nacelle"])
    mast = (np.abs(xx - hx - t["mast"][0]) <= t["mast"][1] + (yy - hy) * 0.02) & (yy > hy + t["core"])
    in_core |= ((r <= t["core"]) | nacelle | mast) & (r <= t["R"] + 4)
    discs.append(r <= t["R"] + 4)
in_patch = box(TURBINE_PATCH)
auto_disc = np.zeros((H, W), bool)
for t, disc in zip(TURBINES, discs):
    if "tips" not in t:
        auto_disc |= disc

# Automatic blades: thin structures that stand out in depth, refined by colour.
bg_dep = ndi.grey_opening(dep, size=(17, 17))
thin = np.clip((dep - bg_dep - 3) / 10, 0, 1) * auto_disc
rough = ndi.binary_dilation(thin > 0.05, iterations=3) & auto_disc & ~in_core
bg1 = inpaint(img, rough, radius=4)
diff = np.abs(img - bg1).max(-1)
alpha = np.clip((diff - 6) / 40, 0, 1) * ndi.binary_dilation(thin > 0.05, iterations=2) * auto_disc * ~in_core
alpha = ndi.grey_closing(alpha, size=(4, 4)) * auto_disc * ~in_core  # bridge small gaps, e.g. before red tips
lab, _ = ndi.label(alpha > 0.04)
owner_of_label = np.zeros(lab.max() + 1, np.uint8)
centroids = ndi.center_of_mass(alpha > 0.04, lab, range(1, lab.max() + 1))
for label, (cy, cx) in enumerate(centroids, start=1):  # loose pieces go to the nearest hub...
    dist = [np.hypot(cx - t["hub"][0], cy - t["hub"][1]) / t["R"] if "tips" not in t else 99 for t in TURBINES]
    if min(dist) <= 1.05:
        owner_of_label[label] = int(np.argmin(dist)) + 1
for i, t in enumerate(TURBINES):  # ...but anything touching a hub belongs to that hub
    if "tips" in t:
        continue
    near_hub = np.hypot(xx - t["hub"][0], yy - t["hub"][1]) <= max(t["core"] + 4, t["R"] * 0.25)
    owner_of_label[np.unique(lab[near_hub & (lab > 0)])] = i + 1
owner = owner_of_label[lab]
owner = np.where(alpha > 0, ndi.grey_dilation(owner, size=(5, 5)), 0)
alpha = alpha * (owner > 0)
fill = ndi.binary_dilation(alpha > 0.03, iterations=2) & ~in_core

# Blade roots: where a blade crosses the mast or nacelle it was excluded above, which left
# a gap between the rotating blade and the hub. Add a short stroke from the hub towards
# each blade, and paint the mast or nacelle back in under it.
for i, t in enumerate(TURBINES):
    if "tips" in t:
        continue
    hx, hy = t["hub"]
    r_hub = np.hypot(xx - hx, yy - hy)
    blades, nb = ndi.label((owner == i + 1) & (alpha > 0.3))
    sizes = ndi.sum(blades > 0, blades, range(1, nb + 1))
    for (cy, cx), size in zip(ndi.center_of_mass(blades > 0, blades, range(1, nb + 1)), sizes):
        length = np.hypot(cx - hx, cy - hy)
        if size < 30 or length < t["R"] * 0.3:
            continue
        reach = t["R"] * 0.22 + t["core"]
        tip = (hx + (cx - hx) / length * reach, hy + (cy - hy) / length * reach)
        dist, _ = segment_dist((hx, hy), tip)
        root = (dist <= max(1.5, t["R"] * 0.035)) & (r_hub > t["core"] - 1)
        alpha = np.where(root, 1.0, alpha)
        owner = np.where(root, i + 1, owner)
        fill |= ndi.binary_dilation(root, iterations=1) & (r_hub > t["core"])

# Hand-drawn blades: tapered strokes from the hub to each tip, alpha from colour.
for i, t in enumerate(TURBINES):
    if "tips" not in t:
        continue
    strokes = np.zeros((H, W), bool)
    for tip, is_ghost in [(p, False) for p in t["tips"]] + [(p, True) for p in t["ghosts"]]:
        dist, along = segment_dist(t["hub"], tip)
        half_width = 3.0 - 1.6 * along
        stroke = (dist <= half_width + 1.5) & ~in_core
        fill |= ndi.binary_dilation(stroke, iterations=1) & ~in_core
        if not is_ghost:
            strokes |= stroke
    behind = inpaint(img, fill & discs[i], radius=3, method=cv2.INPAINT_NS)
    # Blades are white with red tips; this keeps bits of the blue lake band and the dam that
    # fall inside the strokes from being picked up and spun around.
    lightness = np.clip((img.min(-1) - 150) / 40, 0, 1)
    red_tip = np.clip((img[..., 0] - img[..., 1] - 30) / 30, 0, 1) * (img[..., 0] > 170)
    blade_like = np.maximum(lightness, red_tip)
    a = np.clip((np.abs(img - behind).max(-1) - 4) / 30, 0, 1) * strokes * blade_like
    alpha = np.where(discs[i], np.maximum(alpha, a), alpha)
    owner = np.where(a > 0, i + 1, owner)

fill &= in_patch
debladed = inpaint(img, fill, radius=3, method=cv2.INPAINT_NS)
debug("blade_alpha.png", alpha * 255)
debug("debladed.png", debladed)

# ---------- cloud-free sky plate ----------
r, g, b = debladed[..., 0], debladed[..., 1], debladed[..., 2]
sky0 = (dep <= 2.5) & (b > 200) & (yy < 340) & ~fill
for p in PLUMES:
    sky0 &= ~box(p["search"])
blue = b - r
local_best = ndi.maximum_filter1d(np.where(sky0, blue, -999), 301, axis=1)
clear = sky0 & (blue >= local_best - 10)
plate = np.zeros_like(img)
done = np.zeros((H, W), bool)
for sx, sy in ((60, 3), (150, 6), (400, 15), (1200, 40)):
    w = ndi.gaussian_filter(clear.astype(np.float32), (sy, sx))
    v = np.stack([ndi.gaussian_filter(debladed[..., c] * clear, (sy, sx)) for c in range(3)], -1)
    take = ~done & (w > 0.02)
    plate[take] = v[take] / w[take][:, None]
    done |= take
plate = ndi.gaussian_filter(plate, (2, 8, 0))
small = Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).resize((W // 8, H // 8), Image.BOX)
small.save(HERE / "sky.png", optimize=True)

# ---------- steam plumes: whiter than the sky, connected to a tower mouth ----------
whiter = (debladed - plate).max(-1)
plume_alpha = np.zeros((H, W), np.float32)
plume_depth = np.zeros((H, W), np.float32)
plume_region = np.zeros((H, W), bool)
for p in PLUMES:
    cand = (whiter > 14) & (dep <= 12) & box(p["search"])
    lab, _ = ndi.label(cand, structure=np.ones((3, 3)))
    ids = np.unique(lab[box(p["seed"]) & (lab > 0)])
    comp = np.isin(lab, ids[ids > 0])
    comp = ndi.binary_fill_holes(ndi.binary_closing(comp, iterations=2))
    # Generous margin so the faint outer wisps belong to the plume too; behind all of it
    # the background becomes clean sky.
    region = ndi.binary_dilation(comp, iterations=8) & (dep <= 12)
    a = np.clip((whiter - 3) / 25, 0, 1) * region
    plume_alpha = np.maximum(plume_alpha, a)
    plume_depth = np.where(region, p["depth"], plume_depth)
    plume_region |= region
debug("plumes.png", overlay(plume_alpha))

# ---------- solid foreground: stands out from its row, inside the object boxes ----------
row_bg = ndi.grey_opening(dep, size=(1, 501))
in_boxes = np.zeros((H, W), bool)
for bx in FG_BOXES:
    in_boxes |= box(bx)
solid = (dep - row_bg > 10) & in_boxes & ~fill & ~plume_region
solid = ndi.binary_opening(solid, iterations=1)
lab, n = ndi.label(solid)
sizes = ndi.sum(solid, lab, range(1, n + 1))
solid = np.isin(lab, 1 + np.flatnonzero(sizes >= 40))
# The static parts of each turbine (spinner, nacelle, mast) go to the foreground too, so
# blade-root stubs and nacelle edges do not stay behind in the background; their alpha
# comes from colour only, so the sky inside those boxes stays background.
turbine_core = in_core & np.logical_or.reduce(discs)  # incl. mast painted back under blade roots
solid |= turbine_core
band = ndi.binary_dilation(solid, iterations=3) & ~(fill & ~in_core)
# Behind plumes the background is clear sky; fill that in first so the plume's white does
# not bleed into what is inpainted behind the towers.
desteamed = np.where(plume_region[..., None], plate, debladed)
# Blade areas count as unknown too: their de-bladed fill was painted from the mast and
# nacelle, which would otherwise leak grey into what is behind the nacelle.
behind = inpaint(desteamed, band | fill, radius=7, method=cv2.INPAINT_TELEA)
inner = ndi.binary_erosion(solid, iterations=2) & ~turbine_core
solid_alpha = np.clip((np.abs(debladed - behind).max(-1) - 6) / 30, 0, 1) * band
solid_alpha = np.where(inner, 1.0, solid_alpha)
solid_alpha = ndi.grey_closing(solid_alpha, size=(2, 2)) * band

fg_alpha = np.maximum(solid_alpha, plume_alpha)
fg_alpha = np.where(fg_alpha < 0.03, 0.0, fg_alpha)
debug("fg_alpha.png", overlay(fg_alpha))

# Foreground depth: inside, the local maximum (so soft depth-map edges do not drag the
# silhouette back); outside, copied from the nearest foreground pixel.
has_fg = fg_alpha > 0
fg_dep = ndi.grey_dilation(np.where(solid, dep, 0), size=(7, 7))
fg_dep = np.where(plume_region, plume_depth, fg_dep)
fg_dep = np.where(has_fg, np.maximum(fg_dep, 1), 0)
_, (iy, ix) = ndi.distance_transform_edt(~has_fg, return_indices=True)
fg_dep = fg_dep[iy, ix]
debug("fg_depth.png", fg_dep * 3)

# ---------- background layer ----------
bg_fill = has_fg | fill | plume_region
bg = behind
bg = np.where(bg_fill[..., None], bg, 0)
debug("bg_full.png", np.where(bg_fill[..., None], bg, img))

# Un-mix the foreground colour so mix(bg, fg, alpha) == banner.
a3 = np.maximum(fg_alpha, 0.03)[..., None]
# (Un-mixed from the de-bladed banner: the blades are redrawn rotating on top.)
fg = np.clip((debladed - (1 - a3) * np.where(bg_fill[..., None], bg, debladed)) / a3, 0, 255)
fg = np.where(has_fg[..., None], fg, 0)

# Background depth: foreground and blades replaced by what is behind them.
dep_bg = inpaint_depth(dep, (band | fill) & ~plume_region)
dep_bg = np.where(plume_region, 0, dep_bg)
# What is behind the foreground is farther than it by construction; the inpainting alone
# would pull ground depth up behind the towers' feet and let the background win there.
dep_bg = np.where(has_fg & band, np.minimum(dep_bg, fg_dep - 8), dep_bg)
dep_bg = np.maximum(dep_bg, 0)
d = ndi.grey_dilation(dep_bg, size=(3, 3))
d = np.maximum(ndi.gaussian_filter(d, 1.0), dep_bg)
debug("bg_depth.png", d * 2)

# ---------- sky mask (on the background layer) ----------
bg_view = np.where(bg_fill[..., None], bg, img)
r, g, b = bg_view[..., 0], bg_view[..., 1], bg_view[..., 2]
skyish = (dep_bg <= 2.5) & (b > 200) & (yy < 340)
skyish = ndi.binary_opening(skyish, iterations=2)
lab, n = ndi.label(skyish)
sizes = ndi.sum(skyish, lab, range(1, n + 1))
skyish = np.isin(lab, 1 + np.flatnonzero(sizes > 2000))
sky = ndi.binary_erosion(skyish, iterations=1)
sky_soft = ndi.gaussian_filter(sky.astype(np.float32), 1.0) * skyish
debug("sky.png", overlay(sky_soft))

# ---------- water ----------
water_box = box((212, 330, 452, 455)) | box((285, 440, 540, 560))
r, g, b = img[..., 0], img[..., 1], img[..., 2]
waterish = water_box & (b > 190) & (b - r > 12) & (dep < 60)
waterish = ndi.binary_opening(waterish, iterations=1)
water = ndi.gaussian_filter(waterish.astype(np.float32), 1.0) * ndi.binary_dilation(waterish)

save("fg.png", fg * fg_alpha[..., None])  # premultiplied, so bilinear filtering stays correct
save("bg.png", bg)
save("layers.png", np.stack([fg_alpha * 255, fg_dep, bg_fill * 255.0], -1))
save("maps.png", np.stack([d, water * 255, sky_soft * 255], -1))
save("rotor.png", np.stack([np.zeros_like(alpha), alpha * 255, owner * 60.0], -1))
print("wrote fg.png bg.png layers.png maps.png rotor.png sky.png to", HERE)
