# ruff: noqa
"""PROTOTYPE (issue #1440): the landing hero, composed after the AI banner.

The scene is authored in *banner pixels plus depth*: every element gets a pixel anchor read
off the banner (2167 x 725) and a camera depth z. The projector back-projects (u, v, z) into
3D, so the composition matches the banner while every solid has real perspective, haze and
a real depth for parallax. Facilities are scaled to the banner's pixel size at their depth.

Terrain is a stack of "curtains": crest lines at a depth, each closed far below the frame and
painted far to near, which is how a layered landscape parallaxes.

run:
    ~/.cache/energetica-proto-1440/venv/bin/python hero.py           # writes ../projected/hero.svg + previews/hero.png
    ... hero.py --s 1 --amp 40                                        # preview at the parallax extreme
    ... hero.py --outline 1.2                                         # ink outlines
"""

import importlib
import json
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import effects as fx  # noqa: E402
import palette as P  # noqa: E402
from core import Camera, Item, Look, Scene, fmt, mix, path_d  # noqa: E402

W_, H_ = 2167, 725
HORIZON = 268
F = 1500.0
# Every facility shares one site grid, turned this much from the camera: the banner's three-quarter
# view, fronts and left-hand sides showing. (Negative turns +x away from the camera.)
SITE_YAW = -28.0
CAM = Camera((0.0, 100.0, 0.0), 0.0, 0.0, F, (W_, H_), center=(W_ / 2, HORIZON))
OUT = HERE.parent / "projected" / "hero.svg"
PREV = HERE / "previews"


def at(u, v, z):
    return CAM.at_depth(u, v, z)


def metres(px, z):
    return px * z / F


# ------------------------------------------------------------------ terrain


def curtain(s: Scene, crest, z, color, *, foot=None, crest_k=0.3, foot_k=-0.15, decorate=None, bottom=900, key_z=None):
    """Terrain layer: crest = [(u, v), ...] in banner pixels at depth z (or [(u, v, z), ...]).
    Closed straight down to v=bottom. Vertical gradient from a lit crest to a shaded foot."""
    pts = [(c[0], c[1], c[2] if len(c) > 2 else z) for c in crest]
    top = [at(u, v, zz) for u, v, zz in pts]
    bot = [at(u, bottom, zz) for u, v, zz in reversed(pts)]
    poly = [s.P(p) for p in top + bot]
    zc = sum(p[2] for p in pts) / len(pts)
    anchor = at(sum(p[0] for p in pts) / len(pts), bottom, key_z or zc)
    v_top = min(v for _, v in poly)
    v_bot = min(H_ + 20, max(v for _, v in poly[: len(top)]) + 220)
    gid = s.uid("tg")
    c_top = s.tone(color, k=crest_k, at_world=anchor)
    c_bot = s.tone(foot or color, k=foot_k, at_world=anchor)
    s.defs.append(
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="0" y1="{fmt(v_top)}" x2="0" y2="{fmt(v_bot)}">'
        f'<stop offset="0" stop-color="{c_top}"/><stop offset="1" stop-color="{c_bot}"/></linearGradient>'
    )
    with s.group(anchor=anchor):
        s.emit(f'<path d="{path_d(poly)}" fill="url(#{gid})"/>', anchor, prio=-5)
        if decorate:
            decorate(pts)


# Screen boxes of placed facilities: (u0, v0, u1, v1, depth). Trees never stand in front of them.
FACILITY_BOXES: list[tuple] = []


def clear_of_facilities(u, v, w_px, h_px, z):
    """False if a tree at banner pixel (u, v) (its base), w_px wide and h_px tall, at depth z,
    would stand in front of a facility."""
    for x0, y0, x1, y1, fz in FACILITY_BOXES:
        if fz > z and u + w_px / 2 > x0 and u - w_px / 2 < x1 and v > y0 and v - h_px < y1:
            return False
    return True


def put_tree(s: Scene, u, v, z, h_px, kind="tree", seed=0, color=None, prio=1):
    """One billboard tree with its base at banner pixel (u, v), h_px tall, at depth z, unless it
    would stand in front of a facility."""
    if not clear_of_facilities(u, v, h_px * 0.9, h_px, z):
        return
    h = metres(h_px, z)
    if kind == "conifer":
        fx.conifer(s, at(u, v, z), h=h, color=color, prio=prio)
    elif kind == "bush":
        fx.bush(s, at(u, v, z), w=h * 1.4, seed=seed, color=color, prio=prio)
    else:
        fx.tree(s, at(u, v, z), h=h, seed=seed, color=color, prio=prio)


def treeline(
    s: Scene, pts, z, h_px, every_px, kind="conifer", seed=0, jitter=0.4, color=None, below=4, slope=0, density=0.7
):
    """Billboard trees along a crest polyline (banner pixels). Density follows a slow random
    wave, so the line breaks into clumps and gaps instead of a regular fringe, and with slope > 0
    the clumps spill up to `slope` px down the hillside below the crest."""
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 2 * math.pi) for _ in range(3)]

    def dens(u):
        w = 0.5 * math.sin(u / 95 + ph[0]) + 0.3 * math.sin(u / 41 + ph[1]) + 0.2 * math.sin(u / 17 + ph[2])
        return 0.5 + 0.5 * w

    spots = []
    for (u0, v0, *_), (u1, v1, *_) in zip(pts, pts[1:]):
        n = max(1, int(abs(u1 - u0) / every_px))
        for i in range(n):
            t = (i + rnd.random() * 0.8) / n
            u, vc = u0 + (u1 - u0) * t, v0 + (v1 - v0) * t
            d = dens(u)
            if d < 1 - density:
                continue
            spots.append((u, vc + below + rnd.uniform(0, below)))
            # thicker clumps spill down the slope
            for _ in range(int(slope / 12 * max(0.0, d - 0.45) * 2)):
                spots.append((u + rnd.uniform(-every_px, every_px), vc + below + rnd.uniform(4, slope)))
    # back to front: higher on the hillside first (each a hair farther, so the sort keeps it)
    for u, v in sorted(spots, key=lambda p: p[1]):
        hp = h_px * (1 - jitter / 2 + rnd.random() * jitter)
        put_tree(s, u, v, z * (0.999 - 1e-6 * v), hp, kind=kind, seed=rnd.randint(0, 999), color=color)


def facets(s: Scene, pts, z, color, base_v, k=-0.55):
    """Shaded right-hand slope of every peak in a crest (classic flat-illustration mountains):
    from each local peak, the crest down to the next valley, then down to base_v."""
    vs = [p[1] for p in pts]
    for i in range(1, len(pts) - 1):
        if not (vs[i] < vs[i - 1] and vs[i] <= vs[i + 1]):
            continue
        j = i + 1
        while j < len(pts) - 1 and vs[j + 1] >= vs[j]:
            j += 1
        u0, v0 = pts[i][0], pts[i][1]
        u1 = pts[j][0]
        foot_u = u0 + (u1 - u0) * 0.35
        poly = [(p[0], p[1]) for p in pts[i : j + 1]] + [(u1, base_v), (foot_u, base_v)]
        a = at(u0, base_v, z)
        s.emit(f'<path d="{path_d(poly)}" fill="{s.tone(color, k=k, at_world=a)}" opacity="0.55"/>', a, prio=-4)


PLAIN_Z = 905.0  # depth of the main plain's curtain; ground decoration sorts just in front of it


def ground_patch(s: Scene, pts_world, color, k=0.0, order=1, extra=""):
    """A patch lying on the plain (field, road). It is painted as part of the plain: right after
    the plain's curtain and before anything standing, so it can never cover a facility or a
    tree, and it moves with the plain in parallax. `order` stacks patches (roads over fields)."""
    far = max(pts_world, key=lambda p: CAM.depth(p))
    near_v = max(s.P(p)[1] for p in pts_world)
    if near_v < HORIZON:
        return
    fill = s.tone(color, k=k, at_world=far)
    s.emit(f'<path d="{path_d([s.P(p) for p in pts_world])}" fill="{fill}"{extra}/>', at(1000, 600, PLAIN_Z - order))


def add_z(p, dz):
    return (p[0], p[1], p[2] + dz)


def g(u, v):
    """Ground point (y=0) under banner pixel (u, v)."""
    return CAM.ground_at(u, v)


def fields(s: Scene, region_px, seed=1, yaw=18.0, cell=(70, 120), min_v=458):
    """Patchwork of fields on the plain inside a banner-pixel bounding box, on a rotated world grid."""
    rnd = random.Random(seed)
    (u0, v0), (u1, v1) = region_px
    c = g((u0 + u1) / 2, (v0 + v1) / 2)
    a = math.radians(yaw)
    ca, sa = math.cos(a), math.sin(a)
    tones = [P.grass, P.meadow, P.grass_dry, P.hill, P.meadow, P.grass]
    span = 2200
    x = -span
    while x < span:
        w = rnd.uniform(*cell)
        zz = -span
        while zz < span:
            d = rnd.uniform(*cell) * 1.4
            corners = [(x, zz), (x + w, zz), (x + w, zz + d), (x, zz + d)]
            world = [(c[0] + px * ca + pz * sa, 0.0, c[2] - px * sa + pz * ca) for px, pz in corners]
            if all(CAM.depth(p) > 50 for p in world):
                scr = [s.P(p) for p in world]
                if all(u0 <= u <= u1 and min_v <= v <= v1 for u, v in scr):
                    inset = 0.06
                    cw = centroid_xz(world)
                    shrunk = [lerp3(p, cw, inset) for p in world]
                    ground_patch(s, shrunk, rnd.choice(tones), k=rnd.uniform(-0.1, 0.25))
                    if rnd.random() < 0.22:  # an occasional hedgerow along the field's far edge
                        a_, b_ = shrunk[2], shrunk[3]
                        for i in range(max(1, int(math.dist(a_, b_) / 6))):
                            p = lerp3(a_, b_, (i + rnd.random() * 0.4) / max(1, int(math.dist(a_, b_) / 6)))
                            col = P.tree_dark if rnd.random() < 0.4 else P.tree
                            tree_at_ground(s, p, rnd.uniform(2.6, 4.2), "bush", rnd.randint(0, 999), col)
            zz += d
        x += w


def centroid_xz(ps):
    return (sum(p[0] for p in ps) / len(ps), 0.0, sum(p[2] for p in ps) / len(ps))


def lerp3(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def road(s: Scene, px_pts, width_m, color=P.path):
    """Road on the ground through banner pixels, constant width in metres."""
    pts = [g(u, v) for u, v in px_pts]
    left, right = [], []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        dx, dz = b[0] - a[0], b[2] - a[2]
        n = math.hypot(dx, dz) or 1
        ox, oz = -dz / n * width_m / 2, dx / n * width_m / 2
        left.append((p[0] + ox, 0.0, p[2] + oz))
        right.append((p[0] - ox, 0.0, p[2] - oz))
    # split into short pieces so each sorts at its own depth
    for i in range(len(pts) - 1):
        ground_patch(s, [left[i], left[i + 1], right[i + 1], right[i]], color, k=0.3, order=2)


def tree_at_ground(s: Scene, p, h_m, kind="tree", seed=0, color=None):
    """A tree standing on the plain at world point p, unless it would stand in front of a facility."""
    u, v = CAM.project(p)
    z = CAM.depth(p)
    hp = h_m * F / z
    put_tree(s, u, v, z, hp, kind=kind, seed=seed, color=color, prio=0)


def copse(s: Scene, u, v, n, spread_m, h_m=(9, 15), seed=0, kind="tree"):
    """A cluster of trees around the ground point under banner pixel (u, v)."""
    rnd = random.Random(seed)
    c = g(u, v)
    for _ in range(n):
        p = (c[0] + rnd.uniform(-1, 1) * spread_m, 0.0, c[2] + rnd.uniform(-0.5, 0.5) * spread_m)
        col = rnd.choice([P.tree, P.tree, P.tree_dark]) if kind == "tree" else None
        tree_at_ground(s, p, rnd.uniform(*h_m) * (1.3 if kind == "conifer" else 1), kind, rnd.randint(0, 999), col)


def hedge(s: Scene, px_pts, every_m=7, h_m=4.5, seed=0):
    rnd = random.Random(seed)
    pts = [g(u, v) for u, v in px_pts]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.dist(a, b) / every_m))
        for i in range(n):
            p = lerp3(a, b, (i + rnd.random() * 0.5) / n)
            col = P.tree_dark if rnd.random() < 0.4 else P.tree
            tree_at_ground(s, p, h_m * rnd.uniform(0.8, 1.3) / 1.4, "bush", rnd.randint(0, 999), col)


def scatter(s: Scene, region_px, n, seed=0, h_m=(7, 14)):
    """Lone trees and little clumps across the plain, so it isn't bare between the ridges."""
    rnd = random.Random(seed)
    (u0, v0), (u1, v1) = region_px
    for _ in range(n):
        u, v = rnd.uniform(u0, u1), rnd.uniform(v0, v1)
        c = g(u, v)
        for _ in range(rnd.choice([1, 1, 1, 2, 3])):
            p = (c[0] + rnd.uniform(-8, 8), 0.0, c[2] + rnd.uniform(-5, 5))
            tree_at_ground(s, p, rnd.uniform(*h_m), "tree", rnd.randint(0, 999), rnd.choice([P.tree, P.tree_dark]))


# ------------------------------------------------------------------ facilities


def load(key):
    try:
        return importlib.import_module(f"facilities.{key}")
    except Exception as e:  # missing or mid-edit by another agent
        print(f"skipping {key}: {e!r}")
        return None


def place(s: Scene, key, u, v, z, *, px_h=None, px_w=None, model_h=None, model_w=None, yaw=None, keep_clear=True, **kw):
    """Put facility `key` with its base centre at banner pixel (u, v) and depth z, scaled so its
    height (or width) spans px_h (px_w) banner pixels."""
    mod = load(key)
    origin = at(u, v, z)
    ppm = F / z
    if mod is None:
        return  # not modelled yet
    ew, eh, ed = mod.EXTENT
    if px_h:
        k = px_h / ((model_h or eh) * ppm)
    else:
        k = px_w / ((model_w or ew) * ppm)
    # measure the facility's own screen box (trees keep clear of it), then merge it back
    outer = s.bbox
    s.bbox = [math.inf, math.inf, -math.inf, -math.inf]
    with s.frame(origin, SITE_YAW if yaw is None else yaw, k):
        with s.group(anchor=(0, 0, 0)):
            mod.build(s, **kw)
    x0, y0, x1, y1 = s.bbox
    if keep_clear:
        FACILITY_BOXES.append((x0, y0, x1, y1, z))
    s.bbox = [min(outer[0], x0), min(outer[1], y0), max(outer[2], x1), max(outer[3], y1)]


# ------------------------------------------------------------------ scene


def plant(s: Scene):
    """All facilities. Placed before the terrain decoration, so trees can keep clear of them.
    The site grid is SITE_YAW; facilities turned a further 90 degrees face left instead of right."""
    FACILITY_BOXES.clear()
    # wind turbines on the hills: (u, base v, hub height px, z, phase)
    for u, v, hub_px, z, ph in [
        (630, 403, 112, 2100, 40),
        (938, 350, 72, 2600, 200),
        (838, 384, 122, 1850, 110),
        (736, 396, 210, 1700, 0),
    ]:
        place(s, "wind", u, v, z, px_h=hub_px, model_h=100, phase=ph, period=6 + (ph % 3), keep_clear=False)

    place(s, "hydro_dam", 250, 455, 1300, px_w=430, reservoir=False, pool=True, keep_clear=False)
    place(s, "nuclear", 1215, 455, 880, px_h=275, model_h=150, hall="left")
    place(s, "gas", 1560, 505, 780, px_h=280, yaw=SITE_YAW + 90)
    place(s, "dry_cooler", 1915, 556, 560, px_h=165, yaw=SITE_YAW + 90)
    place(s, "hydrogen", 830, 556, 520, px_h=140)
    place(s, "solar", 1540, 718, 390, px_w=800, model_w=8 * 6.35, rows=10, cols=8, yaw=SITE_YAW + 90)
    place(s, "battery", 735, 672, 380, px_w=430)


def build(outline=0.0):
    look = Look(haze_max=0.58, haze_dist=7500, outline=outline, haze=P.sky_horizon)
    s = Scene(CAM, look, prefix="hero")

    # sky (drawn taller than the frame so it can sink with parallax)
    sky = s.uid("sky")
    s.defs.append(
        f'<linearGradient id="{sky}" x1="0" y1="-120" x2="0" y2="{HORIZON + 40}" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{P.sky_top}"/><stop offset="0.6" stop-color="{P.sky_mid}"/><stop offset="1" stop-color="{P.sky_horizon}"/></linearGradient>'
    )
    s.items.append(
        Item(
            math.inf,
            False,
            f'<rect x="-50" y="-200" width="{W_ + 100}" height="{H_ + 260}" fill="url(#{sky})"/>',
            math.inf,
        )
    )

    # clouds: (u, v of the flat base, width px, drift px)
    for i, (u, v, wpx, drift) in enumerate(
        [
            (230, 232, 300, 60),
            (1150, 128, 260, -50),
            (1420, 175, 200, 40),
            (1690, 195, 270, -40),
            (2010, 242, 360, 50),
            (520, 160, 110, 30),
            (930, 205, 90, -25),
        ]
    ):
        z = 40000 + i * 900
        fx.cloud(s, at(u, v, z), width=metres(wpx, z), seed=i, drift=metres(drift, z), period=120 + 25 * i)

    plant(s)

    # far range (faceted: shaded right-hand slopes)
    far = [
        (-20, 222),
        (60, 200),
        (130, 204),
        (200, 226),
        (260, 240),
        (330, 258),
        (420, 262),
        (500, 252),
        (560, 270),
        (640, 280),
        (760, 276),
        (880, 262),
        (980, 250),
        (1060, 262),
        (1150, 268),
        (1250, 258),
        (1350, 272),
        (1450, 280),
        (1560, 258),
        (1640, 284),
        (1720, 264),
        (1790, 250),
        (1880, 236),
        (1960, 218),
        (2040, 204),
        (2100, 199),
        (2190, 212),
    ]
    curtain(
        s,
        far,
        26000,
        P.mountain_far,
        crest_k=0.5,
        foot_k=0.1,
        decorate=lambda pts: facets(s, pts, 26000, P.mountain_far, 320),
    )
    # mid range, left and right
    mid_l = [(-20, 196), (40, 212), (110, 246), (180, 268), (260, 282), (360, 292), (480, 296), (600, 298)]
    curtain(s, mid_l, 11000, P.mountain, crest_k=0.35, decorate=lambda pts: facets(s, pts, 11000, P.mountain, 330))
    mid_r = [
        (1380, 306),
        (1470, 298),
        (1540, 290),
        (1610, 280),
        (1700, 272),
        (1780, 258),
        (1840, 252),
        (1900, 264),
        (1990, 254),
        (2070, 238),
        (2130, 230),
        (2190, 238),
    ]
    curtain(s, mid_r, 11000, P.mountain, crest_k=0.35, decorate=lambda pts: facets(s, pts, 11000, P.mountain, 330))

    # forested far band
    band = [
        (-20, 300),
        (200, 300),
        (420, 304),
        (600, 306),
        (800, 304),
        (1000, 306),
        (1300, 310),
        (1500, 312),
        (1700, 306),
        (1900, 300),
        (2190, 296),
    ]
    curtain(
        s,
        band,
        5200,
        P.forest_far,
        crest_k=0.1,
        decorate=lambda pts: treeline(s, pts, 5200, 16, 9, seed=3, color=P.forest_far, density=0.85),
    )

    # right meadow hills with a forest edge
    right = [
        (1380, 470),
        (1470, 400),
        (1560, 362),
        (1650, 346),
        (1760, 334),
        (1860, 326),
        (1960, 318),
        (2060, 310),
        (2190, 304),
    ]
    curtain(
        s,
        right,
        3200,
        P.hill,
        foot=P.grass,
        crest_k=0.25,
        decorate=lambda pts: treeline(s, pts[2:], 3200, 26, 11, seed=4, color=P.conifer, slope=40, density=0.6),
    )
    right2 = [(1600, 440), (1700, 400), (1800, 380), (1900, 368), (2000, 352), (2100, 344), (2190, 340)]
    curtain(
        s,
        right2,
        2200,
        P.meadow,
        foot=P.grass,
        crest_k=0.35,
        decorate=lambda pts: treeline(
            s, pts[1:], 2200, 30, 70, kind="tree", seed=9, jitter=0.5, slope=60, density=0.55
        ),
    )

    # turbine hills, centre-left
    hills = [
        (330, 520),
        (430, 452),
        (520, 424),
        (620, 405),
        (720, 393),
        (800, 380),
        (880, 364),
        (960, 347),
        (1010, 344),
        (1070, 356),
        (1140, 384),
        (1220, 420),
        (1300, 450),
    ]
    curtain(
        s,
        hills,
        1900,
        P.hill,
        foot=P.grass,
        crest_k=0.35,
        decorate=lambda pts: treeline(
            s, pts[1:9], 1900, 22, 22, kind="tree", seed=5, jitter=0.6, slope=45, density=0.5
        ),
    )
    # a lower fold in front of the turbine hills, with a forest strip
    fold = [
        (380, 520),
        (480, 470),
        (560, 448),
        (650, 440),
        (760, 446),
        (860, 440),
        (960, 420),
        (1040, 418),
        (1120, 440),
    ]
    curtain(
        s,
        fold,
        1450,
        P.hill_shade,
        foot=P.grass,
        crest_k=0.3,
        decorate=lambda pts: treeline(
            s, pts[1:], 1450, 26, 16, kind="conifer", seed=8, color=P.forest, slope=30, density=0.6
        ),
    )

    # main plain: a terrain curtain whose crest sits on the ground plane, then fields, hedges,
    # roads and copses as real ground geometry in perspective
    plain = [
        (560, 640),
        (700, 540),
        (860, 492),
        (1000, 462),
        (1150, 454),
        (1300, 456),
        (1500, 456),
        (1700, 448),
        (1900, 432),
        (2190, 414),
    ]
    curtain(s, plain, 905, P.grass, foot=P.meadow, crest_k=0.1, foot_k=0.25)
    fields(s, ((900, 455), (2190, 725)), seed=2)
    # the main road ends at the dry cooler (its access road) instead of running underneath it
    road(s, [(700, 560), (860, 572), (1060, 586), (1300, 576), (1500, 560), (1680, 553), (1770, 556)], 9)
    road(s, [(1500, 560), (1460, 520), (1440, 488), (1460, 466)], 6)
    hedge(s, [(1730, 530), (1900, 515), (2060, 505), (2190, 500)], seed=1)
    hedge(s, [(1150, 520), (1300, 512), (1420, 506)], seed=2)
    copse(s, 1150, 470, 9, 30, seed=1)
    copse(s, 1480, 470, 5, 18, seed=2)
    copse(s, 2080, 470, 7, 25, seed=3)
    copse(s, 2130, 560, 6, 14, seed=4)
    copse(s, 2010, 650, 5, 6, h_m=(6, 10), seed=5)
    copse(s, 2120, 700, 6, 6, h_m=(6, 9), seed=6)
    copse(s, 860, 715, 5, 6, h_m=(4, 6), seed=7)
    copse(s, 1700, 470, 4, 12, seed=8)
    scatter(s, ((880, 470), (2190, 720)), 34, seed=9)

    # dam valley: left forest slope, dam, lake
    left_slope = [(-20, 272), (40, 286), (90, 318), (130, 360), (165, 430), (185, 520)]
    curtain(
        s,
        left_slope,
        1400,
        P.forest,
        crest_k=0.2,
        decorate=lambda pts: treeline(s, pts, 1400, 30, 14, seed=6, slope=70, density=0.8),
    )
    # grassy knoll the dam's right-hand end runs into, wooded where it meets the wall, as on
    # the banner (no bare cross-section of the dam)
    knoll = [
        (410, 800),
        (425, 472),
        (462, 422),
        (500, 380),
        (540, 356),
        (585, 362),
        (640, 398),
        (710, 428),
        (790, 446),
        (880, 454),
    ]
    curtain(
        s,
        knoll,
        1180,
        P.hill,
        foot=P.grass,
        crest_k=0.35,
        decorate=lambda pts: treeline(
            s, pts[1:5], 1180, 32, 9, kind="conifer", seed=21, color=P.forest, slope=45, density=0.75
        ),
    )

    mine(s)

    return s


def mine(s: Scene):
    """The coal mine composed for the hero from the facility's parts, set into a natural dark
    hillside that runs off the left edge (no slab, no cut-off end), as on the banner."""
    cm = load("coal_mine")
    if cm is None:
        return
    # the hillside: a dark cut face under a grassy, wooded rim
    rim = [(-20, 446), (80, 452), (170, 470), (250, 488), (320, 512), (375, 546), (415, 594), (440, 660), (450, 760)]
    curtain(
        s,
        rim,
        480,
        P.hill_shade,
        foot=P.hill_shade,
        crest_k=0.3,
        decorate=lambda pts: treeline(s, pts[:6], 480, 24, 26, kind="tree", seed=12, slope=20, density=0.6),
    )
    face = [(-20, 462), (80, 468), (170, 486), (250, 504), (320, 528), (372, 562), (410, 610), (432, 668), (440, 760)]

    def strata(pts):
        # bands that follow the crest down the cut face: brown topsoil, then two coal seams
        a = at(200, 600, 470)
        for d0, d1, col, k in (
            (0, 14, P.dirt_dark, 0.1),
            (58, 72, P.coal, -0.2),
            (104, 112, P.coal_light, 0.0),
            (150, 166, P.coal, -0.3),
        ):
            band = [(u, v + d0) for u, v, _ in pts] + [(u, v + d1) for u, v, _ in reversed(pts)]
            s.emit(f'<path d="{path_d(band)}" fill="{s.tone(col, k=k, at_world=a)}"/>', a, prio=-4)

    curtain(s, face, 470, cm.CUT, foot=P.coal, crest_k=0.2, foot_k=-0.3, decorate=strata)
    # headframe and gallery standing on the rim, at the left edge as on the banner
    z = 466
    with s.frame(at(40, 466, z), SITE_YAW, 520 / (38 * F / z)):
        with s.group(anchor=(0, 0, 0)):
            # without its coal heap: the heap sits behind the tower, which lands it on the dam's foot
            heap, cm.stockpile = cm.stockpile, (lambda *a, **k: None)
            cm.headframe(s, (0, 0, 0), scale=0.75)
            cm.stockpile = heap

    # the yard in front: portal at the foot of the face, conveyor, heap, excavator, screen, truck
    z = 400
    with s.frame(at(210, 700, z), SITE_YAW, 560 / (38 * F / z)):
        with s.group(anchor=(0, 0, 0)):
            with s.group(anchor=(0, 0, -40), flat=True):
                s.ground([(-60, -15), (30, -15), (30, 6), (-60, 6)], cm.YARD, prio=0)
                s.ground([(-2, -9), (7, -9.5), (9, -2), (6, 2), (-1, 2), (-3, -4)], P.coal, prio=1)
                s.road([(-60, -12.5), (-12, -11.5), (0, -11), (10, -10.5), (30, -8)], 3.2, P.dirt_dark, prio=1)
            portal(s, cm, (-9.0, 0, 4.0))
            cm.conveyor(s, (-8.5, 0.6, 3.0), (2.0, 4.6, -1.3))
            with s.group(anchor=(3, 0, 0)):
                cm.stockpile(s, (3, 0, -2.4), r=4.4, h=3.5, seed=1)
            cm.excavator(s, (7.5, 0, 3.5), yaw=0)
            cm.screen(s, (15.6, 0, 4.2))
            cm.dump_truck(s, (-8.5, 0, -8.5), yaw=14)


def portal(s: Scene, cm, at_local, pw=6.5, ph=6.0, pd=4.0):
    """Concrete mine portal (from coal_mine.hill_portal, without its slab of hill)."""
    x, y, z = at_local
    with s.group(anchor=(x, 0, z)):
        s.box((x, y, z), (pw, ph, pd), P.concrete_dark, prio=1)
        s.box((x, y + ph, z - 0.2), (pw + 0.6, 0.5, pd + 0.4), P.concrete, prio=1.2, shadow=False)
        fp = s.plane((x - pw / 2, y, z - pd / 2 - 0.02), (1, 0, 0), (0, 1, 0))
        jamb, oh = 0.9, ph - 1.3
        fp.rect(jamb, 0, pw - 2 * jamb, oh, cm.OPENING, prio=1.1, shade=False)
        fp.rect(jamb, oh - 0.7, pw - 2 * jamb, 0.7, "#2a3036", prio=1.15, shade=False)
        sw = (pw - 2 * jamb) / 5
        for i in range(5):
            x0 = jamb + i * sw
            fp.poly(
                [(x0, oh + 0.2), (x0 + sw * 0.5, oh + 0.2), (x0 + sw * 0.8, oh + 0.6), (x0 + sw * 0.3, oh + 0.6)],
                P.yellow,
                prio=1.16,
            )


def preview_svg(svg, s_val, amp):
    """Bake the CSS parallax into the SVG for a static preview at scroll progress s."""
    import re

    def rep(m):
        d = float(m.group(1))
        return f'<g class="px" transform="translate(0,{s_val * d * amp:.2f})" style="--d:{m.group(1)}">'

    return re.sub(r'<g class="px" style="--d:([0-9.]+)">', rep, svg)


def main(argv):
    outline = float(argv[argv.index("--outline") + 1]) if "--outline" in argv else 0.0
    s_val = float(argv[argv.index("--s") + 1]) if "--s" in argv else 0.0
    amp = float(argv[argv.index("--amp") + 1]) if "--amp" in argv else 40.0
    s = build(outline)
    svg = s.to_svg(viewbox=(0, 0, W_, H_), parallax=True)
    if not outline and not s_val:
        # The page uses hero.json: one SVG per depth layer, so scrolling only moves
        # compositor layers instead of repainting one big SVG. hero.svg is kept as a single
        # file for previews and for opening in an editor.
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(svg)
        defs, layers = s.to_layers()
        OUT.with_suffix(".json").write_text(
            json.dumps(
                {"viewBox": [0, 0, W_, H_], "defs": defs, "layers": [{"d": d, "svg": body} for d, body in layers]}
            )
        )
    import resvg_py

    PREV.mkdir(exist_ok=True)
    name = "hero" + (f"-s{s_val:g}" if s_val else "") + ("-outline" if outline else "") + ".png"
    (PREV / name).write_bytes(bytes(resvg_py.svg_to_bytes(svg_string=preview_svg(svg, s_val, amp), width=W_)))
    print(f"hero.svg {len(svg) / 1024:.1f} KB, {len(s.items)} items -> {PREV / name}")


if __name__ == "__main__":
    main(sys.argv[1:])
