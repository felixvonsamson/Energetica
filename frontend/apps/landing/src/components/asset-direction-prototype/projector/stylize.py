# ruff: noqa
"""PROTOTYPE (#1469): the open style questions (outlines, surface texture), applied as a pass
over a finished SVG so every facility module stays unchanged.

`px` is display pixels per viewBox unit at the size the SVG will be shown, so line widths,
grain and marker offsets are sized in screen pixels rather than scaling with the asset.

outline:
    none        no lines
    tinted      every face edged with a darker version of its own fill
    ink         every face edged with one warm dark ink
    silhouette  one ink contour round the whole asset only (a sticker edge), no inner lines
texture:
    flat        as rendered
    grain       a light film grain over the asset
    marker      loose marker fill: each face's colour is slightly offset and resized, so it
                over- and under-fills its crisp edges, with faint diagonal streaks. Implies ink lines.
"""

import random
import re

from core import mix

INK = "#2e2a26"
PAPER = "#f7f2e7"

_PATH = re.compile(r'<path d="([^"]+)" fill="(#[0-9a-f]{6}|url\(#[^)]+\))"([^/]*)/>')
_STOP = re.compile(r'<(linear|radial)Gradient id="([^"]+)"[^>]*>(.*?)</\1Gradient>')
_STOPC = re.compile(r'stop-color="(#[0-9a-f]{6})"')
_NUM = re.compile(r"-?\d+(?:\.\d+)?")


def _grad_mid(svg):
    out = {}
    for _, gid, body in _STOP.findall(svg):
        cs = _STOPC.findall(body)
        if cs:
            out[gid] = cs[len(cs) // 2]
    return out


def _base(fill, grads):
    if fill.startswith("#"):
        return fill
    return grads.get(fill[5:-1], "#888888")


def _bbox(d):
    nums = [float(v) for v in _NUM.findall(d)]
    xs, ys = nums[0::2], nums[1::2]
    if not xs:
        return 0, 0, 0, 0
    return min(xs), min(ys), max(xs), max(ys)


def stylize(svg, *, outline="none", texture="flat", px=1.0, seed=0, line_px=None):
    if texture == "marker" and outline in ("none", "silhouette"):
        outline = "ink"
    lw = line_px if line_px is not None else (0.6 if px < 0.25 else 1.0)  # screen px
    grads = _grad_mid(svg)
    rnd = random.Random(seed)
    defs = []

    def stroke_for(fill):
        if outline == "tinted":
            return mix(_base(fill, grads), INK, 0.55)
        return INK

    def edged(fill, rest):
        if outline in ("tinted", "ink") and "stroke=" not in rest and "opacity" not in rest:
            return (
                f' stroke="{stroke_for(fill)}" stroke-width="{lw}" stroke-linejoin="round"'
                f' vector-effect="non-scaling-stroke"{rest}'
            )
        return rest

    if texture == "marker":
        streak_w = 3.0 / px  # streak spacing ~3 screen px
        defs.append(
            f'<pattern id="mk-streak" patternUnits="userSpaceOnUse" width="{streak_w:.2f}" height="{streak_w:.2f}" '
            f'patternTransform="rotate(-28)"><rect width="{streak_w:.2f}" height="{streak_w * 0.45:.2f}" fill="#fff" opacity="0.22"/></pattern>'
        )

        def repl(m):
            d, fill, rest = m.group(1), m.group(2), m.group(3)
            if "opacity" in rest or "clip-path" in rest:  # cast shadows and glazes stay as they are
                return m.group(0)
            x0, y0, x1, y1 = _bbox(d)
            w, h = x1 - x0, y1 - y0
            if max(w, h) * px < 2.5:  # too small to show a misregistration: keep it crisp
                return f'<path d="{d}" fill="{fill}"{edged(fill, rest)}/>'
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            off = 1.4 / px  # up to ~1.4 screen px of misregistration
            dx, dy = rnd.uniform(-off, off), rnd.uniform(-off, off)
            k = 1 + rnd.uniform(-1.8, 1.4) / (max(w, h) * px)  # at most ~1.8 px bigger or smaller
            tf = f"translate({cx + dx:.2f},{cy + dy:.2f}) scale({k:.3f}) translate({-cx:.2f},{-cy:.2f})"
            base = _base(fill, grads)
            mfill = mix(base, "#ffffff", 0.08) if fill.startswith("#") else fill
            return (
                f'<path d="{d}" fill="{mix(base, PAPER, 0.75)}"/>'
                f'<g transform="{tf}"><path d="{d}" fill="{mfill}"/><path d="{d}" fill="url(#mk-streak)"/></g>'
                f'<path d="{d}" fill="none" stroke="{stroke_for(fill)}" stroke-width="{lw}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
            )

        svg = _PATH.sub(repl, svg)
    elif outline in ("tinted", "ink"):
        svg = _PATH.sub(lambda m: f'<path d="{m.group(1)}" fill="{m.group(2)}"{edged(m.group(2), m.group(3))}/>', svg)

    filters = []
    if outline == "silhouette":
        r = 1.6 / px
        defs.append(
            f'<filter id="sil" x="-5%" y="-5%" width="110%" height="110%">'
            f'<feMorphology in="SourceAlpha" operator="dilate" radius="{r:.2f}" result="d"/>'
            f'<feFlood flood-color="{INK}"/><feComposite in2="d" operator="in" result="o"/>'
            f'<feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
        )
        filters.append("sil")
    if texture == "grain":
        freq = px / 1.1  # grain cells about 1 screen px
        defs.append(
            f'<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
            f'<feTurbulence type="fractalNoise" baseFrequency="{freq:.3f}" numOctaves="2" seed="{seed}" result="n"/>'
            f'<feColorMatrix in="n" type="matrix" values="1.2 0 0 0 -0.1  1.2 0 0 0 -0.1  1.2 0 0 0 -0.1  0 0 0 0 0.16" result="g"/>'
            f'<feComposite in="g" in2="SourceAlpha" operator="in" result="gi"/>'
            f'<feBlend in="SourceGraphic" in2="gi" mode="overlay" result="b"/>'
            f'<feComposite in="b" in2="SourceAlpha" operator="in"/></filter>'
        )
        filters.append("grain")

    head, rest = svg.split("<defs>", 1)
    defs_body, body = rest.split("</defs>", 1)
    body = body[: -len("</svg>")]
    for f in filters:
        body = f'<g filter="url(#{f})">{body}</g>'
    return f"{head}<defs>{defs_body}{''.join(defs)}</defs>{body}</svg>"
