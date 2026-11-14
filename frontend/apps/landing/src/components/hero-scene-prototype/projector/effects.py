# ruff: noqa
"""PROTOTYPE (issue #1440): shared billboards and ambient effects (steam, clouds, trees, bushes).

Billboards always face the camera and scale with depth. Their art is in world units (metres)
with y up. Animated parts use the classes in hero-scene.prototype.css (steam, drift, flow).
"""

import math
import random

from core import Scene, fmt
import palette as P


def _blob(circles, fill):
    return "".join(f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(r)}" fill="{fill}"/>' for x, y, r in circles)


def steam(
    s: Scene,
    at,
    size=20.0,
    n=6,
    period=11.0,
    rise=None,
    wind=None,
    seed=0,
    prio=3,
    plume=False,
    behind=None,
    spread=None,
    lift=0.6,
):
    """Rising, fading puffs from a stack mouth at local point `at`. size = puff radius at birth.
    rise / wind: how far a puff travels up / sideways over its life (world units).
    plume=True: a dense, continuous cooling-tower plume (the puffs stay opaque longer and grow
    more), plus a static plume that is only shown with prefers-reduced-motion."""
    rnd = random.Random(seed)
    rise = rise if rise is not None else size * 7
    wind = wind if wind is not None else size * 3
    cls = "steam steam-plume" if plume else "steam"

    spread = spread if spread is not None else (0.75 if plume else 0.35)

    def draw(tone):
        # Two passes with identical timing: every puff's shaded body first, then every puff's
        # lit cap, so overlapping puffs merge into one cloud instead of showing each rim.
        shade, lit = [], []
        for i in range(n):
            dx = rnd.uniform(-spread, spread) * size
            r = size * rnd.uniform(0.85, 1.2)
            cy = -size * lift
            # y is flipped back to "down" inside so the CSS keyframes rise upwards on screen;
            # the pivot is the puff's own centre, shared by both passes so they stay in sync
            style = (
                f"--period:{period}s;--delay:{-period * i / n:.2f}s;--rise:{fmt(rise)}px;--wind:{fmt(wind)}px;"
                f"transform-box:view-box;transform-origin:{fmt(dx)}px {fmt(cy)}px"
            )
            shade.append(
                f'<circle class="{cls}" opacity="0" style="{style}" cx="{fmt(dx)}" cy="{fmt(cy)}" r="{fmt(r)}" fill="{tone(P.steam_shade, -0.2)}"/>'
            )
            lit.append(
                f'<circle class="{cls}" opacity="0" style="{style}" cx="{fmt(dx - r * 0.12)}" cy="{fmt(cy - r * 0.14)}" r="{fmt(r * 0.84)}" fill="{tone(P.steam, 0.4)}"/>'
            )
        return f'<g transform="scale(1,-1)">{"".join(shade)}{"".join(lit)}</g>'

    if plume:
        static_plume(s, at, size=size, height=rise * 0.55, lean=wind * 0.55, behind=behind)
    s.billboard(at, draw, prio=prio, bounds=(-size * 1.5, -size, wind + size * 3, rise + size * 3), behind=behind)


def static_plume(s: Scene, at, size=20.0, height=None, lean=None, prio=2, behind=None):
    """A static plume body, shown only with prefers-reduced-motion (class steam-static)."""
    height = height or size * 4
    lean = lean if lean is not None else size * 1.6

    def draw(tone):
        cs = []
        rnd = random.Random(int(size * 10))
        for i in range(10):
            t = i / 9
            r = size * (0.75 + 1.0 * t) * rnd.uniform(0.9, 1.1)
            cs.append((lean * t * t + rnd.uniform(-0.15, 0.15) * size, size * 0.3 + height * t, r))
        shade = _blob(cs, tone(P.steam_shade, -0.3))
        lit = _blob([(x - r * 0.1, y + r * 0.12, r * 0.86) for x, y, r in cs], tone(P.steam, 0.5))
        return f'<g class="steam-static" opacity="0.92">{shade}{lit}</g>'

    s.billboard(at, draw, prio=prio, bounds=(-size * 1.2, 0, lean + size * 2, height + size * 2.2), behind=behind)


def cloud(s: Scene, at, width=400.0, seed=0, drift=None, period=None):
    """Flat-bottomed cumulus. Puffy top, lit from the upper left."""
    rnd = random.Random(seed)
    k = width / 400

    def draw(tone):
        cs = [
            (-150 * k, 30 * k, 48 * k),
            (-75 * k, 62 * k, 72 * k),
            (25 * k, 82 * k, 88 * k),
            (115 * k, 52 * k, 62 * k),
            (170 * k, 26 * k, 40 * k),
        ]
        cs = [(x + rnd.uniform(-10, 10) * k, y + rnd.uniform(-8, 8) * k, r * rnd.uniform(0.9, 1.1)) for x, y, r in cs]
        clip = f'<rect x="{fmt(-260 * k)}" y="0" width="{fmt(520 * k)}" height="{fmt(260 * k)}"/>'
        cid = s.uid("cl")
        body = _blob(cs, tone(P.cloud_shade, -0.1))
        lit = _blob([(x - r * 0.12, y + r * 0.14, r * 0.86) for x, y, r in cs], tone(P.cloud, 0.6))
        inner = f'<clipPath id="{cid}">{clip}</clipPath><g clip-path="url(#{cid})">{body}{lit}</g>'
        if drift:
            return f'<g class="drift" style="--drift:{fmt(drift)}px;--period:{period or 140}s">{inner}</g>'
        return inner

    s.billboard(at, draw, bounds=(-260 * k, 0, 260 * k, 175 * k))


def tree(s: Scene, at, h=12.0, seed=0, color=None, prio=0):
    """Round deciduous tree: trunk and two-tone crown."""
    rnd = random.Random(seed)
    color = color or P.tree

    def draw(tone):
        r = h * 0.36
        cs = [(0, h - r, r), (-r * 0.55, h - r * 1.45, r * 0.7), (r * 0.6, h - r * 1.35, r * 0.72)]
        cs = [(x + rnd.uniform(-0.08, 0.08) * h, y, rr * rnd.uniform(0.9, 1.08)) for x, y, rr in cs]
        trunk = f'<rect x="{fmt(-h * 0.04)}" y="0" width="{fmt(h * 0.08)}" height="{fmt(h * 0.45)}" fill="{tone(P.trunk, -0.2)}"/>'
        dark = _blob(cs, tone(color, -0.5))
        lit = _blob([(x - rr * 0.18, y + rr * 0.16, rr * 0.78) for x, y, rr in cs], tone(color, 0.35))
        return trunk + dark + lit

    s.billboard(at, draw, prio=prio, bounds=(-h * 0.45, 0, h * 0.45, h))


def conifer(s: Scene, at, h=14.0, color=None, prio=0):
    """Narrow fir: two-tone triangle stack (lit left half, shaded right half)."""
    color = color or P.conifer

    def draw(tone):
        w = h * 0.36
        out = f'<rect x="{fmt(-h * 0.03)}" y="0" width="{fmt(h * 0.06)}" height="{fmt(h * 0.2)}" fill="{tone(P.trunk, -0.3)}"/>'
        for i, (y0, y1, ww) in enumerate(
            ((h * 0.12, h * 0.62, w), (h * 0.38, h * 0.85, w * 0.75), (h * 0.62, h, w * 0.5))
        ):
            out += f'<path d="M{fmt(-ww)},{fmt(y0)}L0,{fmt(y1)}L0,{fmt(y0)}Z" fill="{tone(color, 0.3)}"/>'
            out += f'<path d="M0,{fmt(y0)}L0,{fmt(y1)}L{fmt(ww)},{fmt(y0)}Z" fill="{tone(color, -0.45)}"/>'
        return out

    s.billboard(at, draw, prio=prio, bounds=(-h * 0.36, 0, h * 0.36, h))


def bush(s: Scene, at, w=6.0, seed=0, color=None, prio=0):
    rnd = random.Random(seed)
    color = color or P.tree

    def draw(tone):
        cs = [(-w * 0.3, w * 0.22, w * 0.3), (0, w * 0.32, w * 0.36), (w * 0.32, w * 0.2, w * 0.28)]
        cs = [(x, y, r * rnd.uniform(0.85, 1.1)) for x, y, r in cs]
        return _blob(cs, tone(color, -0.45)) + _blob(
            [(x - r * 0.15, y + r * 0.15, r * 0.75) for x, y, r in cs], tone(color, 0.3)
        )

    s.billboard(at, draw, prio=prio)
