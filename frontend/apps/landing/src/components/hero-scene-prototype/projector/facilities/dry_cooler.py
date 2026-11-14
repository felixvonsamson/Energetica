# ruff: noqa
"""Dry cooler bank: a light grey block of 2 rows x 5 round fans on its front face (as the banner
draws it; real ones have their fans on top), on a steel leg frame with X-bracing, with a service
ladder on the right-hand end and a flanged top edge. Each fan spins (plane.spinner), each at a
slightly different speed and starting angle."""

import math
import random

import palette as P
from core import Scene, fmt

NAME = "Dry cooler"
EXTENT = (24, 13, 6)

MODS, ROWS = 5, 2
CELL_W, CELL_H = 4.4, 4.0
W, H, D = MODS * CELL_W, ROWS * CELL_H, 4.6
LEG = 2.6  # frame height: the block sits on top
BEAM = 0.4  # steel ring beam under the block
CAP = 0.45  # flange round the top edge

BODY = "#e8e6dd"  # casing panels, sampled from the banner (lit panel ~#f1ece0)
RIM = "#f7f3ea"  # fan housing ring
WALL = "#a7b0b3"  # inside of the housing ring
RECESS = "#4a5356"  # dark space behind the impeller
BLADE = "#6d7578"  # impeller blades (banner #6d7578)


def _c(x, y, r, fill):
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}"/>'


def _housing(pl):
    """Static fan housing in plane units: rim with its cast shadow, inner wall, dark recess."""
    return "".join(
        [
            _c(0.13, -0.13, 1.82, pl.tone(BODY, k=-0.75)),  # rim's shadow on the panel (down-right)
            _c(0.0, 0.0, 1.80, pl.tone(RIM, k=-0.35)),  # rim side in shade
            _c(-0.04, 0.04, 1.74, pl.tone(RIM, k=0.75)),  # rim face, lit
            _c(-0.02, 0.02, 1.52, pl.tone(WALL, k=0.2)),  # inner wall, lit at the lower right
            _c(-0.09, 0.09, 1.42, pl.tone(RECESS, k=0.0)),  # recess
        ]
    )


def _impeller(pl, n=5):
    """n swept blades from the hub out to r=1.34, a lit leading half and a darker trailing half.
    All blades' lit halves are one path, and all dark halves another."""
    lit, dark = pl.tone(BLADE, k=0.55), pl.tone(BLADE, k=-0.3)
    # one blade along +x, swept towards +y at the tip; leading edge on +y. (cmd, x, y) triples.
    lead = [
        ("M", 0.24, 0.05),
        ("Q", 0.8, 0.18),
        ("", 1.34, 0.62),
        ("L", 1.34, 0.05),
        ("Q", 0.8, -0.02),
        ("", 0.24, 0.05),
    ]
    trail = [
        ("M", 0.24, 0.05),
        ("Q", 0.8, -0.02),
        ("", 1.34, 0.05),
        ("L", 1.30, -0.26),
        ("Q", 0.8, -0.22),
        ("", 0.24, -0.12),
    ]

    def path(shape, fill):
        d = ""
        for i in range(n):
            a = 2 * math.pi * i / n
            c, s = math.cos(a), math.sin(a)
            d += "".join(f"{cmd}{x * c - y * s:.2f},{x * s + y * c:.2f} " for cmd, x, y in shape).rstrip() + "Z"
        return f'<path d="{d}" fill="{fill}"/>'

    return (
        path(lead, lit)
        + path(trail, dark)
        + _c(0, 0, 0.32, pl.tone(RIM, k=0.6))
        + _c(0, 0, 0.11, pl.tone(BLADE, k=0.0))
    )


def _shared(s: Scene, body):
    """Put a repeated piece of art in <defs> once per scene and return a <use> of it."""
    cache = s.__dict__.setdefault("_dry_cooler_defs", {})
    if body not in cache:
        cache[body] = s.uid("dc")
        s.defs.append(f'<g id="{cache[body]}">{body}</g>')
    return f'<use href="#{cache[body]}"/>'


def _ladder(s: Scene, x, z0, y0, y1, prio):
    """Vertical ladder against the +x end face: two rails and rungs (rungs as one path)."""
    zw = 0.5
    s.tube([(x, y0, z0), (x, y1, z0)], 0.05, P.steel_dark, prio=prio)
    s.tube([(x, y0, z0 + zw), (x, y1, z0 + zw)], 0.05, P.steel_dark, prio=prio)
    # hand loop over the top
    s.tube([(x, y1 - 1.2, z0), (x, y1, z0), (x - 0.5, y1, z0)], 0.05, P.steel_dark, prio=prio)
    s.tube([(x, y1 - 1.2, z0 + zw), (x, y1, z0 + zw), (x - 0.5, y1, z0 + zw)], 0.05, P.steel_dark, prio=prio)
    mid = s.W((x, (y0 + y1) / 2, z0 + zw / 2))
    d = ""
    y = y0 + 0.3
    while y < y1 - 0.1:
        a, b = s.P(s.W((x, y, z0))), s.P(s.W((x, y, z0 + zw)))
        d += f"M{fmt(a[0])},{fmt(a[1])}L{fmt(b[0])},{fmt(b[1])}"
        y += 0.42
    px = 2 * 0.035 * s.scale() * s.cam.px_per_unit(mid)
    s.emit(
        f'<path d="{d}" fill="none" stroke="{s.tone(P.steel_dark, None, mid, k=0.1)}" stroke-width="{max(px, 0.5):.2f}"/>',
        mid,
        prio=prio,
    )


def _x_brace(s: Scene, a, b, y0, y1, prio):
    """X-bracing between two leg positions a=(x, z) and b=(x, z)."""
    r = 0.06
    s.tube([(a[0], y0, a[1]), (b[0], y1, b[1])], r, P.steel, prio=prio)
    s.tube([(a[0], y1, a[1]), (b[0], y0, b[1])], r, P.steel, prio=prio)
    s.tube([(a[0], y0 + 0.05, a[1]), (b[0], y0 + 0.05, b[1])], r, P.steel, prio=prio)


def _sees(s: Scene, p, n):
    """True if the face through local point p with local normal n faces the camera."""
    w, nw = s.W(p), s.Wv(n)
    cp = s.cam.pos
    return (cp[0] - w[0]) * nw[0] + (cp[1] - w[1]) * nw[1] + (cp[2] - w[2]) * nw[2] > 0


def build(s: Scene, seed=3):
    rnd = random.Random(seed)
    hx, hz = W / 2, D / 2
    lx, lz = hx - 0.2, hz - 0.2  # leg centre lines
    xs = [-lx + 2 * lx * i / MODS for i in range(MODS + 1)]
    see_right = _sees(s, (hx, 5, 0), (1, 0, 0))
    see_left = _sees(s, (-hx, 5, 0), (-1, 0, 0))

    with s.group(anchor=(0, 0, 0)):
        s.ground([(-hx - 0.8, -hz - 0.8), (hx + 0.8, -hz - 0.8), (hx + 0.8, hz + 0.8), (-hx - 0.8, hz + 0.8)], P.pad)
        top = LEG + H + CAP
        corners = [(x, y, z) for x in (-hx, hx) for y in (LEG, top) for z in (-hz, hz)]
        s._cast_shadow([s.W(p) for p in corners], ground_y=s.W((0, 0, 0))[1])

        # ---- frame: far parts first, then the beam, then near parts
        y0, y1 = 0.25, LEG - BEAM - 0.1
        for zrow, pr in ((lz, -4), (-lz, -1)):
            for x in xs:
                s.box((x, 0, zrow), (0.32, LEG - BEAM, 0.32), P.steel, prio=pr)
            for xa, xb in zip(xs, xs[1:]):
                _x_brace(s, (xa, zrow), (xb, zrow), y0, y1, pr)
        for xe, seen in ((-lx, see_left), (lx, see_right)):
            _x_brace(s, (xe, -lz), (xe, lz), y0, y1, -2 if seen else -3)
        s.box((0, LEG - BEAM, 0), (W - 0.1, BEAM, D - 0.1), P.steel_dark, prio=-2, shadow=False)

        # ---- casing and the flanged top
        s.box((0, LEG, 0), (W, H, D), BODY, shadow=False)
        s.box((0, LEG + H, 0), (W + 0.3, CAP, D + 0.3), BODY, prio=1, shadow=False, colors={"top": BODY})
        roof = s.plane((-hx, top, -hz), (1, 0, 0), (0, 0, 1))
        roof.rect(0.3, 0.3, W - 0.6, D - 0.6, P.roof, k=0.1, prio=2)  # inside the parapet

        # ---- front face: module seams and the fans
        front = s.plane((-hx, LEG, -hz - 0.01), (1, 0, 0), (0, 1, 0))
        if _sees(s, (0, LEG + H / 2, -hz), (0, 0, -1)):  # Plane.visible() takes cross(u, v), which is +z here
            for i in range(1, MODS):
                front.line([(i * CELL_W, 0), (i * CELL_W, H)], P.steel_dark, 0.07, k=-0.2, prio=2)
            front.line([(0, CELL_H), (W, CELL_H)], P.steel_dark, 0.06, k=-0.2, prio=2)
            housing, impeller = _shared(s, _housing(front)), _shared(s, _impeller(front))
            for j in range(ROWS):
                for i in range(MODS):
                    cx, cy = (i + 0.5) * CELL_W, (j + 0.5) * CELL_H
                    front.svg(cx, cy, housing, prio=3)
                    body = f'<g transform="rotate({rnd.uniform(0, 72):.0f})">{impeller}</g>'
                    front.spinner(cx, cy, body, period=round(rnd.uniform(1.6, 2.4), 2), prio=4)

        # ---- end faces: panel seams
        for xe, sx in ((hx, 1), (-hx, -1)):
            end = s.plane((xe + 0.01 * sx, LEG, -hz), (0, 0, 1), (0, 1, 0))
            if see_right if sx > 0 else see_left:
                end.line([(0, CELL_H), (D, CELL_H)], P.steel_dark, 0.06, k=-0.2, prio=2)
                end.line([(D / 2, 0), (D / 2, H)], P.steel_dark, 0.06, k=-0.2, prio=2)

        # ---- service ladder on the right-hand end, near the front
        _ladder(s, hx + 0.4, -hz + 0.5, 0.0, top + 1.0, prio=5 if see_right else -5)
