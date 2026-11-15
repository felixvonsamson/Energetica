# ruff: noqa
"""Coal mine: a portal cut into a dark hillside, an inclined conveyor rising out of it onto a
coal stockpile, a yellow tracked excavator loading a screening hopper on legs, and a loaded
yellow dump truck in front. A small headframe (winding house, inclined gallery, lattice tower)
stands on the hill top, as in the banner's upper left.

Reusable pieces (all draw in the current local frame, ground at y=0):
    excavator(s, at, yaw)          tracked excavator, facing local +x
    dump_truck(s, at, yaw)         three-axle tipper loaded with coal, facing local +x
    stockpile(s, at, r, h, seed)   faceted coal heap
    screen(s, at)                  screening / loading hopper on legs
    conveyor(s, a, b)              inclined belt conveyor from a (tail) to b (head)
    hill_portal(s)                 hillside cut with the mine portal
    headframe(s, at)               winding house + gallery + lattice tower
"""

import math
import random

import palette as P
from core import Scene, add, centroid, cross, dot, hull2d, mul, newell, norm, path_d, sub

NAME = "Coal mine"
EXTENT = (38, 12, 26)

# extra colours, sampled from the banner crop
OPENING = "#15181c"  # inside the portal
CONV = "#6f8796"  # blue-grey conveyor steel
SCREEN = "#5b7b8c"  # teal steel of the screening plant
RUST = "#6e5040"  # worn plates inside the hopper
YARD = "#4a4a48"  # dark trodden yard
CUT = "#4a423b"  # dark cut face of the hill
HEADFRAME = "#8aa79c"  # sage green building
HEADLIGHT = "#fff2c2"
CHROME = "#aab4bc"


# ---------------------------------------------------------------- small geometry helpers


def convex(s: Scene, verts, faces, color, *, colors=None, prio=0, shadow=True):
    """polyhedron() with face winding fixed automatically (faces point away from the centroid)."""
    c = centroid(verts)
    fixed = []
    for f in faces:
        pts = [verts[i] for i in f]
        n = newell(pts)
        fixed.append(f if dot(n, sub(centroid(pts), c)) >= 0 else f[::-1])
    s.polyhedron(verts, fixed, color, colors=colors, prio=prio, shadow=shadow)


def zprism(s: Scene, prof, z0, z1, color, *, colors=None, prio=0, shadow=True):
    """Extrude a convex side profile [(x, y), ...] along local z from z0 to z1.
    Face indices for `colors`: 0 = z0 cap, 1 = z1 cap, 2 + i = side from prof[i] to prof[i+1]."""
    n = len(prof)
    verts = [(x, y, z0) for x, y in prof] + [(x, y, z1) for x, y in prof]
    faces = [list(range(n)), list(range(n, 2 * n))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    convex(s, verts, faces, color, colors=colors, prio=prio, shadow=shadow)


def xybeam(s: Scene, p, q, t0, t1, z0, z1, color, **kw):
    """Tapered beam in the local x-y plane from p to q (half-thicknesses t0, t1), extruded along z."""
    d = norm((q[0] - p[0], q[1] - p[1], 0))
    n = (-d[1], d[0])
    prof = [(p[0] + n[0] * t0, p[1] + n[1] * t0), (p[0] - n[0] * t0, p[1] - n[1] * t0),
            (q[0] - n[0] * t1, q[1] - n[1] * t1), (q[0] + n[0] * t1, q[1] + n[1] * t1)]  # fmt: skip
    zprism(s, prof, z0, z1, color, **kw)


def beam3(s: Scene, a, b, w, h, color, *, colors=None, prio=0, shadow=True):
    """Box beam whose top-centre line runs from a to b (local), width w, depth h below that line.
    Face indices: 0 top, 1 bottom, 2 side left (+n), 3 side right (-n), 4 tail (a), 5 head (b)."""
    d = norm(sub(b, a))
    side = norm(cross(d, (0, 1, 0)))
    up = norm(cross(side, d))
    o = mul(side, w / 2)
    dn = mul(up, -h)
    v = [add(a, o), add(a, mul(o, -1)), add(b, mul(o, -1)), add(b, o)]
    v += [add(p, dn) for p in v]
    faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5], [0, 1, 5, 4], [3, 2, 6, 7]]
    convex(s, v, faces, color, colors=colors, prio=prio, shadow=shadow)
    return side, up


def faces_cam(s: Scene, normal_local, point_local):
    """True if a surface with this outward local normal at this local point faces the camera."""
    return dot(s.Wv(normal_local), sub(s.cam.pos, s.W(point_local))) > 0


def wheel(s: Scene, c, r, width, color=P.tyre, hub=P.yellow, prio=0):
    """Horizontal-axis wheel along local z centred at c: tread silhouette from the convex hull of
    both rims, then the camera-side sidewall, rim and hub. One painter part."""
    n = 28
    faces = []
    for sgn in (-1, 1):
        zc = c[2] + sgn * width / 2
        faces.append(
            [
                s.W((c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n), zc))
                for i in range(n)
            ]
        )
    hull = hull2d([tuple(round(v, 2) for v in s.P(p)) for ring in faces for p in ring])
    cw = s.W(c)
    tread = s.tone(color, None, cw, k=-0.35)
    sgn = -1 if faces_cam(s, (0, 0, -1), (c[0], c[1], c[2] - width / 2)) else 1
    zc = c[2] + sgn * width / 2
    nw = s.Wv((0, 0, sgn))

    def ring(k, z_off=0.0):
        return path_d(
            [
                s.P(
                    s.W(
                        (
                            c[0] + k * r * math.cos(2 * math.pi * i / n),
                            c[1] + k * r * math.sin(2 * math.pi * i / n),
                            zc + sgn * z_off,
                        )
                    )
                )
                for i in range(n)
            ]
        )

    svg = f'<path d="{path_d(hull)}" {s._style(tread)}/>'
    svg += f'<path d="{ring(1.0)}" {s._style(s.tone(color, nw, cw))}/>'
    svg += f'<path d="{ring(0.6)}" {s._style(s.tone("#3b3f45", nw, cw, k=-0.2))}/>'
    svg += f'<path d="{ring(0.5, 0.02)}" {s._style(s.tone(hub, nw, cw))}/>'
    svg += f'<path d="{ring(0.2, 0.04)}" {s._style(s.tone(P.yellow_dark, nw, cw, k=-0.3))}/>'
    s.emit(svg, cw, prio=prio)


def side_plane(s: Scene, z, sgn):
    """Plane on a vertical face at local z whose outward normal is (0, 0, sgn); x along +x, y up."""
    return s.plane((0, 0, z + sgn * 0.02), (1, 0, 0), (0, 1, 0))


# ---------------------------------------------------------------- vehicles


def excavator(s: Scene, at=(0, 0, 0), yaw=0.0, reach=1.0):
    """Tracked excavator facing local +x, cab on its local -z side. reach scales the arm pose."""
    with s.frame(at, yaw):
        with s.group(anchor=(0, 0, 0)):
            near = -1 if faces_cam(s, (0, 0, -1), (0, 1, -1.4)) else 1  # side that faces the camera
            cab_near = near == -1
            # tracks: stadium side profile, two of them
            prof = []
            for k in range(7):
                a = math.pi / 2 + math.pi * k / 6
                prof.append((-1.95 + 0.5 * math.cos(a), 0.5 + 0.5 * math.sin(a)))
            for k in range(7):
                a = -math.pi / 2 + math.pi * k / 6
                prof.append((1.95 + 0.5 * math.cos(a), 0.5 + 0.5 * math.sin(a)))
            for sgn in (-1, 1):
                pr = 1.0 if sgn == near else 0.0
                zprism(s, prof, sgn * 1.4, sgn * 0.75, P.tyre, prio=pr)
            tp = side_plane(s, near * 1.4, near)
            for x in (-1.95, 1.95):
                tp.circle(x, 0.5, 0.36, P.steel_dark, n=16, prio=1.1)
                tp.circle(x, 0.5, 0.14, P.fan_blade, n=10, prio=1.2)
            for x in (-0.9, 0, 0.9):
                tp.circle(x, 0.3, 0.17, P.steel_dark, n=10, prio=1.1)
            tp.line([(-1.95, 0.93), (1.95, 0.93)], P.fan_blade, 0.07, prio=1.1)
            # slew ring and upper body
            s.lathe((0, 0.95, 0), [(1.0, 0), (1.0, 0.3)], P.steel_dark, segments=20, shadow=False, prio=1.5)
            foot = [(-1.6, -1.3), (1.3, -1.3), (1.3, 1.3), (-1.6, 1.3), (-2.05, 0.85), (-2.05, -0.85)]
            s.prism((0, 1.25, 0), foot, 1.2, P.yellow, prio=2)
            bp = side_plane(s, near * 1.3, near)
            for i in range(4):  # engine louvres
                bp.line([(-1.5 + i * 0.22, 1.55), (-1.5 + i * 0.22, 2.15)], P.fan_dark, 0.08, prio=2.1)
            bp.line([(-1.9, 1.32), (1.25, 1.32)], P.yellow_dark, 0.1, prio=2.1)
            s.tube([(-1.2, 2.45, 0.5), (-1.2, 3.1, 0.5)], 0.08, P.fan_dark, prio=2.2)  # exhaust
            # boom, arm and bucket, slightly to the cab's far side
            zb0, zb1 = 0.0, 0.6
            if near == 1:
                zb0, zb1 = -0.05, 0.55
            boom_prio = 3 if cab_near else 4
            bz0, bz1 = zb0, zb1
            p0 = (1.0, 2.2)
            p1 = (2.5, 5.4)
            p2 = (3.4 + 0.2 * reach, 6.7)
            p3 = (3.4 + 2.6 * reach, 6.1)
            xybeam(s, p0, p1, 0.42, 0.36, bz0, bz1, P.yellow, prio=boom_prio, shadow=False)
            xybeam(s, (p1[0] - 0.15, p1[1] - 0.25), p2, 0.38, 0.3, bz0, bz1, P.yellow, prio=boom_prio, shadow=False)
            xybeam(
                s,
                (p2[0] - 0.25, p2[1] + 0.25),
                p3,
                0.27,
                0.2,
                bz0 + 0.06,
                bz1 - 0.06,
                P.yellow,
                prio=boom_prio + 0.2,
                shadow=False,
            )
            # bucket hanging at the wrist, teeth down
            wx, wy = p3
            bucket = [
                (wx - 0.35, wy + 0.1),
                (wx + 0.45, wy + 0.05),
                (wx + 0.55, wy - 0.75),
                (wx + 0.1, wy - 1.15),
                (wx - 0.5, wy - 0.55),
            ]
            zprism(s, bucket, bz0 - 0.15, bz1 + 0.15, P.steel_dark, prio=boom_prio + 0.3, shadow=False)
            # hydraulic cylinders on the camera side of the boom
            zc = (bz0 if near == -1 else bz1) + near * 0.06
            s.tube([(1.5, 1.95, zc), (2.45, 4.6, zc)], 0.09, CHROME, prio=boom_prio + 0.5)
            s.tube([(2.25, 5.6, zc), (3.25, 7.05, zc)], 0.085, CHROME, prio=boom_prio + 0.5)
            s.tube(
                [(3.6, 6.9, (bz0 + bz1) / 2), (wx - 0.1, wy + 0.4, (bz0 + bz1) / 2)],
                0.075,
                CHROME,
                prio=boom_prio + 0.4,
            )
            # cab on the front corner of the body, with a raked front
            cz0, cz1 = -1.3, -0.3
            cab = [(0.15, 2.45), (1.3, 2.45), (1.15, 4.05), (0.15, 4.05)]
            zprism(s, cab, cz0, cz1, P.yellow, prio=4 if cab_near else 3, shadow=False)
            cp = 4.1 if cab_near else 3.1
            if faces_cam(s, (0, 0, -1), (0.7, 3.2, cz0)):
                pl = side_plane(s, cz0, -1)
                pl.poly([(0.3, 2.95), (1.18, 2.95), (1.08, 3.9), (0.3, 3.9)], P.glass, prio=cp)
                pl.line([(0.72, 2.95), (0.72, 3.9)], P.yellow, 0.07, prio=cp + 0.01)
            if faces_cam(s, (1, 0.1, 0), (1.25, 3.2, -0.8)):
                # raked front window: interpolate along the raked edge
                def fr(t, z):
                    return (1.3 - 0.15 * t + 0.02, 2.45 + 1.6 * t, z)

                s.poly([fr(0.32, -1.18), fr(0.32, -0.42), fr(0.92, -0.42), fr(0.92, -1.18)], P.glass, prio=cp)
            if faces_cam(s, (0, 0, 1), (0.7, 3.2, cz1)):
                pl = side_plane(s, cz1, 1)
                pl.poly([(0.3, 2.95), (1.18, 2.95), (1.08, 3.9), (0.3, 3.9)], P.glass, prio=cp)


def dump_truck(s: Scene, at=(0, 0, 0), yaw=0.0, load=True):
    """Three-axle tipper truck facing local +x, loaded with coal. About 9 m long."""
    W = 1.25  # half width of cab and body
    with s.frame(at, yaw):
        with s.group(anchor=(0, 0, 0)):
            near = -1 if faces_cam(s, (0, 0, -1), (0, 1, -W)) else 1
            front_seen = faces_cam(s, (1, 0, 0), (4.1, 2, 0))
            r, ww = 0.68, 0.55
            axles = (2.9, -1.55, -3.05)
            zw = 1.36 - ww / 2
            for x in axles:
                wheel(s, (x, r, -near * zw), r, ww, prio=0)
            # chassis rails and fuel tank
            s.box((-0.3, 0.55, 0), (7.9, 0.6, 1.4), P.fan_dark, prio=1)
            s.box((1.1, 0.55, near * 0.95), (1.3, 0.6, 0.5), P.steel_dark, prio=1.5, shadow=False)
            # tipping body: sloped top rising to the front
            body = [(-4.3, 1.4), (2.25, 1.4), (2.25, 3.6), (-4.6, 3.15)]
            zprism(s, body, -W, W, P.yellow, prio=2, colors={4: P.yellow_dark}, shadow=True)
            # front lip over the cab
            lip = [(2.0, 3.45), (2.3, 3.45), (3.05, 3.8), (2.0, 3.8)]
            zprism(s, lip, -W + 0.05, W - 0.05, P.yellow, prio=3.5, shadow=False)
            bp = side_plane(s, near * W, near)
            for x in (-3.4, -2.2, -1.0, 0.2, 1.4):
                top = 3.15 + (x + 4.6) / 6.85 * 0.45
                bp.line([(x, 1.45), (x, top - 0.08)], P.yellow_dark, 0.12, prio=2.1)
            bp.line([(-4.5, 3.05), (2.2, 3.5)], P.yellow_dark, 0.1, prio=2.1)
            bp.line([(-4.3, 1.55), (2.2, 1.55)], P.yellow_dark, 0.1, prio=2.1)
            if load:
                # coal heaped in the body: faceted ridge above the sloped top
                def ys(x):
                    return 3.15 + (x + 4.6) / 6.85 * 0.45

                zi = W - 0.12
                b = [(-4.4, ys(-4.4), -zi), (2.1, ys(2.1), -zi), (2.1, ys(2.1), zi), (-4.4, ys(-4.4), zi)]
                rg = [(-3.4, ys(-3.4) + 0.7, 0.1), (-1.0, ys(-1.0) + 0.95, -0.1), (1.2, ys(1.2) + 0.7, 0.05)]
                v = b + rg
                faces = [
                    [0, 1, 5],
                    [0, 5, 4],
                    [1, 6, 5],
                    [3, 5, 2],
                    [3, 4, 5],
                    [2, 5, 6],
                    [0, 4, 3],
                    [1, 2, 6],
                    [0, 3, 2, 1],
                ]
                convex(s, v, faces, P.coal, prio=2.5, shadow=False, colors={1: P.coal_light, 4: P.coal_light})
            # cab: raked windscreen, grille, lights, bumper
            cab = [(2.4, 1.15), (4.15, 1.15), (4.15, 2.5), (3.95, 3.5), (2.4, 3.5)]
            cab_prio = 2.6 if front_seen else 1.9
            zprism(s, cab, -W, W, P.yellow, prio=cab_prio, shadow=False)
            s.box((4.25, 0.75, 0), (0.3, 0.45, 2.5), P.fan_dark, prio=cab_prio + 0.1, shadow=False)
            if front_seen:
                fp = s.plane(
                    (4.17, 0, 0), (0, 0, -1), (0, 1, 0)
                )  # x across the front (left to right seen from the front)
                fp.rect(-0.6, 1.3, 1.2, 0.85, P.fan_dark, prio=cab_prio + 0.1)
                for i in range(4):
                    fp.line([(-0.5, 1.45 + i * 0.19), (0.5, 1.45 + i * 0.19)], P.steel_dark, 0.07, prio=cab_prio + 0.12)
                for x in (-0.95, 0.95):
                    fp.rect(x - 0.17, 1.55, 0.34, 0.3, HEADLIGHT, shade=False, prio=cab_prio + 0.1)

                # windscreen on the raked face (from y 2.5 to 3.5, x 4.15 -> 3.95)
                def ws(t, z):
                    return (4.17 - 0.2 * t, 2.5 + t, z)

                s.poly([ws(0.12, -1.1), ws(0.12, 1.1), ws(0.88, 1.1), ws(0.88, -1.1)], P.glass, prio=cab_prio + 0.1)
                s.poly(
                    [ws(0.12, -0.03), ws(0.12, 0.03), ws(0.88, 0.03), ws(0.88, -0.03)],
                    P.yellow_dark,
                    prio=cab_prio + 0.11,
                )
            cp = side_plane(s, near * W, near)
            cp.poly([(2.6, 2.45), (3.9, 2.45), (3.85, 3.35), (2.6, 3.35)], P.glass, prio=cab_prio + 0.1)
            cp.line([(2.5, 1.3), (2.5, 3.35)], P.yellow_dark, 0.06, prio=cab_prio + 0.1)
            cp.rect(3.3, 2.1, 0.3, 0.07, P.fan_dark, prio=cab_prio + 0.1)  # door handle
            cp.rect(2.55, 0.62, 0.55, 0.12, P.steel_dark, prio=cab_prio + 0.1)  # step
            # mirror arm
            s.tube(
                [(4.0, 3.0, near * W), (4.25, 3.0, near * (W + 0.35)), (4.25, 2.5, near * (W + 0.35))],
                0.06,
                P.fan_dark,
                prio=cab_prio + 0.2,
            )
            for x in axles:
                wheel(s, (x, r, near * zw), r, ww, prio=4)


# ---------------------------------------------------------------- site pieces


def stockpile(s: Scene, at, r=6.0, h=4.0, seed=0, n=11, prio=0, shadow=True):
    """Faceted coal heap: a jittered base ring, a jittered shoulder ring and an apex."""
    rnd = random.Random(seed)
    x0, y0, z0 = at
    base, mid = [], []
    for i in range(n):
        a = 2 * math.pi * (i + rnd.uniform(-0.15, 0.15)) / n
        rb = r * rnd.uniform(0.92, 1.05)
        base.append((x0 + rb * math.cos(a), y0, z0 + rb * math.sin(a)))
        a2 = a + math.pi / n
        rm = r * rnd.uniform(0.55, 0.64)
        mid.append((x0 + rm * math.cos(a2), y0 + h * rnd.uniform(0.5, 0.6), z0 + rm * math.sin(a2)))
    apex = (x0 + rnd.uniform(-0.1, 0.1) * r, y0 + h, z0 + rnd.uniform(-0.1, 0.1) * r)
    v = base + mid + [apex]
    A = 2 * n
    faces = [list(range(n))]
    colors = {}
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + i])  # lower triangle
        faces.append([n + i, j, n + j])
        faces.append([n + i, n + j, A])
        if i % 3 == 1:
            colors[len(faces) - 2] = P.coal_light
        if i % 4 == 0:
            colors[len(faces) - 1] = P.coal_light
    convex(s, v, faces, P.coal, colors=colors, prio=prio, shadow=shadow)


def screen(s: Scene, at=(0, 0, 0)):
    """Screening/loading plant: a steel box with mesh panels on four legs, a hopper underneath."""
    x0, _, z0 = at
    with s.frame(at):
        with s.group(anchor=(0, 0, 0)):
            stockpile(s, (0.2, 0, -0.1), r=2.4, h=1.5, seed=7, n=8, prio=-1, shadow=False)
            # hopper funnel below the box, chute
            s.prism((0, 1.4, 0), [(-0.45, -0.45), (0.45, -0.45), (0.45, 0.45), (-0.45, 0.45)], 1.3, SCREEN,
                    top_offset=[(-1.05, -0.95), (1.05, -0.95), (1.05, 0.95), (-1.05, 0.95)], prio=1, shadow=False)  # fmt: skip
            s.box((0, 0.8, 0), (0.6, 0.65, 0.6), P.steel_dark, prio=0.9, shadow=False)
            # box with an open top full of coal
            s.box((0, 2.7, 0), (3.2, 1.8, 2.9), SCREEN, colors={"top": RUST}, prio=2)
            s.box((0, 4.52, 0), (2.8, 0.1, 2.5), P.coal_light, prio=2.1, shadow=False)
            # legs, splayed, with braces on the camera sides
            legs = [(-1.9, -1.7), (1.9, -1.7), (1.9, 1.7), (-1.9, 1.7)]
            tops = [(-1.5, -1.35), (1.5, -1.35), (1.5, 1.35), (-1.5, 1.35)]
            for (bx, bz), (tx, tz) in zip(legs, tops):
                pr = 3 if faces_cam(s, (bx, 0, bz), (bx, 2, bz)) else 0
                s.tube([(bx, 0, bz), (tx, 2.75, tz)], 0.14, SCREEN, prio=pr)
            for i in range(4):
                a, b = legs[i], legs[(i + 1) % 4]
                ta, tb = tops[i], tops[(i + 1) % 4]
                mid = ((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
                if not faces_cam(s, mid, (mid[0], 1.5, mid[2])):
                    continue

                def lp(p, q, t, y):
                    return (p[0] + (q[0] - p[0]) * t, y, p[1] + (q[1] - p[1]) * t)

                ya, yb = 0.3, 2.5
                f = 0.3 / 2.75
                g = 2.5 / 2.75
                pa0 = (a[0] + (ta[0] - a[0]) * f, ya, a[1] + (ta[1] - a[1]) * f)
                pb0 = (b[0] + (tb[0] - b[0]) * f, ya, b[1] + (tb[1] - b[1]) * f)
                pa1 = (a[0] + (ta[0] - a[0]) * g, yb, a[1] + (ta[1] - a[1]) * g)
                pb1 = (b[0] + (tb[0] - b[0]) * g, yb, b[1] + (tb[1] - b[1]) * g)
                s.tube([pa0, pb1], 0.07, SCREEN, prio=3)
                s.tube([pb0, pa1], 0.07, SCREEN, prio=3)
                s.tube([lp(a, b, 0, 1.4), lp(b, a, 0, 1.4)], 0.06, SCREEN, prio=3)
            # mesh panels on the visible faces of the box
            for nrm, o, u in (((0, 0, -1), (-1.6, 2.7, -1.47), (1, 0, 0)), ((1, 0, 0), (1.62, 2.7, -1.45), (0, 0, 1)),
                              ((-1, 0, 0), (-1.62, 2.7, 1.45), (0, 0, -1)), ((0, 0, 1), (1.6, 2.7, 1.47), (-1, 0, 0))):  # fmt: skip
                if not faces_cam(s, nrm, o):
                    continue
                pl = s.plane(o, u, (0, 1, 0))
                w = 3.2 if nrm[2] else 2.9
                pl.rect(0.25, 0.25, w - 0.5, 1.25, P.steel_dark, prio=2.2)
                for k in range(1, 6):
                    x = 0.25 + (w - 0.5) * k / 6
                    pl.line([(x, 0.25), (x, 1.5)], SCREEN, 0.06, prio=2.3)
                pl.line([(0.25, 0.87), (w - 0.25, 0.87)], SCREEN, 0.06, prio=2.3)


def conveyor(s: Scene, a, b, width=1.5, legs=(0.3, 0.55, 0.8), period=1.4):
    """Inclined belt conveyor; coal flows from a (tail) to b (head). Animated with class="flow"."""
    mid = mul(add(a, b), 0.5)
    with s.group(anchor=(b[0], 0, b[2] - 0.5)):
        side, up = beam3(s, a, b, width, 0.75, CONV, colors={0: P.tyre}, prio=1, shadow=True)
        # truss on the camera-facing side
        sg = 1 if faces_cam(s, side, add(mid, mul(side, width / 2))) else -1
        off = mul(side, sg * (width / 2 + 0.02))
        L = math.dist(a, b)
        d = norm(sub(b, a))
        n = max(4, int(L / 1.3))
        zz = []
        for i in range(n + 1):
            t = i / n
            p = add(add(a, mul(d, t * L)), off)
            zz.append(add(p, mul(up, -0.72 if i % 2 else -0.05)))
        s.tube(zz, 0.05, P.steel, prio=1.2, k=0.3)
        s.tube([add(a, add(off, mul(up, -0.05))), add(b, add(off, mul(up, -0.05)))], 0.07, P.steel, prio=1.2, k=0.3)
        # belt load: moving dashes along the centre line, in output pixels
        lift = mul(up, 0.03)
        pts = [s.P(s.W(add(add(a, mul(d, t * L)), lift))) for t in (0.02, 0.5, 0.97)]
        # stroke width: a share of the belt's projected thickness across the path on screen
        q = [
            s.P(s.W(p))
            for p in (
                add(a, mul(side, width / 2)),
                add(a, mul(side, -width / 2)),
                add(b, mul(side, -width / 2)),
                add(b, mul(side, width / 2)),
            )
        ]
        area = abs(sum(q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1] for i in range(4))) / 2
        span = math.dist(pts[0], pts[-1]) or 1
        wpx = 0.6 * area / span
        col = s.tone(P.coal_light, (0, 1, 0), s.W(mid))
        s.emit(f'<path d="{path_d(pts, close=False)}" fill="none" stroke="{col}" stroke-width="{wpx:.2f}" stroke-linecap="butt" class="flow" style="--period:{period}s" stroke-dasharray="10 16"/>',
               s.W(mid), prio=1.3)  # fmt: skip
        # head pulley hood and the stream of coal falling onto the pile
        s.box(add(b, (0, -0.95, 0)), (1.3, 1.2, width + 0.2), P.steel_dark, prio=2, shadow=False)
        s.tube([add(b, (0.5, -0.9, 0)), add(b, (0.7, -3.0, 0))], 0.35, P.coal, prio=0.5, k=-0.2)
        # support bents: two vertical legs and an X brace at each station
        for t in legs:
            top = add(add(a, mul(sub(b, a), t)), mul(up, -0.75))
            l0 = add(top, mul(side, -width * 0.42))
            r0 = add(top, mul(side, width * 0.42))
            l1, r1 = (l0[0], 0, l0[2]), (r0[0], 0, r0[2])
            for q, q1, sgn in ((l0, l1, -1), (r0, r1, 1)):
                s.tube([q, q1], 0.11, CONV, prio=1.5 if sgn == sg else 0.5)
            s.tube([l0, (r1[0], top[1] * 0.25, r1[2])], 0.045, CONV, prio=0.6)
            s.tube([r0, (l1[0], top[1] * 0.25, l1[2])], 0.045, CONV, prio=0.6)


def hill_portal(
    s: Scene, x0=-20.0, x1=18.0, z_foot=3.0, depth=14.0, h=10.0, rake=3.5, portal_x=-9.0, pw=6.5, ph=6.0, on_top=None
):
    """Hillside cut: a sloped wedge (front face foot at z_foot, top edge set back by `rake`),
    strata and a coal seam on its face, a grass cap, and the portal in front of it.
    on_top(s) may draw things standing on the hill top (they join this object and paint over it)."""
    zb = z_foot + depth
    with s.group(anchor=(0, 0, z_foot + depth * 0.6)):
        inset = 2.0  # the side faces lean in
        foot = [(x0, z_foot), (x1, z_foot), (x1 + 3, zb), (x0 - 3, zb)]
        s.prism(
            (0, 0, 0),
            foot,
            h,
            CUT,
            colors={4: P.dirt},
            prio=-3,
            top_offset=[(inset, rake), (-inset, rake), (-inset, 0), (inset, 0)],
        )
        # grass cap set back from the edge
        zg = z_foot + rake + 1.5
        s.prism((0, h, 0), [(x0 + inset - 0.5, zg), (x1 - inset + 0.5, zg), (x1 + 1, zb), (x0 - 1, zb)], 1.0, P.hill,
                shadow=False, prio=-2.5, top_offset=[(1.2, 2.5), (-1.2, 2.5), (0, 0), (0, 0)], colors={4: P.grass})  # fmt: skip

        def face(t, f):
            # point on the sloped front face: t across (0 left .. 1 right), f up (0 .. 1)
            xl, xr = x0 + inset * f, x1 - inset * f
            return (xl + (xr - xl) * t, h * f, z_foot + rake * f - 0.03)

        def band(f0, f1, col):
            s.poly([face(0, f0), face(1, f0), face(1, f1), face(0, f1)], col, prio=-2.8)

        # strata: a brown topsoil band, then two coal seams
        band(0.84, 1.0, P.dirt_dark)
        band(0.42, 0.53, P.coal)
        band(0.66, 0.7, P.coal)
        # portal: concrete frame protruding from the face, black opening, steel header and stripes
        pd = 4.0  # depth of the frame block; its back is buried in the face
        zf = z_foot - 1.5  # front of the portal
        s.box((portal_x, 0, zf + pd / 2), (pw, ph, pd), P.concrete_dark, prio=1)
        s.box((portal_x, ph, zf + pd / 2 - 0.2), (pw + 0.6, 0.5, pd + 0.4), P.concrete, prio=1.2, shadow=False)
        fp = s.plane((portal_x - pw / 2, 0, zf - 0.02), (1, 0, 0), (0, 1, 0))
        jamb = 0.9
        oh = ph - 1.3
        fp.rect(jamb, 0, pw - 2 * jamb, oh, OPENING, prio=1.1, shade=False)
        fp.rect(jamb, oh - 0.7, pw - 2 * jamb, 0.7, "#2a3036", prio=1.15, shade=False)
        n = 5
        sw = (pw - 2 * jamb) / n
        for i in range(n):
            x = jamb + i * sw
            fp.poly(
                [(x, oh + 0.2), (x + sw * 0.5, oh + 0.2), (x + sw * 0.8, oh + 0.6), (x + sw * 0.3, oh + 0.6)],
                P.yellow,
                prio=1.16,
            )
        if on_top:
            on_top(s)


def headframe(s: Scene, at=(0, 0, 0), scale=1.0):
    """Banner's upper left: a sage-green winding house, an inclined covered gallery rising to a
    lattice tower that tips coal onto a heap behind it. About 18 m wide."""
    with s.frame(at, 0, scale):
        with s.group(anchor=(0, 0, 0)):
            stockpile(s, (12, 0, 4), r=6.5, h=5.5, seed=3, prio=-1)
            s.box((0, 0, 0), (5, 9, 5), HEADFRAME, colors={"top": P.roof_dark}, prio=1)
            s.box((0, 9, 0), (5.4, 0.4, 5.4), P.roof, prio=1.1, shadow=False)
            fp = s.plane((-2.5, 0, -2.52), (1, 0, 0), (0, 1, 0))
            for row in range(3):
                for col in range(2):
                    fp.rect(0.8 + col * 2.2, 1.6 + row * 2.6, 1.2, 1.4, P.window, prio=1.2)
            if faces_cam(s, (1, 0, 0), (2.5, 4, 0)):
                rp = s.plane((2.52, 0, -2.5), (0, 0, 1), (0, 1, 0))
                for row in range(3):
                    rp.rect(1.9, 1.6 + row * 2.6, 1.2, 1.4, P.window, prio=1.2)
            # tower on lattice legs
            tx, tz = 11.5, 0.5
            for dx, dz in ((-1.4, -1.4), (1.4, -1.4), (1.4, 1.4), (-1.4, 1.4)):
                s.tube(
                    [(tx + dx * 1.15, 0, tz + dz * 1.15), (tx + dx, 9, tz + dz)],
                    0.14,
                    P.steel_dark,
                    prio=0 if dz > 0 else 2,
                )
            for y0, y1 in ((0.3, 4.6), (4.6, 9)):
                s.tube([(tx - 1.55, y0, tz - 1.5), (tx + 1.5, y1, tz - 1.45)], 0.07, P.steel_dark, prio=2)
                s.tube([(tx + 1.55, y0, tz - 1.5), (tx - 1.5, y1, tz - 1.45)], 0.07, P.steel_dark, prio=2)
            s.box((tx, 9, tz), (3.6, 2.6, 3.6), HEADFRAME, colors={"top": P.roof_dark}, prio=2.5, shadow=False)
            pl = s.plane((tx - 1.8, 9, tz - 1.82), (1, 0, 0), (0, 1, 0))
            pl.rect(0.5, 1.0, 2.6, 1.0, P.window, prio=2.6)
            # gallery from the house roof up to the tower
            side, up = beam3(
                s, (2.5, 8.2, 0), (tx - 1.8, 10.8, tz), 1.6, 1.6, HEADFRAME, colors={0: P.roof}, prio=2.2, shadow=False
            )
            for t in (0.5,):
                p = (2.5 + (tx - 4.3) * t, 0, 0.5 * tz * t)
                s.tube([(p[0], 0, p[2]), (p[0], 8.2 + 2.6 * t - 1.6, p[2])], 0.13, P.steel_dark, prio=2.1)
            d = norm(sub((tx - 1.8, 10.8, tz), (2.5, 8.2, 0)))
            gp_o = add((2.5, 8.2, 0), mul(side, -0.82 if faces_cam(s, mul(side, -1), (6, 9, 0)) else 0.82))
            n = 5
            L = math.dist((tx - 1.8, 10.8, tz), (2.5, 8.2, 0))
            for i in range(n):
                c = add(gp_o, mul(d, L * (i + 0.5) / n))
                s.tube(
                    [add(c, add(mul(d, -0.4), mul(up, -0.5))), add(c, add(mul(d, 0.4), mul(up, -0.5)))],
                    0.3,
                    P.window,
                    prio=2.3,
                    cap="butt",
                )


# ---------------------------------------------------------------- facility


def build(s: Scene):
    # yard: dark trodden ground, coal-stained around the piles, a lighter haul track
    # a flat group anchored well in front, so it paints over the gallery's grass patch
    with s.group(anchor=(0, 0, -40), flat=True):
        s.ground([(-21, -15), (19, -15), (20, 3), (-21, 3)], YARD, prio=0)
        s.ground([(-2, -9), (7, -9.5), (9, -2), (6, 2), (-1, 2), (-3, -4)], P.coal, prio=1)
        s.ground([(12, 0), (19, 1), (19, 8), (12, 7)], P.coal, prio=1)
        s.road([(-21, -12.5), (-12, -11.5), (0, -11), (10, -10.5), (19, -8)], 3.2, P.dirt_dark, prio=1)

    hill_portal(s, on_top=lambda s: headframe(s, (-14, 10, 9), scale=0.75))
    conveyor(s, (-8.5, 0.6, 3.0), (2.0, 4.6, -1.3))
    with s.group(anchor=(3, 0, 0)):
        stockpile(s, (3, 0, -2.4), r=4.4, h=3.5, seed=1)
    excavator(s, (7.5, 0, 3.5), yaw=0)
    screen(s, (15.6, 0, 4.2))
    dump_truck(s, (-8.5, 0, -8.5), yaw=14)
