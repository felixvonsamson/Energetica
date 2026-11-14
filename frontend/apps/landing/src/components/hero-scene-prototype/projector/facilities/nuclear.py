# ruff: noqa
"""Nuclear power plant: two hyperboloid cooling towers, a containment dome, a vent stack and
the turbine hall. Reference facility: shows the projector API in use."""

import effects as fx
import palette as P
from core import Scene, cylinder_profile, dome_profile, hyperboloid_profile

NAME = "Nuclear power plant"
EXTENT = (260, 160, 140)


def cooling_tower(s: Scene, x, z, steam=True, seed=0):
    h = 150
    with s.group(anchor=(x, 0, z)):
        s.lathe((x, 0, z), hyperboloid_profile(56, 36, 40, h), P.concrete, top="open", inner="#56636c")
        body = s.last_outline
        # a thin darker band at the rim, as on the banner
        s.lathe((x, h - 6, z), [(39.2, 0), (40.3, 6)], P.concrete_dark, shadow=False, prio=1)
        if steam:
            # Born inside the mouth and clipped by the tower's own silhouette, so the plume
            # rises out of the tower: no gap above the rim, and nothing painted over it.
            fx.steam(
                s, (x, h - 14, z), size=26, n=26, period=12, rise=150, wind=105, seed=seed,
                plume=True, behind=body, spread=1.1, lift=0.0,
            )  # fmt: skip


def build(s: Scene, hall="front"):
    """hall="front": the turbine hall's long window side faces the front (-z), as in the gallery.
    hall="left": the buildings are turned 90 degrees so that side faces left (-x)."""
    cooling_tower(s, -82, 30, seed=1)
    cooling_tower(s, 82, 40, seed=2)

    # containment building: cylinder + dome, with the orange ring the banner has
    with s.group(anchor=(0, 0, 18)):
        s.lathe((0, 0, 18), cylinder_profile(25, 26), P.concrete_warm, bands=[(18, 21, P.red)])
        s.lathe((0, 26, 18), dome_profile(25, 22), P.white, shading="radial", shadow=False, prio=1)

    # vent stack
    with s.group(anchor=(36, 0, 34)):
        s.lathe((36, 0, 34), [(4.2, 0), (3.4, 128)], P.white, bands=[(104, 110, P.red), (116, 122, P.red)])

    # reactor auxiliary block beside the dome
    with s.group(anchor=(-34, 0, 4)):
        s.box((-34, 0, 4), (44, 30, 34), P.concrete)

    if hall == "left":
        _buildings_left(s)
    else:
        _buildings_front(s)


def _buildings_front(s: Scene):
    # turbine hall in front, a low annex to its right
    with s.group(anchor=(0, 0, -30)):
        s.box((0, 0, -30), (120, 24, 34), P.concrete, colors={"top": P.roof})
        hall = s.plane((-60, 0, -47.01), (1, 0, 0), (0, 1, 0))  # front face of the hall
        if hall.visible():
            for i in range(9):
                hall.rect(8 + i * 12.5, 15, 7, 4, P.window, prio=2)
            hall.rect(52, 0, 14, 10, P.steel_dark, prio=2)  # big door
        s.box((-30, 24, -30), (16, 4, 10), P.steel, prio=2, shadow=False)
        s.box((22, 24, -26), (10, 3, 8), P.steel, prio=2, shadow=False)
    with s.group(anchor=(78, 0, -26)):
        s.box((78, 0, -26), (34, 16, 26), P.concrete_warm, colors={"top": P.roof})
        door = s.plane((61, 0, -39.01), (1, 0, 0), (0, 1, 0))
        if door.visible():
            door.rect(6, 0, 8, 9, P.steel_dark, prio=2)
    with s.group(anchor=(20, 0, -6)):
        s.tube([(18, 12, 0), (18, 12, -12), (30, 12, -12)], 1.6, P.orange)
        s.tube([(24, 8, 4), (24, 8, -12)], 1.6, P.orange)


def _buildings_left(s: Scene):
    # turbine hall running front to back in front of the dome, its window side facing left (-x)
    hx, hz0, hz1, hw, hh = -4.0, -112.0, -12.0, 34.0, 24.0  # centre x, front z, back z, width, height
    with s.group(anchor=(hx, 0, (hz0 + hz1) / 2)):
        s.box((hx, 0, (hz0 + hz1) / 2), (hw, hh, hz1 - hz0), P.concrete, colors={"top": P.roof})
        # left face (outward -x): u runs from the back end towards the front, v up
        side = s.plane((hx - hw / 2 - 0.01, 0, hz1), (0, 0, -1), (0, 1, 0))
        if side.visible():
            n = 7
            for i in range(n):
                side.rect(8 + i * 12.5, 15, 7, 4, P.window, prio=2)
            side.rect(8 + n * 12.5 + 1, 0, 12, 10, P.steel_dark, prio=2)  # big door near the front
        front = s.plane((hx - hw / 2, 0, hz0 - 0.01), (1, 0, 0), (0, 1, 0))
        if front.visible():
            front.rect(hw / 2 - 5, 0, 10, 9, P.steel_dark, prio=2)
        s.box((hx, hh, -40), (10, 4, 16), P.steel, prio=2, shadow=False)
        s.box((hx + 4, hh, -86), (8, 3, 10), P.steel, prio=2, shadow=False)
    # low annex beside the hall, front right, same orientation
    with s.group(anchor=(36, 0, -70)):
        s.box((36, 0, -70), (26, 16, 34), P.concrete_warm, colors={"top": P.roof})
        door = s.plane((36 - 13 - 0.01, 0, -53), (0, 0, -1), (0, 1, 0))
        if door.visible():
            door.rect(12, 0, 8, 9, P.steel_dark, prio=2)
    # orange steam lines from the dome to the back of the hall
    with s.group(anchor=(4, 0, -6)):
        s.tube([(-4, 12, 0), (-4, 12, -12)], 1.6, P.orange)
        s.tube([(6, 8, 4), (6, 8, -6), (8, 8, -12)], 1.6, P.orange)
