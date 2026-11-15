# ruff: noqa
"""Ground-mounted PV field: rows of tilted panel tables on A-frame supports.

One table is a tilted navy glass quad with a thin light edge band along its low side, a light cell
grid, a thin frame, a diagonal sky sheen and two A-frame supports. The panels face south,
which here means towards the default camera (-z) and up.

SVG cost of one table: 1 glass + 1 edge band + 1 sheen + 2 grid strokes
+ 1 frame stroke + 2 supports = 8 paths (~1.3 KB). Shadows add 1 subpath per row, merged into a single
path for the whole field.
"""

import math

import palette as P
from core import Scene, centroid, hull2d, path_d

NAME = "Solar farm"

# one panel table, in metres
TABLE_W = 6.0  # across (x)
TABLE_L = 3.4  # up the slope
TILT = 25.0  # degrees from horizontal
H_FRONT = 0.7  # height of the low (front) edge above ground
THICK = 0.07  # slab thickness, reads as the frame edge
GAP_X = 0.35  # between tables in a row
PITCH = 7.0  # row to row (front edge to front edge), a realistic ground cover ratio
CELLS = (12, 6)  # cell grid: columns across, rows up the slope

ROWS, COLS = 4, 6
EXTENT = (COLS * (TABLE_W + GAP_X), 3, (ROWS - 1) * PITCH + TABLE_L)

# extra colours, sampled from the reference crop
GLASS = "#163a66"  # deep navy glass, sampled from the reference crop
GRID = "#5f86b8"  # cell lines
SHEEN = "#cfe6f7"  # sky reflection


def _visible(s: Scene, p_local, n_local):
    """True if the face through p_local with outward normal n_local faces the camera.
    (Plane.visible() assumes cross(u, v) points outwards, which is false for an x-right, y-up
    plane on a front face in this left-handed world, so we check with an explicit normal.)"""
    w = s.W(p_local)
    n = s.Wv(n_local)
    c = s.cam.pos
    return n[0] * (c[0] - w[0]) + n[1] * (c[1] - w[1]) + n[2] * (c[2] - w[2]) > 0


def _clip(poly, a, b, c):
    """Keep the part of a 2D polygon where a*x + b*y <= c (Sutherland-Hodgman, one edge)."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0) != (fq < 0) and fp != fq:
            t = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def shadows(s: Scene, solids, anchor, parallax_anchor):
    """All cast shadows of the facility as ONE path in its own group, anchored behind the
    facility so it paints after the ground and before every standing part. One path with the
    nonzero fill rule means overlapping shadows don't double-darken, and a shadow can never be
    painted over a neighbouring part (which per-group shadows can do when the neighbour is
    farther away than the caster). solids: lists of local points."""
    if not s.look.cast_shadows:
        return
    sun = s.look.sun
    subpaths, cs = [], []
    for pts in solids:
        w = [s.W(p) for p in pts]
        gy = s.W((0, 0, 0))[1]
        flat = [(p[0] - sun[0] * (p[1] - gy) / sun[1], p[2] - sun[2] * (p[1] - gy) / sun[1]) for p in w]
        hull = hull2d([(round(x, 3), round(z, 3)) for x, z in flat])
        if len(hull) < 3:
            continue
        subpaths.append(path_d([s.P((x, gy + 0.02, z)) for x, z in hull]))
        cs.append(centroid([(x, gy, z) for x, z in hull]))
    if not subpaths:
        return
    op = s.look.shadow_opacity
    if s.look.haze_max > 0:
        op *= 1 - s.look.haze_max * (1 - math.exp(-s.cam.depth(centroid(cs)) / s.look.haze_dist))
    with s.group(anchor=anchor, parallax_anchor=parallax_anchor):
        s.emit(
            f'<path d="{"".join(subpaths)}" fill="{s.look.shadow_color}" opacity="{op:.2f}"/>', centroid(cs), flat=True
        )


def _tilt(x, a, h, z0):
    """Panel-local (x across, a up the slope, h along the panel normal) -> facility-local point.
    The slope starts at the front edge (z0, H_FRONT) and climbs towards +z."""
    t = math.radians(TILT)
    return (x, H_FRONT + a * math.sin(t) + h * math.cos(t), z0 + a * math.cos(t) - h * math.sin(t))


def table(s: Scene, x0, z0):
    """One panel table. x0: left edge, z0: ground z under the front (low) edge."""
    W, L = TABLE_W, TABLE_L
    t = math.radians(TILT)
    mid = _tilt(x0 + W / 2, L / 2, 0, z0)
    with s.group(anchor=(mid[0], 0, mid[2])):
        # supports: an N-shaped A-frame (front post, diagonal brace, back post) seen from the side
        a_front, a_back = 0.35, L - 0.55
        for fx in (0.2, 0.8):
            x = x0 + W * fx
            ft, bt = _tilt(x, a_front, -THICK, z0), _tilt(x, a_back, -THICK, z0)
            s.tube([(x, 0, ft[2]), ft, (x, 0, bt[2]), bt], 0.06, P.steel_dark, prio=-1)

        # glass surface: x across, y up the slope
        o = _tilt(x0, 0, 0, z0)
        pl = s.plane(o, (1, 0, 0), (0, math.sin(t), math.cos(t)))
        if not _visible(s, o, (0, math.cos(t), -math.sin(t))):
            # seen from behind: just the grey back sheet
            pl.rect(0, 0, W, L, P.steel_dark, prio=0)
            return
        # glass: shaded with a fixed, mild k (not the face's real sun angle, which is high and
        # would wash the navy out to warm grey); the low edge of the slab shows as a thin band
        pl.rect(0, 0, W, L, GLASS, k=0.15, prio=0)
        s.poly(
            [_tilt(x0, 0, 0, z0), _tilt(x0 + W, 0, 0, z0), _tilt(x0 + W, 0, -THICK, z0), _tilt(x0, 0, -THICK, z0)],
            P.solar_frame,
            k=-0.3,
        )
        k = s.scale()  # Plane.line widths ignore the frame scale; compensate (see report)

        # sky sheen: a diagonal band, lower left to upper right, clipped to the glass
        band = [(0, 0), (W, 0), (W, L), (0, L)]
        slope = 1.25  # band edges: x - slope*y = c
        c0, c1 = W * 0.18, W * 0.42
        band = _clip(band, -1, slope, -c0)  # x - slope*y >= c0
        band = _clip(band, 1, -slope, c1)  # x - slope*y <= c1
        if len(band) >= 3:
            # emitted directly so the optional ink outline doesn't stroke a reflection
            w = [pl.at(x, y) for x, y in band]
            s.emit(
                f'<path d="{path_d([s.P(p) for p in w])}" fill="{s.haze(SHEEN, centroid(w))}" opacity="0.2"/>',
                centroid(w),
                prio=1,
            )

        # cell grid as two serpentine strokes; their turns run along the border, under the frame
        nc, nr = CELLS
        hz = []
        for j in range(1, nr):
            y = L * j / nr
            hz += [(0, y), (W, y)] if j % 2 else [(W, y), (0, y)]
        vt = []
        for i in range(1, nc):
            x = W * i / nc
            vt += [(x, 0), (x, L)] if i % 2 else [(x, L), (x, 0)]
        pl.line(hz, GRID, 0.035 * k, k=0.1, prio=2)
        pl.line(vt, GRID, 0.035 * k, k=0.1, prio=2)
        # frame
        pl.line([(0, 0), (W, 0), (W, L), (0, L), (0, 0)], P.solar_frame, 0.07 * k, prio=3)


def build(s: Scene, rows=ROWS, cols=COLS):
    row_w = cols * TABLE_W + (cols - 1) * GAP_X
    depth = (rows - 1) * PITCH + TABLE_L * math.cos(math.radians(TILT))
    xs = [-row_w / 2 + c * (TABLE_W + GAP_X) for c in range(cols)]
    zs = [-depth / 2 + r * PITCH for r in range(rows)]

    # one shadow quad per row (the whole row's panel surface), merged into one path
    quads = []
    for z0 in zs:
        quads.append(
            [
                _tilt(xs[0], 0, 0, z0),
                _tilt(xs[-1] + TABLE_W, 0, 0, z0),
                _tilt(xs[-1] + TABLE_W, TABLE_L, 0, z0),
                _tilt(xs[0], TABLE_L, 0, z0),
            ]
        )
    # anchor the shadow layer just beyond whichever back corner is farther from this camera
    back = max(((-row_w / 2, depth / 2), (row_w / 2, depth / 2)), key=lambda p: s.cam.depth(s.W((p[0], 0, p[1]))))
    shadows(s, quads, anchor=(back[0] * 1.1, 0, back[1] + PITCH), parallax_anchor=(0, 0, 0))

    for z0 in zs:
        for x0 in xs:
            table(s, x0, z0)
