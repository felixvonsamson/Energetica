# Throwaway prototype script: type annotations add nothing here.
# ruff: noqa: ANN001, ANN201, ANN202
"""PROTOTYPE: generates hero-scene.prototype.svg, a layered vector redraw of the landing banner.

Throwaway code for the hero-image go/no-go. Coordinates are in the original banner's pixel
space (2167 x 725) and were read off gridded crops of energetica_landing_banner.webp.

Each depth band is a <g class="layer" style="--d:…">. --d is how far the band sits from the
viewer: 0 = attached to the card, 1 = at infinity. The React wrapper turns scroll into a
vertical offset proportional to --d (a window moving past a distant scene).

Element classes (styling lives in the React component, so variants are pure CSS):
  land    terrain (hills, ground, mountains)
  (none)  a structure: building, tower, vehicle
  shade   a darker sub-surface: panel faces, fan wells, windows, the mine pit
  detail  a line only, never filled
  sky / cloud / water / steam  self-explanatory
Overlapping blobs (clouds, tree crowns) are drawn twice: an outline pass (class "o") then a
fill-only pass (class "f") on top, so only the outer silhouette keeps a stroke.

run: python3 generate_scene.py   (writes the .svg next to this file)
"""

import math
import random
from pathlib import Path

W, H = 2167, 725
random.seed(7)


def fmt(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def pts(points):
    return " ".join(f"{fmt(x)},{fmt(y)}" for x, y in points)


def poly(points, cls=""):
    return f'<polygon class="{cls}" points="{pts(points)}"/>'


def line(points, cls="detail"):
    return f'<polyline class="{cls}" points="{pts(points)}"/>'


def path(d, cls=""):
    return f'<path class="{cls}" d="{d}"/>'


def rect(x0, y0, x1, y1, cls=""):
    return f'<rect class="{cls}" x="{fmt(x0)}" y="{fmt(y0)}" width="{fmt(x1 - x0)}" height="{fmt(y1 - y0)}"/>'


def circle(cx, cy, r, cls=""):
    return f'<circle class="{cls}" cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}"/>'


def merged(shapes, extra=""):
    """Outline pass then fill pass, so overlapping shapes read as one silhouette."""
    o = "".join(s.replace('class="', f'class="o {extra} ', 1) for s in shapes)
    f = "".join(s.replace('class="', f'class="f {extra} ', 1) for s in shapes)
    return o + f


def lerp_y(base, x):
    for (x0, y0), (x1, y1) in zip(base, base[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return base[-1][1]


def treeline(base, h, step):
    """Jagged conifer-top silhouette above a base polyline, closed down to y=H+80."""
    x0, x1 = base[0][0], base[-1][0]
    out = [(x0, lerp_y(base, x0) + 2)]
    x = x0
    while x < x1:
        y = lerp_y(base, x)
        th = h * (0.6 + 0.6 * random.random())
        out += [(x + step * 0.5, y - th), (x + step, y - th * 0.25)]
        x += step
    out += [(x1, H + 80), (x0, H + 80)]
    return poly(out, "land forest")


def tree(x, y, r):
    return [line([(x, y), (x, y - r * 0.9)], "detail trunk"), circle(x, y - r * 1.4, r, "tree")]


def cloud(circles, base):
    xs = [c[0] - c[2] for c in circles] + [c[0] + c[2] for c in circles]
    shapes = [circle(*c, "cloud") for c in circles]
    shapes.append(rect(min(xs) + 10, base - 18, max(xs) - 10, base, "cloud"))
    return merged(shapes)


def turbine(hx, hy, bx, by, blade, spin, phase):
    k = blade / 95
    tower = poly([(hx - 2.5 * k, hy), (hx + 2.5 * k, hy), (bx + 5 * k, by), (bx - 5 * k, by)])
    nacelle = rect(hx - 4 * k, hy - 5 * k, hx + 16 * k, hy + 5 * k)
    blades = []
    for i in range(3):
        a = math.radians(phase + 120 * i)
        ca, sa = math.cos(a), math.sin(a)

        def rot(u, v):
            return (hx + u * ca - v * sa, hy + u * sa + v * ca)

        blades.append(
            poly(
                [
                    rot(4 * k, -3 * k),
                    rot(blade * 0.3, -6 * k),
                    rot(blade, -1.2 * k),
                    rot(blade, 1.2 * k),
                    rot(4 * k, 3 * k),
                ]
            )
        )
    hub = circle(hx, hy, 5 * k)
    rotor = (
        f'<g class="rotor" style="transform-origin:{fmt(hx)}px {fmt(hy)}px;animation-duration:{spin}s">'
        + "".join(blades)
        + "</g>"
    )
    return tower + nacelle + rotor + hub


def cooling_tower(top_l, top_r, top_y, base_l, base_r, base_y, waist_in):
    mid_y = top_y + (base_y - top_y) * 0.55
    d = (
        f"M{top_l},{top_y} Q{top_l + waist_in},{mid_y} {base_l},{base_y} "
        f"L{base_r},{base_y} Q{top_r - waist_in},{mid_y} {top_r},{top_y} Z"
    )
    cx = (top_l + top_r) / 2
    rim = f'<ellipse class="detail" cx="{fmt(cx)}" cy="{top_y}" rx="{fmt((top_r - top_l) / 2)}" ry="5"/>'
    shading = line([(cx + 8, top_y + 5), (cx + 4 + waist_in * 0.2, mid_y), (cx + 18, base_y)])
    return path(d) + rim + shading


def steam(x, y, n, spread, seed):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        r = 18 + rnd.random() * 18
        cx = x + rnd.uniform(-spread, spread)
        out.append(
            f'<circle class="steam" cx="{fmt(cx)}" cy="{fmt(y)}" r="{fmt(r)}" '
            f'style="animation-delay:-{fmt(i * 9 / n)}s"/>'
        )
    return "".join(out)


def solar_field():
    out = []
    rows = [  # back row first: top-left corner of the row, scale, table count
        ((1310, 535), 0.72, 4),
        ((1212, 558), 0.85, 4),
        ((1108, 587), 1.0, 4),
    ]
    for (ox, oy), s, n in rows:
        a = (196 * s, 18 * s)
        b = (-61 * s, 50 * s)
        for c in range(n):
            x0, y0 = ox + c * a[0] * 1.13, oy + c * a[1] * 1.13
            p = [(x0, y0), (x0 + a[0], y0 + a[1]), (x0 + a[0] + b[0], y0 + a[1] + b[1]), (x0 + b[0], y0 + b[1])]
            # legs under the low edge
            for t in (0.2, 0.8):
                lx, ly = x0 + b[0] + a[0] * t, y0 + b[1] + a[1] * t
                out.append(line([(lx + 6 * s, ly - 6 * s), (lx + 8 * s, ly + 22 * s)]))
            out.append(poly(p, "shade panel"))
            for i in range(1, 6):
                t = i / 6
                out.append(
                    line([(x0 + a[0] * t, y0 + a[1] * t), (x0 + a[0] * t + b[0], y0 + a[1] * t + b[1])], "detail cell")
                )
            for j in (1, 2):
                t = j / 3
                out.append(
                    line([(x0 + b[0] * t, y0 + b[1] * t), (x0 + a[0] + b[0] * t, y0 + a[1] + b[1] * t)], "detail cell")
                )
    return "".join(out)


def battery_yard():
    out = []
    for r in range(3):  # back to front
        w, h = 46 + r * 4, 70 + r * 7
        x0, ytop = 448 + r * 40, 568 + r * 17
        for i in range(6):
            x = x0 + i * (w + 5)
            out.append(poly([(x, ytop), (x + 8, ytop - 7), (x + w + 8, ytop - 7), (x + w, ytop)]))
            out.append(rect(x, ytop, x + w, ytop + h))
            cx, cy = x + w / 2, ytop + h * 0.45
            out.append(line([(cx + 3, cy - 12), (cx - 4, cy + 1), (cx + 4, cy - 1), (cx - 3, cy + 12)], "detail bolt"))
    return "".join(out)


def dry_cooler():
    out = []
    x0, x1, y0, y1, leg_y = 1727, 2121, 398, 515, 563
    legs = [1732, 1790, 1852, 1915, 1978, 2048, 2116]
    for a, b in zip(legs, legs[1:]):
        out.append(line([(a, y1), (b, leg_y)]) + line([(b, y1), (a, leg_y)]))
    for lx in legs:
        out.append(rect(lx - 3, y1, lx + 3, leg_y))
    out.append(poly([(x0, y0), (x0 + 6, y0 - 6), (x1 + 6, y0 - 6), (x1, y0)]))
    out.append(rect(x0, y0, x1, y1))
    for dx in (1786, 1848, 1911, 1975, 2050):
        out.append(line([(dx, y0), (dx, y1)]))
    out.append(line([(x0, 458), (2050, 458)]))
    out.append(line([(2085, y0 + 4), (2085, y1)]) + line([(2096, y0 + 4), (2096, y1)]))
    for cx in (1756, 1817, 1880, 1943, 2012):
        for cy in (429, 488):
            out.append(circle(cx, cy, 24, "shade"))
            blades = "".join(
                line([(cx, cy), (cx + 21 * math.cos(math.radians(a)), cy + 21 * math.sin(math.radians(a)))], "detail")
                for a in range(0, 360, 45)
            )
            out.append(f'<g class="fan" style="transform-origin:{cx}px {cy}px">{blades}</g>')
            out.append(circle(cx, cy, 4))
    return "".join(out)


def dam():
    out = []
    crest = lambda x: 300 + (x - 20) * 26 / 680  # noqa: E731
    out.append(poly([(20, 300), (140, 292), (700, 326), (700, 362), (480, 458), (190, 458), (20, 332)]))
    out.append(line([(20, 306), (140, 298), (700, 332)]))
    piers = [206, 249, 290, 331, 374, 433]
    for a, b in zip(piers, piers[1:]):
        ya, yb = crest(a) + 8, crest(b) + 8
        water = poly([(a + 5, ya), (b - 5, yb), (b + 20, 458), (a + 24, 458)], "water")
        out.append(water)
        for t in (0.35, 0.7):
            xt = a + (b - a) * t
            out.append(line([(xt, crest(xt) + 10), (xt + 21, 456)], "detail flow"))
    for p in piers:
        out.append(poly([(p - 4, crest(p) - 6), (p + 4, crest(p) - 6), (p + 26, 458), (p + 14, 458)]))
    return "".join(out)


def nuclear():
    out = [
        cooling_tower(992, 1120, 172, 958, 1165, 412, 22),
        # chimney
        rect(1262, 135, 1284, 380),
        rect(1262, 148, 1284, 157, "shade"),
        rect(1262, 165, 1284, 174, "shade"),
        # reactor dome on its drum
        path("M1137,320 L1137,372 L1261,372 L1261,320 A62,62 0 0 0 1137,320 Z"),
        rect(1137, 316, 1261, 324, "shade"),
        path("M1199,258 Q1262,268 1255,372", "detail pipe"),
        cooling_tower(1314, 1436, 182, 1299, 1472, 412, 24),
        # turbine hall and annexes
        rect(1065, 362, 1202, 400),
        rect(1042, 397, 1202, 472),
        rect(1222, 365, 1380, 472),
        rect(1240, 375, 1275, 472, "shade"),
        line([(1150, 397), (1150, 472)]),
        line([(1300, 365), (1300, 472)]),
    ]
    return "".join(out)


def gas_plant():
    out = [
        rect(1525, 330, 1555, 445),
        path("M1525,330 A15,14 0 0 1 1555,330 Z"),
        rect(1560, 362, 1590, 445),
        path("M1560,362 A15,14 0 0 1 1590,362 Z"),
        line([(1585, 335), (1700, 335)]) + line([(1585, 380), (1700, 380)]) + line([(1585, 420), (1700, 420)]),
        line([(1690, 330), (1690, 505)]),
    ]
    for x0, x1, top in ((1597, 1621, 225), (1640, 1668, 233)):
        out += [
            rect(x0, top, x1, 505),
            rect(x0, top + 4, x1, top + 11, "shade"),
            rect(x0, top + 17, x1, top + 24, "shade"),
        ]
    out += [
        path("M1455,440 L1455,428 L1650,428 L1650,445", "detail pipe"),
        path("M1385,500 L1385,455 Q1385,445 1398,445", "detail pipe"),
        rect(1398, 438, 1478, 500),
        rect(1518, 444, 1630, 505),
        rect(1410, 448, 1465, 458, "shade"),
        rect(1530, 458, 1615, 468, "shade"),
        rect(1548, 480, 1570, 505, "shade"),
    ]
    return "".join(out)


def hydrogen():
    out = [
        path("M657,472 Q689,452 722,472 L722,545 L657,545 Z"),
        line([(657, 537), (722, 537)]),
        rect(889, 417, 906, 470),
        rect(918, 417, 936, 470),
        path("M785,462 A44,44 0 0 1 873,462 Z"),
        rect(785, 456, 873, 465, "shade"),
        rect(728, 467, 805, 556),
        rect(805, 470, 930, 558),
        rect(862, 480, 930, 558, "shade"),
        '<text class="label" x="752" y="525">H₂</text>',
        rect(870, 501, 1074, 566),
        line([(870, 509), (1074, 509)]),
        rect(909, 538, 925, 566, "shade"),
        rect(970, 530, 990, 545, "shade"),
        rect(1020, 530, 1040, 545, "shade"),
    ]
    return "".join(out)


def mine():
    out = [
        # spoil heap and the conveyor up to it
        rect(43, 413, 88, 461),
        rect(50, 420, 62, 432, "shade"),
        rect(68, 420, 80, 432, "shade"),
        line([(85, 448), (150, 412)]) + line([(88, 458), (150, 424)]),
        rect(145, 410, 191, 418),
        line([(150, 418), (150, 487)]) + line([(186, 418), (186, 487)]) + line([(150, 440), (186, 470)]),
        # tunnel portal and conveyor
        poly([(64, 533), (165, 533), (160, 546), (70, 546)]),
        poly([(70, 546), (82, 546), (110, 620), (96, 620)]),
        poly([(148, 546), (160, 546), (172, 610), (160, 610)]),
        rect(82, 548, 150, 615, "shade"),
        poly([(120, 565), (130, 558), (248, 622), (240, 630)]),
        path("M200,648 Q262,608 330,648 Z", "shade"),
        # hopper
        rect(326, 551, 407, 585),
        line([(335, 585), (348, 612)]) + line([(398, 585), (385, 612)]),
        # excavator
        poly([(284, 568), (295, 505), (306, 507), (298, 568)]),
        poly([(298, 503), (307, 503), (346, 546), (338, 551)]),
        poly([(334, 548), (350, 552), (346, 572), (330, 566)]),
        rect(224, 600, 290, 613),
        rect(230, 568, 290, 598),
        rect(265, 560, 292, 590),
        rect(270, 566, 286, 578, "shade"),
        # dump truck
        poly([(46, 614), (178, 610), (172, 660), (52, 660)]),
        rect(122, 628, 198, 672),
        rect(160, 634, 192, 650, "shade"),
        circle(75, 682, 13),
        circle(103, 682, 13),
        circle(176, 684, 13),
    ]
    return "".join(out)


def layer(name, depth, body):
    return f'<g class="layer {name}" style="--d:{depth}">{body}</g>'


sky = layer(
    "sky",
    1,
    rect(-40, -200, W + 40, H + 100, "sky")
    + f'<g class="drift">{cloud([(95, 205, 28), (140, 192, 38), (200, 205, 30), (245, 215, 22)], 228)}'
    + cloud([(1680, 180, 22), (1720, 168, 30), (1765, 182, 20)], 196)
    + cloud([(1860, 222, 25), (1905, 205, 35), (1960, 195, 38), (2015, 185, 40), (2075, 180, 48), (2130, 195, 38)], 235)
    + "</g>",
)

far = layer(
    "far",
    0.95,
    poly(
        [
            (-40, 230),
            (0, 215),
            (60, 205),
            (125, 203),
            (185, 222),
            (250, 250),
            (330, 268),
            (400, 262),
            (445, 270),
            (520, 282),
            (600, 288),
            (705, 270),
            (760, 280),
            (880, 262),
            (1010, 262),
            (1100, 258),
            (1170, 270),
            (1240, 268),
            (1330, 262),
            (1400, 275),
            (1480, 272),
            (1541, 262),
            (1610, 290),
            (1680, 285),
            (1745, 262),
            (1811, 271),
            (1880, 285),
            (1950, 272),
            (2050, 262),
            (W + 40, 268),
            (W + 40, H + 80),
            (-40, H + 80),
        ],
        "land",
    ),
)

mid = layer(
    "mid",
    0.88,
    poly(
        [
            (-40, 180),
            (0, 192),
            (100, 232),
            (200, 274),
            (305, 304),
            (400, 318),
            (520, 332),
            (520, H + 80),
            (-40, H + 80),
        ],
        "land",
    )
    + poly(
        [
            (640, 332),
            (720, 318),
            (790, 298),
            (870, 262),
            (950, 238),
            (1010, 252),
            (1060, 290),
            (1060, H + 80),
            (640, H + 80),
        ],
        "land",
    )
    + poly(
        [
            (1560, 332),
            (1650, 312),
            (1745, 282),
            (1800, 292),
            (1870, 276),
            (1948, 252),
            (2040, 226),
            (2116, 205),
            (W + 40, 235),
            (W + 40, H + 80),
            (1560, H + 80),
        ],
        "land",
    )
    + line([(2116, 205), (2060, 270), (2010, 330)])
    + line([(1948, 252), (1910, 300)]),
)

forest = layer(
    "forest",
    0.78,
    treeline([(-40, 300), (60, 302), (140, 330), (240, 380)], 20, 11)
    + treeline([(540, 410), (700, 350), (850, 335), (1000, 332)], 18, 10)
    + poly(
        [
            (1600, 400),
            (1700, 372),
            (1800, 340),
            (1900, 312),
            (2040, 288),
            (W + 40, 268),
            (W + 40, H + 80),
            (1600, H + 80),
        ],
        "land",
    )
    + treeline([(1690, 400), (1900, 360), (W + 40, 322)], 22, 13),
)

hills = layer(
    "hills",
    0.6,
    dam()
    + path(f"M440,470 Q600,392 760,366 Q880,346 1010,340 L1010,{H + 80} L440,{H + 80} Z", "land")
    + turbine(632, 287, 632, 399, 45, 9, 20)
    + turbine(937, 276, 939, 342, 30, 7, 75)
    + turbine(838, 246, 840, 380, 64, 11, 95)
    + turbine(733, 185, 739, 398, 95, 14, 60)
    + steam(1056, 158, 7, 45, 1)
    + steam(1375, 168, 6, 40, 2)
    + nuclear(),
)

plain_ground = poly(
    [
        (-40, 440),
        (60, 448),
        (150, 466),
        (300, 470),
        (480, 458),
        (620, 440),
        (800, 428),
        (1000, 445),
        (1300, 458),
        (1500, 455),
        (1700, 432),
        (1850, 405),
        (2000, 386),
        (W + 40, 370),
        (W + 40, H + 80),
        (-40, H + 80),
    ],
    "land",
)
river = poly([(290, 458), (470, 458), (482, 492), (465, 540), (430, 528), (402, 498), (300, 482)], "water")
plain = layer(
    "plain",
    0.35,
    plain_ground
    + river
    + line([(320, 470), (360, 471)], "detail ripple")
    + line([(400, 488), (440, 490)], "detail ripple")
    + line([(430, 512), (458, 516)], "detail ripple")
    + line([(560, 548), (700, 548), (1100, 568), (1450, 520), (1760, 505)], "detail road")
    + line([(1000, 470), (1160, 480), (1380, 505)], "detail road")
    + hydrogen()
    + gas_plant()
    + dry_cooler()
    + merged(
        sum(
            [
                tree(1035, 470, 12),
                tree(1135, 466, 14),
                tree(1195, 458, 10),
                tree(1245, 466, 12),
                tree(1290, 463, 8),
                tree(610, 518, 11),
                tree(1100, 548, 10),
                tree(2140, 445, 18),
                tree(2095, 520, 14),
            ],
            [],
        )
    ),
)

near = layer(
    "near",
    0,
    poly(
        [
            (400, 562),
            (700, 562),
            (1000, 580),
            (1300, 532),
            (1600, 525),
            (1900, 560),
            (W + 40, 545),
            (W + 40, H + 80),
            (400, H + 80),
        ],
        "land",
    )
    + poly(
        [
            (-40, 472),
            (110, 482),
            (205, 440),
            (300, 470),
            (440, 560),
            (470, 600),
            (430, 640),
            (470, H + 80),
            (-40, H + 80),
        ],
        "land shade pit",
    )
    + mine()
    + battery_yard()
    + solar_field()
    + merged(
        sum(
            [
                tree(965, 650, 26),
                tree(1700, 612, 16),
                tree(1965, 640, 22),
                tree(2040, 610, 16),
                tree(810, 705, 18),
                tree(1880, 700, 22),
                tree(2120, 690, 26),
            ],
            [],
        )
    ),
)

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" '
    f'aria-label="Energetica landscape: hydro dam, wind turbines, nuclear and gas plants, hydrogen, '
    f'dry cooler, solar field, batteries and a coal mine">' + sky + far + mid + forest + hills + plain + near + "</svg>"
)

out = Path(__file__).with_name("hero-scene.prototype.svg")
out.write_text(svg)
print(f"wrote {out} ({len(svg)} bytes)")
