# ruff: noqa
"""Combined-cycle gas plant: two slim banded stacks in a steel frame with walkways, a boiler
(HRSG) block, two domed vessels, orange pipe runs with right-angle bends, a low annex, and a
long white turbine hall in front."""

import math

import effects as fx
import palette as P
from core import Scene, capsule_profile, dot, mix, sub

NAME = "Combined-cycle gas plant"
EXTENT = (110, 85, 60)

# extra colours sampled from the reference crop
STACK = "#eceeee"
VESSEL = "#dde2e6"
FRAME = "#8a97a2"
DECK = "#a9b3bb"
PIPE_GREY = "#c4cbd1"

STACK_H = 82
LEVELS = (30, 48)  # ring platform, then the frame-top deck
STACKS = ((19, 10), (33, 10))
FX0, FX1, FZ0, FZ1 = 12, 40, 4, 16  # steel frame footprint


def faces_camera(s: Scene, origin, normal):
    """True if the face through local `origin` with outward local `normal` faces the camera.
    (Plane.visible() in core returns the opposite for planes with u right / v up.)"""
    return dot(s.Wv(normal), sub(s.cam.pos, s.W(origin))) > 0


def stack_r(y):
    return 3.6 - 0.5 * y / STACK_H


def ring_halves(s: Scene, cx, cz, r, y, n=12):
    """A horizontal ring split into the half away from the camera and the half towards it."""
    c = s.W((cx, y, cz))
    to_cam = sub(s.cam.pos, c)
    phi = max(
        (2 * math.pi * i / 72 for i in range(72)),
        key=lambda t: dot(sub(s.W((cx + math.cos(t), y, cz + math.sin(t))), c), to_cam),
    )
    arc = lambda a0: [
        (cx + r * math.cos(a0 + math.pi * i / n), y, cz + r * math.sin(a0 + math.pi * i / n)) for i in range(n + 1)
    ]
    return arc(phi + math.pi / 2), arc(phi - math.pi / 2)


def stack_unit(s: Scene):
    """Both stacks, their platforms and the steel frame, as one object ordered back to front,
    bottom to top with prio (painter depth alone gets tall members against round stacks wrong)."""
    with s.group(anchor=((FX0 + FX1) / 2, 0, (FZ0 + FZ1) / 2)):
        # one shadow per whole stack (the stack is drawn in segments with their shadows off)
        for x, z in STACKS:
            pts = []
            for y in (0, STACK_H):
                r = stack_r(y)
                pts += [
                    s.W((x + r * math.cos(t / 8 * math.pi), y, z + r * math.sin(t / 8 * math.pi))) for t in range(16)
                ]
            s._cast_shadow(pts, ground_y=s.W((0, 0, 0))[1])
        s._cast_shadow(
            [
                s.W(p)
                for p in (
                    (FX0, 0, FZ0),
                    (FX1, 0, FZ0),
                    (FX1, 0, FZ1),
                    (FX0, 0, FZ1),
                    (FX0, 48, FZ0),
                    (FX1, 48, FZ0),
                    (FX1, 48, FZ1),
                    (FX0, 48, FZ1),
                )
            ],
            ground_y=s.W((0, 0, 0))[1],
        )

        right_near = faces_camera(s, (FX1, 0, 10), (1, 0, 0))
        cols_x = (FX0, 26, FX1)
        beam_levels = (16, 30, 48)

        def member(pts, prio, r=0.45):
            s.tube(pts, r, FRAME, prio=prio)

        # prio 0: back columns, back beams, the far side of the frame
        far_x = FX0 if right_near else FX1
        near_x = FX1 if right_near else FX0
        for x in cols_x:
            member([(x, 0, FZ1), (x, 48, FZ1)], 0)
        for y in beam_levels:
            member([(FX0, y, FZ1), (FX1, y, FZ1)], 0)
            member([(far_x, y, FZ0), (far_x, y, FZ1)], 0)

        # stack segments and platforms, bottom to top
        bounds = (0,) + LEVELS + (STACK_H,)
        prio = 1
        for k in range(len(bounds) - 1):
            y0, y1 = bounds[k], bounds[k + 1]
            top = k == len(bounds) - 2
            for x, z in STACKS:
                prof = [(stack_r(y0), 0), (stack_r(y1), y1 - y0)]
                bands = [(y1 - y0 - 9.5, y1 - y0 - 6.5, P.red), (y1 - y0 - 4, y1 - y0, P.red)] if top else None
                s.lathe(
                    (x, y0, z),
                    prof,
                    STACK,
                    top="open" if top else "closed",
                    inner="#4a5560",
                    shadow=False,
                    prio=prio,
                    bands=bands,
                )
            prio += 1
            if top:
                break
            yl = bounds[k + 1]
            if yl == LEVELS[0]:
                # round platforms with railings around each stack
                for x, z in STACKS:
                    s.lathe(
                        (x, yl - 0.6, z), [(5.4, 0), (5.4, 0.6)], DECK, cap=DECK, shadow=False, prio=prio, segments=32
                    )
                for x, z in STACKS:
                    back, front = ring_halves(s, x, z, 5.2, yl + 1.1)
                    s.tube(back, 0.2, FRAME, prio=prio + 1)
                    s.tube(front, 0.2, FRAME, prio=prio + 3)
            else:
                # frame-top deck spanning both stacks
                s.box(
                    ((FX0 + FX1) / 2, yl - 0.7, (FZ0 + FZ1) / 2),
                    (FX1 - FX0 + 1.2, 0.7, FZ1 - FZ0 + 1.2),
                    DECK,
                    colors={"top": DECK},
                    shadow=False,
                    prio=prio,
                )
                rail = yl + 1.1
                e0, e1, f0, f1 = FX0 - 0.5, FX1 + 0.5, FZ0 - 0.5, FZ1 + 0.5
                s.tube([(e0, rail, f1), (e1, rail, f1)], 0.2, FRAME, prio=prio + 1)
                s.tube(
                    [
                        (far_x + (-0.5 if far_x == FX0 else 0.5), rail, f0),
                        (far_x + (-0.5 if far_x == FX0 else 0.5), rail, f1),
                    ],
                    0.2,
                    FRAME,
                    prio=prio + 1,
                )
                s.tube([(e0, rail, f0), (e1, rail, f0)], 0.2, FRAME, prio=prio + 3)
                s.tube(
                    [
                        (near_x + (0.5 if near_x == FX1 else -0.5), rail, f0),
                        (near_x + (0.5 if near_x == FX1 else -0.5), rail, f1),
                    ],
                    0.2,
                    FRAME,
                    prio=prio + 3,
                )
            prio += 2

        # last: front columns, front beams, the near side with its bracing, the pipe down the side
        top = prio + 2
        for x in cols_x:
            member([(x, 0, FZ0), (x, 48, FZ0)], top)
        for y in beam_levels:
            member([(FX0, y, FZ0), (FX1, y, FZ0)], top)
            member([(near_x, y, FZ0), (near_x, y, FZ1)], top)
        for y0, y1 in ((0, 16), (16, 30)):
            member([(near_x, y0, FZ0), (near_x, y1, FZ1)], top, r=0.3)
            member([(near_x, y0, FZ1), (near_x, y1, FZ0)], top, r=0.3)
        s.tube([(36.5, 36, 10), (45, 36, 10), (45, 0.6, 10)], 1.0, P.orange, prio=top)

    for i, (x, z) in enumerate(STACKS):
        fx.steam(s, (x, STACK_H + 1, z), size=2.6, n=4, period=14, rise=22, wind=9, seed=7 + i)


def build(s: Scene):
    # boiler (HRSG) block behind, left of the stacks
    with s.group(anchor=(-1, 0, 12)):
        s.lathe((-1, 0, 12), capsule_profile(4.8, 46, 4.5), VESSEL, bands=[(38, 39.2, P.steel)])
    with s.group(anchor=(7.5, 0, 6)):
        s.lathe((7.5, 0, 6), capsule_profile(4.0, 36, 3.6), VESSEL, bands=[(29, 30, P.steel)])
    with s.group(anchor=(-16, 0, 6)):
        s.box((-16, 0, 6), (20, 32, 18), P.concrete, colors={"top": P.roof})
        s.box((-16, 32, 6), (12, 3, 10), P.steel, shadow=False, prio=1)  # roof plant
        if faces_camera(s, (-16, 0, -3), (0, 0, -1)):
            f = s.plane((-26, 0, -3.02), (1, 0, 0), (0, 1, 0))
            f.rect(0, 21, 20, 1.2, P.red, prio=2)  # the thin orange band on the banner
            for i in range(3):
                f.rect(2.5 + i * 6, 25, 3.5, 3.5, P.window, prio=2)
        if faces_camera(s, (-6, 0, 6), (1, 0, 0)):
            f = s.plane((-5.98, 0, -3), (0, 0, 1), (0, 1, 0))
            f.rect(0, 21, 18, 1.2, P.red, prio=2)

    stack_unit(s)

    # low annex on the left with a roof railing and a grey pipe bridge in front
    with s.group(anchor=(-27, 0, -14)):
        s.box((-27, 0, -14), (34, 9, 16), P.white, colors={"top": P.roof})
        if faces_camera(s, (-27, 0, -22), (0, 0, -1)):
            f = s.plane((-44, 0, -22.02), (1, 0, 0), (0, 1, 0))
            for i in range(5):
                f.rect(3 + i * 6, 5, 4.2, 2.4, P.window, prio=2)
            f.rect(24, 0, 5, 3.6, P.steel_dark, prio=2)
        r = 10.1
        s.tube(
            [(-43.6, r, -21.6), (-10.4, r, -21.6), (-10.4, r, -6.4), (-43.6, r, -6.4), (-43.6, r, -21.6)],
            0.14,
            FRAME,
            prio=2,
        )
        s.tube([(-42, 0.4, -25), (-42, 5, -25), (-22, 5, -25), (-22, 0.4, -25)], 0.7, PIPE_GREY, prio=3)
        s.tube([(-40, 0.4, -26.6), (-40, 3.6, -26.6), (-24, 3.6, -26.6), (-24, 0.4, -26.6)], 0.5, PIPE_GREY, prio=3)

    # turbine hall in front
    hx0, hx1, hz0, hz1, hh = -8, 43, -26, -6, 16
    with s.group(anchor=((hx0 + hx1) / 2, 0, (hz0 + hz1) / 2)):
        s.box(((hx0 + hx1) / 2, 0, (hz0 + hz1) / 2), (hx1 - hx0, hh, hz1 - hz0), P.white, colors={"top": P.roof})
        s.box((30, hh, -16), (8, 2.4, 6), P.steel, shadow=False, prio=1)  # roof plant
        if faces_camera(s, (0, 0, hz0), (0, 0, -1)):
            f = s.plane((hx0, 0, hz0 - 0.02), (1, 0, 0), (0, 1, 0))
            for i in range(9):
                f.rect(2.5 + i * 4.4, 9.5, 3.2, 3, P.window, prio=2)
            f.rect(42, 9.5, 6.5, 3, P.window, prio=2)
            f.rect(hx1 - hx0 - 12, 0, 8, 7, P.steel_dark, prio=2)  # big door
            f.rect(4, 0, 2.6, 4.2, P.steel_dark, prio=2)
            f.rect(10, 1.6, 6, 3.2, P.window, prio=2)
            f.rect(18, 1.6, 6, 3.2, P.window, prio=2)
            f.rect(0, hh - 1.4, hx1 - hx0, 1.4, mix(P.white, P.roof, 0.5), prio=2)  # parapet line
        if faces_camera(s, (hx1, 0, -16), (1, 0, 0)):
            f = s.plane((hx1 + 0.02, 0, hz0), (0, 0, 1), (0, 1, 0))
            for i in range(4):
                f.rect(2 + i * 4.6, 9.5, 3, 3, P.window, prio=2)
            f.rect(0, hh - 1.4, hz1 - hz0, 1.4, mix(P.white, P.roof, 0.5), prio=2)
        if faces_camera(s, (hx0, 0, -16), (-1, 0, 0)):
            f = s.plane((hx0 - 0.02, 0, hz1), (0, 0, -1), (0, 1, 0))
            for i in range(4):
                f.rect(2 + i * 4.6, 9.5, 3, 3, P.window, prio=2)

    # the signature orange pipe: out of the boiler block, over the hall roof, down its front
    with s.group(anchor=(24, 0, -29)):
        s.tube([(-6, 24, 0), (24, 24, 0), (24, 24, -28.4), (24, 0.6, -28.4)], 1.1, P.orange)
    # a second, smaller run from the vessels down into the hall roof
    with s.group(anchor=(7.5, 0, -2)):
        s.tube([(7.5, 30, 6), (7.5, 30, -2), (7.5, 16.2, -2), (7.5, 16.2, -10)], 0.8, PIPE_GREY)
