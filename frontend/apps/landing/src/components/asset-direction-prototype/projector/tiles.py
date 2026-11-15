# ruff: noqa
"""PROTOTYPE (#1469): hex map tiles and the facilities placed on them.

The hex is flat-topped in world space (vertices at 0, 60, ... degrees in the x-z plane) with
circumradius R. The map camera looks from azimuth 30, which points a vertex straight at the
viewer, so on screen the tile is a pointy-top hex showing two side faces, like an isometric cube.
The tile's top surface is y = 0; facilities stand on it.
"""

import math
import random
from contextlib import contextmanager

import effects as fx
import palettes
from core import _Group, centroid, dot, mix, newell, sub
from facilities import battery, coal_mine, hydro_dam, nuclear, solar, wind

R = 100.0  # hex circumradius
SLAB = 16.0  # tile thickness below the surface
EDGE = 3.0  # coloured top layer (grass edge, water depth) on the tile sides

MARKS = {}  # name -> world point, recorded while building (close-up crops)


def hex_pts(r=R, cx=0.0, cz=0.0):
    return [(cx + r * math.cos(math.radians(60 * i)), cz + r * math.sin(math.radians(60 * i))) for i in range(6)]


def mark(s, name, p):
    MARKS[name] = s.W(p)


@contextmanager
def first(s, anchor=(0, 0, 0), prio=-1000, flat=True):
    """Collect what is drawn inside and emit it as one part with priority `prio` in the enclosing
    group. Default: flat and painted before everything else (the tile slab under a facility)."""
    g = _Group(s.W(anchor), True, flat)
    s._groups.append(g)
    try:
        yield
    finally:
        s._groups.pop()
        svg = "".join(p.svg for p in sorted(g.parts, key=lambda p: (p.prio, -p.z)))
        s.emit(svg, s.W(anchor), flat=flat, prio=prio)


def convex(s, verts, faces, color, **kw):
    c = centroid([s.W(v) for v in verts])
    fixed = []
    for f in faces:
        w = [s.W(verts[j]) for j in f]
        fixed.append(f if dot(newell(w), sub(centroid(w), c)) > 0 else f[::-1])
    s.polyhedron(verts, fixed, color, **kw)


def lifted(s, foot, y0, top_y, color, top_color, side_color=None, prio=0):
    """Convex block: footprint [(x, z)] (any winding) from y0 up to top_y(x, z), a plane."""
    n = len(foot)
    verts = [(x, y0, z) for x, z in foot] + [(x, top_y(x, z), z) for x, z in foot]
    faces = [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    convex(s, verts, faces, side_color or color, colors={1: top_color}, prio=prio, shadow=False)


def slab(s, kind="grass", cx=0.0, cz=0.0):
    T = palettes.TILE
    pts = hex_pts(R, cx, cz)
    with first(s, (cx, -SLAB, cz)):
        if kind == "water":
            s.prism((0, -SLAB, 0), pts, SLAB - EDGE, T["seabed"], colors={6: T["seabed"]}, shadow=False, prio=0)
            s.prism((0, -EDGE, 0), pts, EDGE, T["water_edge"], colors={6: T["water"]}, shadow=False, prio=1)
            # a few glints on the water
            rnd = random.Random(int(cx * 7 + cz * 3))
            for _ in range(5):
                x, z = cx + rnd.uniform(-0.5, 0.5) * R, cz + rnd.uniform(-0.55, 0.55) * R
                w = rnd.uniform(8, 16)
                s.ground(
                    [(x - w, z), (x + w, z), (x + w * 0.8, z + 1.6), (x - w * 0.8, z + 1.6)],
                    mix(T["water"], "#ffffff", 0.4),
                    y=0.05,
                    prio=2,
                    extra='opacity="0.85"',
                )
        else:
            s.prism((0, -SLAB, 0), pts, SLAB - EDGE, T["soil"], colors={6: T["grass"]}, shadow=False, prio=0)
            s.prism((0, -EDGE, 0), pts, EDGE, T["grass_edge"], colors={6: T["grass"]}, shadow=False, prio=1)


# ---------------------------------------------------------------- facilities on a tile


def place_nuclear(s):
    k = 0.36
    with s.frame((6, 0, 8), 0, k):
        nuclear.build(s)
        mark(s, "closeup", (-82, 150, 30))


def _turbines(s, offshore):
    spots = [(-40, 35, 0.08), (55, 0, 0.42), (-20, -45, 0.74)]
    k = 0.42
    for i, (x, z, ph) in enumerate(spots):
        with s.frame((x, 0, z), -15, k):
            wind.build(s, phase=ph, offshore=offshore)
            if i == 2:
                mark(s, "closeup", (0, 9, 0) if offshore else (0, 100, -5))


def place_wind_one(s):
    with s.frame((-6, 0, 10), -15, 0.78):
        wind.build(s, phase=0.08)
        mark(s, "closeup", (0, 100, -5))


def place_wind(s):
    _turbines(s, False)


def place_offshore(s):
    _turbines(s, True)


def place_solar(s):
    k = 2.2
    with s.frame((0, 0, 0), 0, k):
        solar.build(s, rows=7, cols=8)
        mark(s, "closeup", (-3, 1.4, -18))


def place_battery(s):
    k = 4.0
    with s.frame((0, 0, 0), 0, k):
        battery.build(s, cols=6, rows=4)
        mark(s, "closeup", (-10, 1.6, -13))


def place_coal(s):
    k = 2.55
    with s.frame((6, 0, 0), 0, k):
        coal_mine.build(s)
        mark(s, "closeup", (4, 3, -2))


def place_dam(s):
    """The dam runs across the tile; the back half is the reservoir, the front half the valley
    downstream. Shoulders of terrain at both ends hold the wall."""
    T = palettes.TILE
    k = 0.62
    crest = hydro_dam.H * k
    res = hydro_dam.RES_Y * k
    zw = 2.0  # wall's downstream crest edge, world z
    back = [
        (R - zw / math.tan(math.radians(60)), zw),
        (R / 2, R * 0.866),
        (-R / 2, R * 0.866),
        (-R + zw / math.tan(math.radians(60)), zw),
    ]
    with s.group(anchor=(0, 0, R)):
        lifted(s, back, -EDGE, lambda x, z: res, T["water_edge"], T["water"], prio=-2)

    # terrain shoulders: from each end of the wall to the hex corner, sloping down to the front
    def shoulder(sign):
        xi, zb = 66.0, zw + 8
        foot = [(sign * xi, zb), (sign * xi, -(R - xi) * 3**0.5), (sign * R, 0), (sign * (R - zb / 3**0.5), zb)]
        top = lambda x, z: max(1.0, crest + 3 + min(0, z - zw) * 0.6)
        with first(s, (sign * 82, 0, -10), prio=1, flat=False):
            lifted(s, foot, -EDGE, top, T["soil"], T["grass"], prio=0)

    with s.frame((0, 0, zw - hydro_dam.CREST_D * k), 0, k):
        hydro_dam.build(s, bays=4, length=156 / k, reservoir=False, pool=False)
        mark(s, "closeup", (-30, hydro_dam.HS - 10, -6))
    shoulder(-1)
    shoulder(1)
    # river leaving the foot of the dam towards the front vertex of the tile
    toe = zw - hydro_dam.CREST_D * k - hydro_dam.TOE_Z * k
    with s.group(anchor=(0, 0, toe), flat=True):
        s.ground(
            [
                (-48, toe + 2),
                (52, toe + 2),
                (40, toe - 14),
                (18, -70),
                (34, -84),
                (16, -86),
                (-6, -72),
                (-10, toe - 16),
            ],
            hydro_dam.POOL,
            y=0.04,
        )


def place_forest(s, seed=0):
    rnd = random.Random(seed)
    for _ in range(9):
        x, z = rnd.uniform(-55, 55), rnd.uniform(-50, 50)
        fx.tree(s, (x, 0, z), h=rnd.uniform(22, 30), seed=rnd.randint(0, 99))


FACILITIES = [
    # key, label, place, tile kind, chart key for palette accents
    ("nuclear", "Nuclear reactor", place_nuclear, "grass"),
    ("wind", "Onshore wind turbine", place_wind, "grass"),
    ("wind_one", "Onshore wind, one large turbine", place_wind_one, "grass"),
    ("offshore", "Offshore wind turbine", place_offshore, "water"),
    ("solar", "Solar PV", place_solar, "grass"),
    ("hydro_dam", "Large water dam", place_dam, "grass"),
    ("coal_mine", "Coal mine", place_coal, "grass"),
    ("battery", "Lithium-ion batteries", place_battery, "grass"),
]


def tile_with(s, key, cx=0.0, cz=0.0):
    """A tile with facility `key` (or an empty kind: grass, water, forest) centred at (cx, cz)."""
    fac = {f[0]: f for f in FACILITIES}.get(key)
    kind = fac[3] if fac else ("water" if key == "water" else "grass")
    with s.group(anchor=(cx, 0, cz)):
        slab(s, kind, cx, cz)
        # cast shadows stay on their own tile
        cid = s.uid("tc")
        top = " ".join(f"{u:.1f},{v:.1f}" for u, v in (s.cam.project((x, 0, z)) for x, z in hex_pts(R, cx, cz)))
        s.defs.append(f'<clipPath id="{cid}"><polygon points="{top}"/></clipPath>')
        s.shadow_clip = cid
        with s.frame((cx, 0, cz)):
            if fac:
                fac[2](s)
            elif key == "forest":
                place_forest(s, seed=int(cx + cz))
        s.shadow_clip = None
