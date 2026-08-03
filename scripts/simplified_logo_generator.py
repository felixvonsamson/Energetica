#!/usr/bin/env python3
"""
Generates the simplified "wind turbine clock" logo as a standalone SVG file,
for use as an icon when the full logo is displayed small.

This does NOT need to run inside Inkscape - it writes a plain .svg file
that you can then open and edit in Inkscape (every shape is a normal,
fully editable path/circle/ellipse, not a bitmap).

Run with:  python3 scripts/simplified_logo_generator.py
Produces:  frontend/src/assets/simplified_logo.svg
"""

import math
from pathlib import Path

# ----------------------------------------------------------------------
# CONFIG - tweak these to taste
# ----------------------------------------------------------------------
CANVAS = 1100  # width / height of the SVG canvas
CENTER = (550, 510)  # hub center

BG_COLOR = None  # background color (set to "none" for transparent)
# No shape below sets its own fill - color is set once, on the root <svg>,
# and every shape inherits it. That means one <svg fill="..."> (or a CSS
# fill-* utility class overriding it, e.g. Tailwind's fill-foreground /
# fill-bone) recolors the whole logo. DEFAULT_COLOR is the brand pine-700
# green, used when nothing else overrides it (e.g. as a standalone favicon).
DEFAULT_COLOR = "#285430"

HUB_R = 50  # small filled circle radius
RING_R = 220  # large ring circle radius
RING_THICKNESS = 60  # large ring thickness

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


def annulus_path(cx, cy, r_outer, r_inner):
    """
    Path 'd' string for a ring (outer circle minus inner circle), so it can
    be drawn with a plain fill instead of a stroke - every shape in this
    icon then shares the same "fill" property and recolors together.
    """

    def circle_subpath(r):
        return f"M {cx - r},{cy} A {r},{r} 0 1,0 {cx + r},{cy} A {r},{r} 0 1,0 {cx - r},{cy} Z"

    return f"{circle_subpath(r_outer)} {circle_subpath(r_inner)}"


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
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" viewBox="0 0 {CANVAS} {CANVAS}" '
        f'fill="{DEFAULT_COLOR}">'
    )

    if BG_COLOR and BG_COLOR.lower() != "none":
        parts.append(f'<rect x="0" y="0" width="{CANVAS}" height="{CANVAS}" fill="{BG_COLOR}"/>')

    # -- large ring (filled annulus, not a stroke, so it shares "fill" with
    # -- everything else below) --------------------------------------------
    ring_d = annulus_path(CENTER[0], CENTER[1], RING_R + RING_THICKNESS / 2, RING_R - RING_THICKNESS / 2)
    parts.append(f'<path id="ring" fill-rule="evenodd" d="{ring_d}"/>')

    # -- 3 turbine blades (long ellipses, one hub-side tip, rotated) -------
    # An un-rotated blade points straight up: its far tip is above the hub,
    # its near tip sits exactly on the hub center.
    ellipse_cy = CENTER[1] - BLADE_LEN / 2 + 0.5 * HUB_R
    for i, angle in enumerate(BLADE_ANGLES):
        parts.append(
            f'<ellipse id="blade{i + 1}" cx="{CENTER[0]}" cy="{ellipse_cy:.3f}" '
            f'rx="{BLADE_W}" ry="{BLADE_LEN / 2:.3f}" '
            f'transform="rotate({angle} {CENTER[0]} {CENTER[1]})"/>'
        )

    # -- hub (small filled circle, on top so it covers blade tips) --------
    parts.append(f'<circle id="hub" cx="{CENTER[0]}" cy="{CENTER[1]}" r="{HUB_R}"/>')

    # -- 12 rays (rounded trapezoids) --------------------------------------
    for i in range(RAY_COUNT):
        angle = i * (360 / RAY_COUNT)
        d = ray_path(angle)
        parts.append(f'<path id="ray{i + 1}" d="{d}"/>')

    parts.append("</svg>")
    return "\n".join(parts)


if __name__ == "__main__":
    svg = build_svg()
    output_path = Path(__file__).resolve().parent.parent / "frontend" / "src" / "assets" / "simplified_logo.svg"
    output_path.write_text(svg)
    print(f"Wrote {output_path}")
