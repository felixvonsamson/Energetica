# ruff: noqa
"""Hydroelectric gravity dam: a long concrete wall with a sloped downstream face, a gated
spillway of `bays` bays between buttress piers, white water running down the face into a foam
band and a tailwater pool, and a small powerhouse at the toe beside the spillway.

build(s, bays=6, length=None, reservoir=True, pool=None)
    bays       number of spillway bays (5 or 6 look right).
    length     total crest length in metres; default = spillway width * 1.6 (about 270 m for 6 bays).
    reservoir  draw the sliver of reservoir behind the wall (a water block, top at RES_Y).
    pool       draw the tailwater pool / river at the foot (default: same as `reservoir`).
               The foam band at the foot is always drawn.

Local coordinates (metres; ground y=0; downstream faces -z, towards the camera):
    crest height                  H = 70; crest road from z=0 (downstream edge) to z=8 (upstream)
    crest ends (tuck into hills)  left  (-length/2, 70, 0..8), right (+length/2, 70, 0..8)
    downstream toe line           z = -TOE_Z = -46.5 along the whole length, y = 0
    upstream face                 vertical at z = 8
    spillway                      x in [-spill_w/2, +spill_w/2] (spill_w = 170 for 6 bays)
    foam band                     x from -spill_w/2-4 to +spill_w/2+4, z from -51 to -47.5, y 0..15
    foot pool                     y = 0, x from -spill_w/2-20 to +spill_w/2+60, z from -44.5 (under
                                  the toe) to about -110, then a river tongue leaving towards -z, +x
                                  down to z = -149
    reservoir surface             y = RES_Y = 66, z from 8 to 8+RES_D (30)
    powerhouse                    x from spill_w/2+10 to spill_w/2+46, z from -62 to -46.5, 15 m tall
Without `length`, the wall is wider than the spillway by 50 m on each side; terrain can cover
the wing ends freely, as long as it stays clear of the spillway, its abutment piers and the
powerhouse.
"""

import math
import random

import palette as P
from core import Scene, centroid, dot, fmt, newell, norm, path_d, sub

NAME = "Hydroelectric dam"
EXTENT = (270, 80, 130)

# colours sampled from the banner crop (previews/ref-hydro_dam.png), unlit
DAM = "#cfcec6"  # light grey concrete of the wall
DAM_PIER = "#dad9d1"  # piers read a touch lighter than the face
CREST_ROAD = "#a7aaa8"
GATE = "#3f7fae"  # blue gate housings at the crest
GATE_DARK = "#2f5f86"
SHEET_TOP = "#d5e9f4"  # spillway water: pale blue-white, whiter at the foot
SHEET_MID = "#a9d1e9"
SHEET_FOOT = "#eef7fb"
STREAK_LIGHT = "#f7fcff"
STREAK_DARK = "#86bddc"
POOL = "#7cc6e6"
FOAM = "#ffffff"
FOAM_SHADE = "#cfe5f1"

H = 70.0  # crest height
CREST_D = 8.0  # crest (road) depth, upstream face at z = CREST_D
VERT = 8.0  # the downstream face is vertical for the top VERT metres, then slopes
SLOPE = 0.75  # horizontal run per metre of drop on the sloped part
TOE_Z = SLOPE * (H - VERT)  # toe at z = -TOE_Z
HS = H - 13.0  # spillway (ogee) crest, under the gates
BAY_W, PIER_W, ABUT_W = 20.0, 6.0, 10.0
PIER_D, ABUT_D = 3.5, 5.5  # how far the piers stand proud of the face
RES_Y, RES_D = H - 4.0, 30.0


def face_z(y):
    """z of the downstream face at height y."""
    return 0.0 if y >= H - VERT else -(H - VERT - y) * SLOPE


def facing(s: Scene, p, n):
    """True if a surface through local point p with local outward normal n faces the camera.
    (Plane.visible() follows the u x v orientation, which points into the wall for the
    (x right, y up) planes used here, so it can't be used directly.)"""
    return dot(s.Wv(n), sub(s.cam.pos, s.W(p))) > 0


def solid(s: Scene, verts, faces, color, colors=None, prio=0, shadow=True):
    """Convex polyhedron that fixes face winding itself (outward = away from the centroid)."""
    c = centroid(verts)
    fixed = []
    for f in faces:
        pts = [verts[i] for i in f]
        if dot(newell(pts), sub(centroid(pts), c)) < 0:
            f = f[::-1]
        fixed.append(f)
    s.polyhedron(verts, fixed, color, colors=colors, prio=prio, shadow=shadow)


def xprism(s: Scene, x0, x1, prof, color, colors=None, prio=0, shadow=True):
    """Extrude a convex (z, y) profile along x from x0 to x1. colors: {edge index: colour};
    edge i joins prof[i] and prof[i+1]. The end caps take `color`."""
    n = len(prof)
    verts = [(x0, y, z) for z, y in prof] + [(x1, y, z) for z, y in prof]
    faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    faces += [list(range(n)), list(range(n, 2 * n))]
    solid(s, verts, faces, color, colors=colors, prio=prio, shadow=shadow)


def wall_profile(top):
    """Sloped lower part of the gravity-dam cross-section, up to `top` <= H - VERT, as (z, y)."""
    return [(CREST_D, top), (face_z(top), top), (-TOE_Z, 0), (CREST_D, 0)]


def wing(s: Scene, x0, x1):
    """Full-height non-overflow wall. The real section (vertical top, sloped below) is not convex,
    so it is two solids: the sloped base and the vertical crest block on top of it (prio 1, so
    the base's hidden top face never paints over it)."""
    xprism(s, x0, x1, wall_profile(H - VERT), DAM)
    xprism(
        s,
        x0,
        x1,
        [(CREST_D, H), (0, H), (0, H - VERT), (CREST_D, H - VERT)],
        DAM,
        colors={0: CREST_ROAD},
        prio=1,
        shadow=False,
    )
    wing_joints(s, x0, x1)
    crest_parapets(s, x0, x1)


def pier(s: Scene, xc, w, d, top, prio=3):
    """Buttress pier: a slanted strip standing `d` proud of the face from the toe to the spillway
    crest, and a head block above it that separates the gates and carries the road."""
    x0, x1 = xc - w / 2, xc + w / 2
    zf = face_z(HS)
    strip = [(zf - d, HS), (-TOE_Z - d, 0), (-TOE_Z, 0), (zf, HS)]
    xprism(s, x0, x1, strip, DAM_PIER, prio=prio, shadow=False)
    head = [(CREST_D + 0.5, top), (zf - d, top), (zf - d, HS), (CREST_D + 0.5, HS)]
    xprism(s, x0, x1, head, DAM_PIER, colors={0: DAM}, prio=prio, shadow=False)


def flow_path(s: Scene, pts_world, color, width_px, period, delay, dash, opacity=1.0, prio=2):
    """A stroked path with the CSS dash animation, in output pixels."""
    c = centroid(pts_world)
    d = path_d([s.P(p) for p in pts_world], close=False)
    s.emit(
        f'<path d="{d}" fill="none" stroke="{s.haze(color, c)}" stroke-width="{width_px:.2f}" stroke-linecap="round"'
        f' stroke-dasharray="{dash}" opacity="{opacity}" class="flow" style="--period:{period:.2f}s;animation-delay:{delay:.2f}s"/>',
        c,
        prio=prio,
    )


def spill_sheet(s: Scene, x0, x1, rnd):
    """Water running down the sloped face of one bay: a base fill and animated streaks."""
    lift = 0.25  # metres off the face
    nrm = norm((0, SLOPE, -1.0))  # outward normal of the sloped face (y up, towards -z)
    up = norm((0, H - VERT, TOE_Z))  # up-slope direction
    org = (x0, nrm[1] * lift, -TOE_Z + nrm[2] * lift)
    sheet = s.plane(org, (1, 0, 0), up)
    if not facing(s, org, nrm):
        return
    top = math.hypot(HS, face_z(HS) + TOE_Z)
    w = x1 - x0
    a, b = s.P(sheet.at(w / 2, top)), s.P(sheet.at(w / 2, 0))
    gid = s.uid("dw")
    mid = sheet.at(w / 2, top / 2)
    stops = "".join(
        f'<stop offset="{o}" stop-color="{s.tone(c, None, mid, k=k)}"/>'
        for o, c, k in ((0, SHEET_TOP, 0.5), (0.18, SHEET_MID, 0.3), (0.75, SHEET_MID, 0.1), (1, SHEET_FOOT, 0.4))
    )
    s.defs.append(
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}">{stops}</linearGradient>'
    )
    # the sheet bulges a little past the bay at the foot, where it spreads
    pts = [(0, top), (w, top), (w + 0.6, 0), (-0.6, 0)]
    s.emit(f'<path d="{path_d([s.P(sheet.at(x, y)) for x, y in pts])}" {s._style(f"url(#{gid})")}/>', mid, prio=1)
    # streaks: start at the gate lip, run to the foot
    ppm = s.cam.px_per_unit(mid) * s.scale()
    n = 7
    for i in range(n):
        x = w * (i + 0.5 + rnd.uniform(-0.3, 0.3)) / n
        y0 = top - rnd.uniform(0, 4)
        light = i % 3 != 1
        col = STREAK_LIGHT if light else STREAK_DARK
        width = (rnd.uniform(0.7, 1.2) if light else rnd.uniform(0.5, 0.8)) * ppm
        dash = f"{rnd.randint(12, 26)} {rnd.randint(6, 14)}"
        flow_path(
            s,
            [sheet.at(x, y0), sheet.at(x + rnd.uniform(-0.5, 0.5), 0.5)],
            col,
            max(width, 0.8),
            period=rnd.uniform(0.75, 1.05),
            delay=-rnd.uniform(0, 1),
            dash=dash,
            opacity=0.9 if light else 0.7,
        )


def soft_poly(s: Scene, plane, pts, color, k=0.0, prio=1, extra=""):
    """Plane polygon without the optional ink outline (foam and mist stay soft in outline mode)."""
    w = [plane.at(x, y) for x, y in pts]
    c = centroid(w)
    fill = s.tone(color, plane.n, c, k=k)
    s.emit(f'<path d="{path_d([s.P(p) for p in w])}" fill="{fill}"{" " + extra if extra else ""}/>', c, prio=prio)


def scallops(w, base, rnd, r0, r1, step, taper=0.18):
    """Bumpy top edge (a row of half-circles) over [0, w], closed down to y=0, in plane units.
    The bumps shrink towards both ends over `taper` of the width, so the band fades out."""
    pts = [(0, 0)]
    x = 0.0
    while x < w:
        r = rnd.uniform(r0, r1)
        cx = min(x + r, w)
        e = min(1.0, cx / (taper * w), (w - cx) / (taper * w))
        e = max(0.15, e) ** 0.7
        top = (base + rnd.uniform(-0.3, 0.6) * r) * e
        for i in range(5):
            a = math.pi * (1 - i / 4)
            pts.append((max(0, min(w, cx + r * e * math.cos(a))), top + r * e * math.sin(a)))
        x += step * r
    pts.append((w, 0))
    return pts


def foam_band(s: Scene, x0, x1, rnd, prio=5):
    """Turbulent foam along the toe of the spillway: a translucent mist band against the face,
    a dense scalloped foam band in front of it, and shimmering white bubbles on top."""
    w = x1 - x0
    mist = s.plane((x0, 0, -TOE_Z - 1.0), (1, 0, 0), (0, 1, 0))
    soft_poly(s, mist, scallops(w, 10.0, rnd, 3.5, 5.5, 1.5), FOAM, k=0.3, prio=prio, extra='opacity="0.6"')
    band = s.plane((x0, 0, -TOE_Z - 4.5), (1, 0, 0), (0, 1, 0))
    soft_poly(s, band, scallops(w, 5.5, rnd, 2.6, 4.2, 1.4), FOAM_SHADE, k=0.0, prio=prio + 1)
    soft_poly(
        s, band, [(x, max(0.0, y - 1.2)) for x, y in scallops(w, 4.8, rnd, 2.4, 3.8, 1.5)], FOAM, k=0.4, prio=prio + 2
    )
    n = int(w / 8)
    for i in range(n):
        x = w * (i + 0.5) / n + rnd.uniform(-2, 2)
        e = min(1.0, x / (0.18 * w), (w - x) / (0.18 * w))
        if e < 0.5:
            continue
        per = rnd.uniform(1.6, 2.8)
        cy, r = rnd.uniform(5.5, 8.0), rnd.uniform(1.8, 2.8)
        ring = [(x + r * math.cos(2 * math.pi * j / 10), cy + r * math.sin(2 * math.pi * j / 10)) for j in range(10)]
        extra = f'class="shimmer" style="--period:{per:.2f}s;--delay:{-rnd.uniform(0, per):.2f}s"'
        soft_poly(s, band, ring, FOAM, k=0.7, prio=prio + 3, extra=extra)


def wing_joints(s: Scene, x0, x1):
    """Vertical block joints on the sloped face of a wing (subtle, as on the banner)."""
    up = norm((0, H - VERT, TOE_Z))
    face = s.plane((x0, 0, -TOE_Z), (1, 0, 0), up)
    if not facing(s, (x0, 0, -TOE_Z), (0, SLOPE, -1)):
        return
    top = math.hypot(H - VERT, TOE_Z)
    step = 16.0
    n = int((x1 - x0) // step)
    for i in range(1, n + 1):
        x = (x1 - x0) * i / (n + 1)
        face.line([(x, 0.4), (x, top - 0.2)], DAM, 0.45, k=-0.6, prio=2)
    # the vertical upper band gets its joints too
    upper = s.plane((x0, H - VERT, 0), (1, 0, 0), (0, 1, 0))
    for i in range(1, n + 1):
        x = (x1 - x0) * i / (n + 1)
        upper.line([(x, 0.2), (x, VERT - 0.2)], DAM, 0.45, k=-0.6, prio=2)


def crest_parapets(s: Scene, x0, x1, prio=3):
    """Low walls on both edges of the crest road."""
    s.box(((x0 + x1) / 2, H, 0.35), (x1 - x0, 1.3, 0.7), DAM_PIER, prio=prio, shadow=False)
    s.box(((x0 + x1) / 2, H, CREST_D - 0.35), (x1 - x0, 1.3, 0.7), DAM_PIER, prio=prio, shadow=False)


def powerhouse(s: Scene, x0, x1):
    d = 15.5
    z0, z1 = -TOE_Z - d, -TOE_Z
    h = 15.0
    xc = (x0 + x1) / 2
    with s.group(anchor=(xc, 0, z0)):
        s.box((xc, 0, (z0 + z1) / 2), (x1 - x0, h, d), P.concrete_warm, colors={"top": P.roof})
        front = s.plane((x0, 0, z0 - 0.02), (1, 0, 0), (0, 1, 0))
        if facing(s, (x0, 0, z0), (0, 0, -1)):
            w = x1 - x0
            for i in range(6):
                front.rect(3 + i * (w - 6) / 6 + 0.6, 9.5, (w - 6) / 6 - 1.2, 3, P.window, prio=2)
            # tailrace outlets at water level
            for i in range(3):
                cx = w * (i + 0.5) / 3
                front.poly(
                    [(cx - 3.5, 0), (cx + 3.5, 0), (cx + 3.5, 3.5), (cx, 5.2), (cx - 3.5, 3.5)], GATE_DARK, prio=2
                )
        side = s.plane((x1 + 0.02, 0, z0), (0, 0, 1), (0, 1, 0))
        if facing(s, (x1, 0, z0), (1, 0, 0)):
            for i in range(2):
                side.rect(3 + i * 5.5, 9.5, 3.8, 3, P.window, prio=2)
        # roof units and a transformer bay
        s.box((xc - 6, h, (z0 + z1) / 2), (8, 2.2, 6), P.steel, prio=2, shadow=False)
        s.box((x1 - 5, h, (z0 + z1) / 2 + 2), (5, 1.6, 4), P.steel, prio=2, shadow=False)
        for i in range(3):
            fx = x0 + 6 + i * 5
            s.lathe((fx, h, z0 + 3), [(0.6, 0), (0.6, 3.5)], P.steel_dark, segments=10, prio=3, shadow=False)


def pool_poly(spill_w):
    """Tailwater pool at the foot, narrowing to a river that leaves towards the front right."""
    a, b = -spill_w / 2 - 20, spill_w / 2 + 60
    z = -TOE_Z + 2
    return [
        (a, z), (b, z),
        (b + 4, z - 18), (b - 10, z - 34), (b - 30, z - 44),
        (b - 22, z - 62), (b - 2, z - 80), (b + 30, z - 98),
        (b - 8, z - 104), (b - 48, z - 86), (b - 80, z - 70),
        (a + 40, z - 62), (a + 6, z - 48), (a - 6, z - 26),
    ]  # fmt: skip


def build(s: Scene, bays=6, length=None, reservoir=True, pool=None):
    pool = reservoir if pool is None else pool
    rnd = random.Random(7)
    spill_w = bays * BAY_W + (bays - 1) * PIER_W + 2 * ABUT_W
    L = length or spill_w * 1.6
    L = max(L, spill_w + 20)
    xl, xr = -L / 2, L / 2
    sl, sr = -spill_w / 2, spill_w / 2

    with s.group(anchor=(0, 0, -TOE_Z * 0.4)):
        if pool:
            s.ground(pool_poly(spill_w), POOL, y=0.03)
            sky = s.plane((0, 0.05, 0), (1, 0, 0), (0, 0, -1))
            for i, (x, z, w) in enumerate(
                (
                    (-30, -TOE_Z - 18, 30),
                    (25, -TOE_Z - 26, 40),
                    (70, -TOE_Z - 40, 26),
                    (110, -TOE_Z - 64, 22),
                    (-5, -TOE_Z - 40, 20),
                )
            ):
                sky.svg(
                    x,
                    -z,
                    f'<rect x="{fmt(-w / 2)}" y="-0.35" width="{fmt(w)}" height="0.7" rx="0.35" fill="{s.haze(P.water_foam, s.W((x, 0, z)))}" opacity="0.7"/>',
                    prio=-1,
                    cls="shimmer",
                    style=f"--period:{2.4 + i * 0.4:.1f}s;--delay:-{i * 0.7:.1f}s",
                )
        if reservoir:
            s.box(
                (0, 0, CREST_D + RES_D / 2 - 0.5),
                (L, RES_Y, RES_D),
                P.water_deep,
                colors={"top": P.water},
                shadow=False,
                prio=-1,
            )

        # the wall: two full-height wings and the lower spillway block between them
        wing(s, xl, sl + 1)
        wing(s, sr - 1, xr)
        xprism(s, sl + 1, sr - 1, wall_profile(HS), DAM, colors={0: SHEET_TOP}, shadow=False)

        # bays: water sheet, gate housing, road deck
        x = sl + ABUT_W
        bay_x = []
        for i in range(bays):
            bay_x.append((x, x + BAY_W))
            x += BAY_W + PIER_W
        for x0, x1 in bay_x:
            spill_sheet(s, x0, x1, rnd)
            s.box(
                ((x0 + x1) / 2, HS, (1 + CREST_D) / 2),
                (x1 - x0, H - 2 - HS, CREST_D - 1),
                GATE,
                colors={"top": GATE_DARK},
                prio=3,
                shadow=False,
            )
            g = s.plane((x0, HS, 0.98), (1, 0, 0), (0, 1, 0))
            if facing(s, (x0, HS, 1), (0, 0, -1)):
                # gate leaf ribs and the dark slot at the lip where water leaves
                for k in range(1, 5):
                    g.line([(0.5, k * 2.4), (BAY_W - 0.5, k * 2.4)], GATE_DARK, 0.5, prio=4)
                g.rect(0, 0, BAY_W, 1.2, GATE_DARK, prio=4)
            s.box(
                ((x0 + x1) / 2, H - 2, (CREST_D - 2.5) / 2),
                (x1 - x0, 2, CREST_D + 2.5),
                DAM,
                colors={"top": CREST_ROAD},
                prio=4,
                shadow=False,
            )

        # piers between bays, bigger abutment piers at both ends of the spillway
        for (_, a), (b, _) in zip(bay_x, bay_x[1:]):
            pier(s, (a + b) / 2, PIER_W, PIER_D, H + 2.2)
        pier(s, sl + ABUT_W / 2, ABUT_W, ABUT_D, H + 4.5)
        pier(s, sr - ABUT_W / 2, ABUT_W, ABUT_D, H + 4.5)
        # hoist houses on top of the abutment piers
        for xc in (sl + ABUT_W / 2, sr - ABUT_W / 2):
            s.box(
                (xc, H + 4.5, CREST_D / 2 - 0.5),
                (ABUT_W - 2, 3.5, CREST_D - 2),
                P.concrete_warm,
                colors={"top": P.roof},
                prio=6,
                shadow=False,
            )

        # foam band at the foot
        foam_band(s, sl - 4, sr + 4, rnd)

    powerhouse(s, sr + 10, sr + 46)
