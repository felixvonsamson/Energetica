# ruff: noqa
"""Hydrogen plant (electrolysis): a white building with a big blue panel and an H2 logo, a small
domed hall on its roof with a blue ring, two short vent stacks, a white storage tank on the
left joined by pipes, and a low grey service building in front on the right."""

import palette as P
from core import Scene, capsule_profile, cylinder_profile, dome_profile, dot, mix, sub

NAME = "Hydrogen plant"
EXTENT = (80, 30, 45)

# extra colours sampled from the reference crop
SERVICE = "#cfd5da"
SERVICE_DOOR = "#7f98ad"
TANK_BASE = "#6f8fae"
PIPE = "#c2c9cf"

ROOF_Y = 17


def faces_camera(s: Scene, origin, normal):
    """True if the face through local `origin` with outward local `normal` faces the camera.
    (Plane.visible() in core returns the opposite for planes with u right / v up.)"""
    return dot(s.Wv(normal), sub(s.cam.pos, s.W(origin))) > 0


def h2_logo(color):
    """Bold "H2" with a subscript 2, centred on (0, 0), in SVG text space (y down)."""
    font = 'font-family="Arial, Helvetica, sans-serif" font-weight="700"'
    return (
        f'<text x="0" y="3" {font} font-size="8.5" text-anchor="middle" fill="{color}">'
        f'H<tspan font-size="5.2" dy="1.6">2</tspan></text>'
    )


def build(s: Scene):
    with s.frame((-3, 0, 0)):
        _build(s)


def _build(s: Scene):
    # storage tank, left
    with s.group(anchor=(-30, 0, 4)):
        s.lathe((-30, 0, 4), capsule_profile(6.5, 14.5, 2.4), P.white, shading="horizontal",
                bands=[(0, 1.6, TANK_BASE), (12.6, 13.4, P.blue_light)])  # fmt: skip
        s.lathe((-30, 16.9, 4), cylinder_profile(0.7, 0.8), P.steel, shadow=False, prio=1)  # top hatch
        # pipes into the main building's side wall: they sort with the tank so the building hides them when seen from the right
        s.tube([(-24, 5, 1), (-20, 5, 1)], 0.55, PIPE, prio=2)
        s.tube([(-24, 8, 7), (-20, 8, 7)], 0.4, PIPE, prio=2)

    # main building: left block (logo) a little forward of the right block (blue panel)
    with s.group(anchor=(0, 0, 9)):
        s.box((8, 0, 10), (24, ROOF_Y, 22), P.white, colors={"top": P.roof})
        s.box((-12, 0, 7), (16, ROOF_Y, 22), P.white, colors={"top": P.roof}, prio=1)

        if faces_camera(s, (-12, 0, -4), (0, 0, -1)):
            f = s.plane((-20, 0, -4.02), (1, 0, 0), (0, 1, 0))
            f.svg(8, 9.5, f'<g transform="scale(1,-1)">{h2_logo(f.tone(P.blue))}</g>', prio=3)
        if faces_camera(s, (8, 0, -1), (0, 0, -1)):
            f = s.plane((-4, 0, -1.02), (1, 0, 0), (0, 1, 0))
            f.rect(3.5, 1, 20.5, 13.6, P.blue, prio=2)
        if faces_camera(s, (20, 0, 10), (1, 0, 0)):
            f = s.plane((20.02, 0, -1), (0, 0, 1), (0, 1, 0))
            f.rect(0, 1, 18, 13.6, P.blue, prio=2)
            f.rect(18, 0, 2.4, 4.2, P.steel_dark, prio=2)  # side door
        if faces_camera(s, (-20, 0, 7), (-1, 0, 0)):
            f = s.plane((-20.02, 0, 18), (0, 0, -1), (0, 1, 0))
            f.rect(9, 0, 3, 4.6, P.steel_dark, prio=3)

        # dome on a short drum with the blue ring, and two vent stacks
        s.lathe((-2, ROOF_Y, 9), cylinder_profile(8.5, 3.6), P.white, bands=[(1.0, 3.0, P.blue)], shadow=False, prio=2)
        s.lathe((-2, ROOF_Y + 3.6, 9), dome_profile(8.5, 7.5), P.white, shading="radial", shadow=False, prio=3)
        s.lathe((-2, ROOF_Y + 11.1, 9), cylinder_profile(0.8, 0.6), P.steel, shadow=False, prio=4)
        for x in (10.5, 16):
            s.lathe(
                (x, ROOF_Y, 16),
                cylinder_profile(1.6, 12),
                P.white,
                cap=P.steel,
                bands=[(11.2, 12, P.steel)],
                shadow=False,
                prio=2,
            )

        # pipe from the tank over the roof edge (the wall pipes sort with the tank)
        s.tube([(-27, 16.6, 4), (-27, 19, 4), (-16, 19, 4), (-16, ROOF_Y, 4)], 0.55, PIPE, prio=4)

    # low grey service building, front right
    x0, x1, z0, z1, h = 4, 42, -22, -5, 10.5
    with s.group(anchor=((x0 + x1) / 2, 0, (z0 + z1) / 2)):
        s.box(((x0 + x1) / 2, 0, (z0 + z1) / 2), (x1 - x0, h, z1 - z0), SERVICE, colors={"top": P.roof})
        s.box((31, h, -12), (6, 1.4, 4), P.steel, shadow=False, prio=1)  # roof unit
        parapet = mix(SERVICE, P.roof_dark, 0.45)
        if faces_camera(s, (20, 0, z0), (0, 0, -1)):
            f = s.plane((x0, 0, z0 - 0.02), (1, 0, 0), (0, 1, 0))
            f.rect(0, h - 0.8, x1 - x0, 0.8, parapet, prio=2)
            f.rect(14, 0, 3, 5, SERVICE_DOOR, prio=2)  # door
            f.rect(19, 3.2, 1.4, 1.8, SERVICE_DOOR, prio=2)  # panel by the door
            for x in (25, 30.5):
                f.rect(x, 3, 2.6, 3, P.window, prio=2)
            for x in (3, 8):
                f.rect(x, 3, 2.6, 3, P.window, prio=2)
        if faces_camera(s, (x1, 0, -13), (1, 0, 0)):
            f = s.plane((x1 + 0.02, 0, z0), (0, 0, 1), (0, 1, 0))
            f.rect(0, h - 0.8, z1 - z0, 0.8, parapet, prio=2)
            f.rect(6, 3, 2.6, 3, P.window, prio=2)
            f.rect(11, 3, 2.6, 3, P.window, prio=2)
        if faces_camera(s, (x0, 0, -13), (-1, 0, 0)):
            f = s.plane((x0 - 0.02, 0, z1), (0, 0, -1), (0, 1, 0))
            f.rect(0, h - 0.8, z1 - z0, 0.8, parapet, prio=2)
            f.rect(7, 3, 2.6, 3, P.window, prio=2)
