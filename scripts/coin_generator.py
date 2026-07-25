#!/usr/bin/env python3
"""
Generates the coin icon as a standalone SVG file: the simplified "wind
turbine clock" logo sitting on a two-tone coin background.

This does NOT need to run inside Inkscape - it writes a plain .svg file
that you can then open and edit in Inkscape (every shape is a normal,
fully editable path/circle/ellipse, not a bitmap).

Run with:  python3 scripts/coin_generator.py
Produces:  frontend/src/assets/coin.svg
"""

import math
from pathlib import Path

# ----------------------------------------------------------------------
# CONFIG - tweak these to taste
# ----------------------------------------------------------------------
CANVAS = 1450  # width / height of the SVG canvas
CENTER = (725, 725)  # hub center

BG_COLOR = None  # background color (set to "none" for transparent)
FG_COLOR = "#ffc843"  # foreground

COIN_OUTER_R = 725  # radius of the coin's outer rim circle
COIN_INNER_R = 600  # radius of the coin's inner face circle
COIN_OUTER_COLOR = "#ffc843"  # rim color
COIN_INNER_COLOR = "#d49000"  # face color

HUB_R = 50  # small filled circle radius
RING_R = 220  # large ring circle radius
RING_STROKE = 60  # large ring stroke width

BLADE_LEN = 590  # hub-to-tip length of each turbine blade
BLADE_W = 46  # half-width (rx) of the blade ellipse

RAY_COUNT = 12  # number of rays (clock ticks)
RAY_INNER_R = 320  # distance from center to inner edge of ray
RAY_OUTER_R = 480  # distance from center to outer edge of ray
RAY_HALF_ANGLE = 4  # half-width of ray, in degrees
RAY_CORNER_R = 12  # corner rounding radius for rays

BLADE_ANGLES = [60, 180, 300]  # angles (deg, 0=up, clockwise) of the 3 blades

# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------


def polar(radius, angle_deg, center=CENTER):
    """Point at `radius` from `center`, angle measured in degrees,
    0 = straight up, increasing clockwise (like a clock).
    """
    a = math.radians(angle_deg)
    x = center[0] + radius * math.sin(a)
    y = center[1] - radius * math.cos(a)
    return (x, y)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def scale(a, s):
    return (a[0] * s, a[1] * s)


def normalize(a):
    length = math.hypot(a[0], a[1])
    return (a[0] / length, a[1] / length)


def rounded_polygon_path(points, radius):
    """
    Build an SVG path 'd' string for a convex polygon with every corner
    replaced by a circular arc of the given radius (classic
    "shrink each edge, connect with arcs" technique).
    """
    n = len(points)
    cuts = []  # (A, B) = (entry cut point, exit cut point) for each vertex
    for i in range(n):
        prev_pt = points[(i - 1) % n]
        cur_pt = points[i]
        next_pt = points[(i + 1) % n]

        v_in = normalize(sub(prev_pt, cur_pt))
        v_out = normalize(sub(next_pt, cur_pt))

        # clamp radius so it never eats more than half an edge
        edge_in_len = math.hypot(*sub(prev_pt, cur_pt))
        edge_out_len = math.hypot(*sub(next_pt, cur_pt))
        r = min(radius, edge_in_len * 0.49, edge_out_len * 0.49)

        A = add(cur_pt, scale(v_in, r))
        B = add(cur_pt, scale(v_out, r))
        cuts.append((A, B))

    d = f"M {cuts[-1][1][0]:.3f},{cuts[-1][1][1]:.3f} "
    for i in range(n):
        A, B = cuts[i]
        d += f"L {A[0]:.3f},{A[1]:.3f} "
        d += f"A {radius:.3f},{radius:.3f} 0 0,0 {B[0]:.3f},{B[1]:.3f} "
    d += "Z"
    return d


def ray_path(base_angle_deg):
    a1 = base_angle_deg - RAY_HALF_ANGLE
    a2 = base_angle_deg + RAY_HALF_ANGLE
    inner1 = polar(RAY_INNER_R, a1)
    inner2 = polar(RAY_INNER_R, a2)
    outer2 = polar(RAY_OUTER_R, a2)
    outer1 = polar(RAY_OUTER_R, a1)
    return rounded_polygon_path([inner1, inner2, outer2, outer1], RAY_CORNER_R)


# ----------------------------------------------------------------------
# build the SVG
# ----------------------------------------------------------------------


def build_svg():
    parts = []
    parts.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" viewBox="0 0 {CANVAS} {CANVAS}">'
    )

    if BG_COLOR and BG_COLOR.lower() != "none":
        parts.append(f'<rect x="0" y="0" width="{CANVAS}" height="{CANVAS}" fill="{BG_COLOR}"/>')

    # -- coin background (outer rim + inner face) --------------------------
    parts.append(
        f'<circle id="coin-outer" cx="{CENTER[0]}" cy="{CENTER[1]}" r="{COIN_OUTER_R}" fill="{COIN_OUTER_COLOR}"/>'
    )
    parts.append(
        f'<circle id="coin-inner" cx="{CENTER[0]}" cy="{CENTER[1]}" r="{COIN_INNER_R}" fill="{COIN_INNER_COLOR}"/>'
    )

    # -- large ring (no fill, thick stroke) --------------------------------
    parts.append(
        f'<circle id="ring" cx="{CENTER[0]}" cy="{CENTER[1]}" r="{RING_R}" '
        f'fill="none" stroke="{FG_COLOR}" stroke-width="{RING_STROKE}"/>'
    )

    # -- 3 turbine blades (long ellipses, one hub-side tip, rotated) -------
    # An un-rotated blade points straight up: its far tip is above the hub,
    # its near tip sits exactly on the hub center.
    ellipse_cy = CENTER[1] - BLADE_LEN / 2 + 0.5 * HUB_R
    for i, angle in enumerate(BLADE_ANGLES):
        parts.append(
            f'<ellipse id="blade{i + 1}" cx="{CENTER[0]}" cy="{ellipse_cy:.3f}" '
            f'rx="{BLADE_W}" ry="{BLADE_LEN / 2:.3f}" fill="{FG_COLOR}" '
            f'transform="rotate({angle} {CENTER[0]} {CENTER[1]})"/>'
        )

    # -- hub (small filled circle, on top so it covers blade tips) --------
    parts.append(f'<circle id="hub" cx="{CENTER[0]}" cy="{CENTER[1]}" r="{HUB_R}" fill="{FG_COLOR}"/>')

    # -- 12 rays (rounded trapezoids) --------------------------------------
    for i in range(RAY_COUNT):
        angle = i * (360 / RAY_COUNT)
        d = ray_path(angle)
        parts.append(f'<path id="ray{i + 1}" d="{d}" fill="{FG_COLOR}"/>')

    parts.append("</svg>")
    return "\n".join(parts)


if __name__ == "__main__":
    svg = build_svg()
    output_path = Path(__file__).resolve().parent.parent / "frontend" / "src" / "assets" / "coin.svg"
    output_path.write_text(svg)
    print(f"Wrote {output_path}")
