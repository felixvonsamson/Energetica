# ruff: noqa
"""Onshore wind turbine: a tapered white tubular tower, a rounded nacelle, a hub nose and a
three-blade rotor with red-white-red tip bands. The rotor spins (plane.spinner).

build(s, phase=0.0, period=7.0): `phase` is the starting rotor angle as a fraction of a turn
(0..1, but the rotor repeats every 1/3), so the hero can vary turbines; `period` is seconds
per revolution."""

import math

import palette as P
from core import Scene, centroid, dot, fmt, mix, newell, sub

NAME = "Wind turbine"
EXTENT = (118, 160, 20)

HUB_Y = 100.0  # hub height
HUB_Z = -5.2  # rotor plane, upwind of the tower axis
TOWER_TOP = 98.1
BLADE_ROOT = 1.4  # blade starts here (radius from the hub centre), hidden under the nose
BLADE_LEN = 55.0
R = BLADE_ROOT + BLADE_LEN
TIP_RED = "#e5664b"  # sampled from the banner's tip bands (a touch brighter than palette red)


def _convex(s: Scene, verts, faces, color, **kw):
    """polyhedron() with faces flipped outwards automatically (saves getting winding right)."""
    c = centroid([s.W(v) for v in verts])
    fixed = []
    for f in faces:
        w = [s.W(verts[j]) for j in f]
        fixed.append(f if dot(newell(w), sub(centroid(w), c)) > 0 else f[::-1])
    s.polyhedron(verts, fixed, color, **kw)


def _nacelle(s: Scene):
    """Box with chamfered long edges, front at z=-3.6, tapering a little towards the back."""
    w, h, ch = 1.95, 2.1, 0.6
    sec = [
        (-w + ch, -h),
        (w - ch, -h),
        (w, -h + ch),
        (w, h - ch),
        (w - ch, h),
        (-w + ch, h),
        (-w, h - ch),
        (-w, -h + ch),
    ]
    rings = []
    for z, k in ((-3.6, 1.0), (6.4, 0.88)):
        rings.append([(x * k, HUB_Y + y * k - (1 - k) * 1.2, z) for x, y in sec])
    verts = rings[0] + rings[1]
    n = len(sec)
    faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    faces += [list(range(n)), list(range(n, 2 * n))]
    _convex(s, verts, faces, P.white, shadow=False, prio=1)


def _nose(s: Scene):
    """Hub nose cone pointing upwind (-z): rings of a half-ellipsoid, faceted."""
    n = 10
    prof = [(2.0, -3.7), (1.8, -5.6), (1.05, -7.0)]
    verts = []
    for r, z in prof:
        verts += [(r * math.cos(2 * math.pi * i / n), HUB_Y + r * math.sin(2 * math.pi * i / n), z) for i in range(n)]
    apex = len(verts)
    verts.append((0, HUB_Y, -7.7))
    faces = []
    for k in range(len(prof) - 1):
        a, b = k * n, (k + 1) * n
        faces += [[a + i, a + (i + 1) % n, b + (i + 1) % n, b + i] for i in range(n)]
    last = (len(prof) - 1) * n
    faces += [[last + i, last + (i + 1) % n, apex] for i in range(n)]
    faces.append(list(range(n)))
    _convex(s, verts, faces, P.white, shadow=False, prio=3)


def _chord(r):
    """Blade chord (m) at radius r: narrow root, widest near 15 % span, slender tip."""
    t = (r - BLADE_ROOT) / BLADE_LEN
    if t < 0.15:
        return 2.2 + (4.0 - 2.2) * math.sin(t / 0.15 * math.pi / 2)
    return 4.0 + (1.25 - 4.0) * ((t - 0.15) / 0.85) ** 0.85


def _blade(tone_lead, tone_trail, tone_red_lead, tone_red_trail, outline=None):
    """One blade pointing along +y, in plane units. The leading edge is +x (the rotor turns
    clockwise as seen from the front). Split lengthwise into a lit leading half and a darker
    trailing half, and across into white / red bands."""
    bands = [
        (BLADE_ROOT, R - 12.0, False),
        (R - 12.0, R - 8.5, True),
        (R - 8.5, R - 5.0, False),
        (R - 5.0, R, True),
    ]
    out = []
    for ra, rb, red in bands:
        m = max(1, math.ceil((rb - ra) / 4))
        rs = [ra + (rb - ra) * i / m for i in range(m + 1)]
        lead = [(0.32 * _chord(r), r) for r in rs]
        trail = [(-0.68 * _chord(r), r) for r in rs]
        spine = [(0.0, r) for r in rs]
        if rb >= R - 1e-6:  # round the tip off
            lead[-1] = (0.12, R)
            trail[-1] = (-0.25, R)
            spine[-1] = (0.0, R + 0.15)
        cl, ct = (tone_red_lead, tone_red_trail) if red else (tone_lead, tone_trail)
        out.append(_path(spine + lead[::-1], cl))
        out.append(_path(trail + spine[::-1], ct))
    if outline:  # match Look.outline: one stroke round the whole blade, not round each piece
        rs = [BLADE_ROOT + BLADE_LEN * i / 14 for i in range(15)]
        sil = [(-0.68 * _chord(r), r) for r in rs[:-1]] + [(-0.25, R), (0.0, R + 0.15), (0.12, R)]
        sil += [(0.32 * _chord(r), r) for r in rs[-2::-1]]
        stroke = f'stroke="{outline[0]}" stroke-width="{outline[1]:.3f}" stroke-linejoin="round"'
        out.append(_path(sil, "none", stroke))
    return "".join(out)


def _path(pts, fill, extra=""):
    return f'<path d="M{" ".join(f"{fmt(x)},{fmt(y)}" for x, y in pts)}Z" fill="{fill}"{" " + extra if extra else ""}/>'


def build(s: Scene, phase=0.0, period=7.0):
    with s.group(anchor=(0, 0, 0)):
        # tower: slightly tapered tube, a darker foundation collar at the base
        s.lathe(
            (0, 0, 0), [(2.6, 0), (2.25, 35), (1.6, TOWER_TOP)], P.white, segments=32, bands=[(0, 1.2, P.concrete_dark)]
        )
        _nacelle(s)
        _nose(s)

        # rotor: three blades drawn flat in the rotor plane, spinning about the hub
        rotor = s.plane((0, HUB_Y, HUB_Z), (1, 0, 0), (0, 1, 0))
        lead, trail = rotor.tone(P.white, k=0.6), rotor.tone(P.white, k=-0.4)
        rlead, rtrail = rotor.tone(TIP_RED, k=0.45), rotor.tone(TIP_RED, k=-0.5)
        ol = s.look.outline / (
            s.scale() * s.cam.px_per_unit(rotor.o)
        )  # px -> plane units (no vector-effect in the matrix)
        blade = _blade(lead, trail, rlead, rtrail, outline=(mix(trail, "#1b2733", 0.55), ol) if ol > 0 else None)
        a0 = 360.0 * phase
        body = "".join(f'<g transform="rotate({fmt(a0 + 120 * i)})">{blade}</g>' for i in range(3))
        # the plane's y axis points up, so SVG-positive rotation is counter-clockwise on screen;
        # ccw=True reverses it, giving the real (clockwise from upwind) sense
        rotor.spinner(0, 0, body, period=period, ccw=True)
        # keep auto-framing aware of the whole rotor disc
        for i in range(8):
            a = 2 * math.pi * i / 8
            s.P(rotor.at(R * math.cos(a), R * math.sin(a)))
