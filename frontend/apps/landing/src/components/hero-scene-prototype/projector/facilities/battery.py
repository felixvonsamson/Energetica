# ruff: noqa
"""Grid battery storage: white battery containers, end-on to the camera, in rows on a concrete
pad, with a transformer and inverter skid at the right-hand end.

One container: a white box with a slightly overhanging, darker roof cap, double-door seams
and a green lightning bolt on its outer end, and a louvre grille on each long side (drawn only
on the side that faces the camera). The front row has its doors on the front (-z) end, the
back row on the back (+z) end, as back-to-back containers do.

SVG cost of one container in a front view: 2-3 body faces + 2-3 cap faces + 1 door stroke
+ 1 bolt + 2 louvre paths = 8-10 paths. Shadows are merged into one path for the whole facility.
"""

import math

import palette as P
from core import Scene, centroid, fmt, hull2d, path_d

NAME = "Battery storage"

# one container (a 20 ft box stood end-on), in metres
CW, CH, CD = 2.5, 2.9, 6.1  # width (x), height, depth (z)
GAP_X = 0.9  # access gap between containers
GAP_Z = 1.0  # between back-to-back rows
CAP = 0.12  # roof overhang
CAP_H = 0.18
PAD_MARGIN = 1.6
SKID_GAP = 1.8  # between the last container and the transformer skid
SKID_W, SKID_D = 4.0, 2.8

COLS, ROWS = 5, 2
EXTENT = (COLS * (CW + GAP_X) + SKID_GAP + SKID_W, 3.2, ROWS * CD + (ROWS - 1) * GAP_Z)

# extra colours, sampled from the reference crop
SEAM = "#b4b8b6"  # door seams on the white panels
ROOF = "#d6dadb"  # roof cap: a touch darker and cooler than the white body
LOUVRE = "#c3c9cc"
SLAT = "#8d979e"
TRANSFORMER = "#a7b1b3"  # utility grey

# a slanted lightning bolt, 1 m tall, centred on (0, 0)
BOLT = [(0.03, 0.5), (0.29, 0.5), (0.08, 0.1), (0.27, 0.1), (-0.13, -0.5), (-0.01, -0.07), (-0.21, -0.07)]


def _visible(s: Scene, p_local, n_local):
    """True if the face through p_local with outward normal n_local faces the camera.
    (Plane.visible() assumes cross(u, v) points outwards, which is false for an x-right, y-up
    plane on a front face in this left-handed world, so we check with an explicit normal.)"""
    w = s.W(p_local)
    n = s.Wv(n_local)
    c = s.cam.pos
    return n[0] * (c[0] - w[0]) + n[1] * (c[1] - w[1]) + n[2] * (c[2] - w[2]) > 0


def _face(s: Scene, origin, u, normal):
    """A vertical Plane (x along u, y up) on a face with the given outward normal, or None if
    the face is turned away from the camera."""
    if not _visible(s, origin, normal):
        return None
    return s.plane(origin, u, (0, 1, 0))


def _strokes(s: Scene, pl, segs, color, width, *, k=None, prio=2):
    """Disjoint straight strokes on a Plane, as ONE path (Plane.line only draws a connected
    polyline). segs: [((x0, y0), (x1, y1)), ...] in plane units; width in metres."""
    w = [(pl.at(*a), pl.at(*b)) for a, b in segs]
    c = centroid([p for ab in w for p in ab])
    px = width * s.scale() * s.cam.px_per_unit(c)
    d = "".join(f"M{fmt(u0)},{fmt(v0)}L{fmt(u1)},{fmt(v1)}" for (u0, v0), (u1, v1) in ((s.P(a), s.P(b)) for a, b in w))
    s.emit(
        f'<path d="{d}" fill="none" stroke="{s.tone(color, pl.n, c, k=k)}" stroke-width="{max(px, 0.5):.2f}" stroke-linecap="butt"/>',
        c,
        prio=prio,
    )


def _box_pts(x, y, z, w, h, d):
    return [(x + sx * w / 2, y + sy * h, z + sz * d / 2) for sx in (-1, 1) for sy in (0, 1) for sz in (-1, 1)]


def shadows(s: Scene, solids, anchor, parallax_anchor, before=None):
    """All cast shadows of the facility as ONE path in its own group, anchored behind the
    facility so it paints after the ground and before every standing part. One path with the
    nonzero fill rule means overlapping shadows don't double-darken, and a shadow can never be
    painted over a neighbouring part (which per-group shadows can do when the neighbour is
    farther away than the caster). solids: lists of local points. before(s) may add ground
    flats (the pad) to the same group, under the shadows."""
    sun = s.look.sun
    subpaths, cs = [], []
    gy = s.W((0, 0, 0))[1]
    for pts in solids if s.look.cast_shadows else []:
        w = [s.W(p) for p in pts]
        flat = [(p[0] - sun[0] * (p[1] - gy) / sun[1], p[2] - sun[2] * (p[1] - gy) / sun[1]) for p in w]
        hull = hull2d([(round(x, 3), round(z, 3)) for x, z in flat])
        if len(hull) >= 3:
            subpaths.append(path_d([s.P((x, gy + 0.02, z)) for x, z in hull]))
            cs.append(centroid([(x, gy, z) for x, z in hull]))
    with s.group(anchor=anchor, parallax_anchor=parallax_anchor):
        if before:
            before(s)
        if subpaths:
            op = s.look.shadow_opacity
            if s.look.haze_max > 0:
                op *= 1 - s.look.haze_max * (1 - math.exp(-s.cam.depth(centroid(cs)) / s.look.haze_dist))
            s.emit(
                f'<path d="{"".join(subpaths)}" fill="{s.look.shadow_color}" opacity="{op:.2f}"/>',
                centroid(cs),
                flat=True,
                prio=1,
            )


def container(s: Scene, xc, zc, doors_front=True):
    """One battery container standing end-on, centred on (xc, zc). doors_front: doors and bolt
    on the -z end (front row) or the +z end (back row)."""
    x0, x1, zf, zb = xc - CW / 2, xc + CW / 2, zc - CD / 2, zc + CD / 2
    with s.group(anchor=(xc, 0, zc)):
        s.box((xc, 0, zc), (CW, CH, CD), P.white, shadow=False)
        s.box((xc, CH, zc), (CW + 2 * CAP, CAP_H, CD + 2 * CAP), ROOF, prio=1, shadow=False)

        # outer end: double doors (outline and centre seam in one stroke) and the bolt
        e = 0.01
        end = (
            _face(s, (x0, 0, zf - e), (1, 0, 0), (0, 0, -1))
            if doors_front
            else _face(s, (x1, 0, zb + e), (-1, 0, 0), (0, 0, 1))
        )
        if end:
            m, y0, y1, mid = 0.14, 0.1, CH - 0.22, CW / 2
            k = s.scale()  # Plane.line widths ignore the frame scale; compensate
            end.line(
                [(mid, y0), (mid, y1), (CW - m, y1), (CW - m, y0), (m, y0), (m, y1), (mid, y1)],
                SEAM,
                0.045 * k,
                k=0.2,
                prio=2,
            )
            bx, by, bh = (m + mid) / 2, CH * 0.54, 1.2
            end.poly([(bx + px * bh, by + py * bh) for px, py in BOLT], P.green_accent, k=0.1, prio=3)

        # louvre grille near the door end of whichever long side faces the camera
        z_door = zf if doors_front else zb
        step = 1 if doors_front else -1
        for side in (-1, 1):
            xs = x1 + 0.01 if side > 0 else x0 - 0.01
            pl = _face(s, (xs, 0, z_door), (0, 0, step), (side, 0, 0))
            if not pl:
                continue
            u0, u1, v0, v1 = 0.55, 1.95, 1.55, 2.35
            pl.rect(u0, v0, u1 - u0, v1 - v0, LOUVRE, prio=2)
            slats = [((u0 + 0.06, v0 + (v1 - v0) * i / 5), (u1 - 0.06, v0 + (v1 - v0) * i / 5)) for i in range(1, 5)]
            _strokes(s, pl, slats, SLAT, 0.06, prio=3)


SKID_H = 0.25  # steel base


def _skid_boxes(xc, zc):
    """(centre-bottom x, z, width, height, depth) of the transformer tank and the inverter
    cabinet on a skid centred on (xc, zc); their fronts are flush, 0.35 m in from the skid edge."""
    front = zc - SKID_D / 2 + 0.35
    tank = (xc - 0.95, front + 1.7 / 2, 1.7, 1.8, 1.7)
    inverter = (xc + 1.05, front + 1.9 / 2, 1.5, 2.2, 1.9)
    return tank, inverter


def skid(s: Scene, xc, zc):
    """Transformer and inverter on a steel skid."""
    (tx, tz, tw, th, td), (ix, iz, iw, ih, idp) = _skid_boxes(xc, zc)
    y = SKID_H
    with s.group(anchor=(xc, 0, zc)):
        s.box((xc, 0, zc), (SKID_W, y, SKID_D), P.steel_dark, prio=-1, shadow=False)
        # transformer tank with radiator fins on the front and three bushings on the lid
        s.box((tx, y, tz), (tw, th, td), TRANSFORMER, shadow=False)
        fr = _face(s, (tx - tw / 2, y, tz - td / 2 - 0.01), (1, 0, 0), (0, 0, -1))
        if fr:
            fins = [((0.2 + (tw - 0.4) * i / 6, 0.2), (0.2 + (tw - 0.4) * i / 6, th - 0.3)) for i in range(7)]
            _strokes(s, fr, fins, P.steel_dark, 0.08)
        for i in (-1, 0, 1):
            bx, bz = tx + i * 0.5, tz + 0.2
            s.tube([(bx, y + th, bz), (bx, y + th + 0.55, bz)], 0.09, P.white, prio=2, cap="butt")
        # inverter cabinet: a vent and a door seam on the front
        s.box((ix, y, iz), (iw, ih, idp), P.white, colors={"top": ROOF}, shadow=False)
        fr = _face(s, (ix - iw / 2, y, iz - idp / 2 - 0.01), (1, 0, 0), (0, 0, -1))
        if fr:
            fr.rect(0.25, 1.15, iw - 0.5, 0.6, LOUVRE, prio=2)
            fr.line([(iw / 2, 0.05), (iw / 2, 1.0)], SEAM, 0.045 * s.scale(), k=0.2, prio=2)


def build(s: Scene, cols=COLS, rows=ROWS):
    pitch_x, pitch_z = CW + GAP_X, CD + GAP_Z
    width = cols * CW + (cols - 1) * GAP_X + SKID_GAP + SKID_W
    depth = rows * CD + (rows - 1) * GAP_Z
    xs = [-width / 2 + CW / 2 + c * pitch_x for c in range(cols)]
    zs = [-depth / 2 + CD / 2 + r * pitch_z for r in range(rows)]
    skid_x = xs[-1] + CW / 2 + SKID_GAP + SKID_W / 2
    skid_z = zs[0] - CD / 2 + SKID_D / 2 + 0.6

    # ground layer first (its anchor lies behind everything), then the standing parts
    hw, hd = width / 2 + PAD_MARGIN, depth / 2 + PAD_MARGIN
    casters = [_box_pts(x, 0, z, CW + 2 * CAP, CH + CAP_H, CD + 2 * CAP) for z in zs for x in xs]
    for bx, bz, bw, bh, bd in _skid_boxes(skid_x, skid_z):
        casters.append(_box_pts(bx, SKID_H, bz, bw, bh, bd))
    back = max(((-hw, hd), (hw, hd)), key=lambda p: s.cam.depth(s.W((p[0], 0, p[1]))))
    shadows(
        s,
        casters,
        anchor=(back[0] * 1.1, 0, back[1] + 4),
        parallax_anchor=(0, 0, 0),
        before=lambda s: s.ground([(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)], P.pad, prio=-1),
    )

    for r, z in enumerate(zs):
        for x in xs:
            container(s, x, z, doors_front=(r == 0 or r < rows - 1))
    skid(s, skid_x, skid_z)
