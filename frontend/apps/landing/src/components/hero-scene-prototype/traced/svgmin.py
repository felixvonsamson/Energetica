"""PROTOTYPE (issue #1440): shrinks vtracer path data.

vtracer writes absolute coordinates with a decimal and a separate translate() per path.
This folds the translate into the coordinates, rounds to whole banner pixels, switches to
relative commands and drops redundant separators. Roughly halves the SVG.
"""

import re

PATH_RE = re.compile(r'<path d="([^"]*)" fill="(#[0-9A-Fa-f]{6})" transform="translate\((-?[\d.]+),(-?[\d.]+)\)"/>')
TOKEN_RE = re.compile(r"[MLCZ]|-?\d+(?:\.\d+)?")


def _num(v: int, prev: str) -> str:
    s = str(v)
    if prev and prev[-1].isdigit() and not s.startswith("-"):
        return " " + s
    return s


def _flat(x0: float, y0: float, pts: list[tuple[int, int]], tol: float = 0.8) -> bool:
    """True when a cubic's control points sit on its chord, so a line draws the same."""
    (ax, ay), (bx, by), (x1, y1) = pts
    dx, dy = x1 - x0, y1 - y0
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        return max(abs(ax - x0), abs(ay - y0), abs(bx - x0), abs(by - y0)) <= tol
    return all(abs((px - x0) * dy - (py - y0) * dx) / length <= tol for px, py in ((ax, ay), (bx, by)))


def minify_d(d: str, tx: float, ty: float) -> str:
    tokens = TOKEN_RE.findall(d)
    out: list[str] = []
    cx = cy = 0  # current point (rounded)
    sx = sy = 0  # subpath start
    i = 0
    last_cmd = ""
    while i < len(tokens):
        t = tokens[i]
        i += 1
        if t == "Z":
            out.append("z")
            cx, cy = sx, sy
            last_cmd = "z"
            continue
        n = {"M": 2, "L": 2, "C": 6}[t]
        vals = [float(v) for v in tokens[i : i + n]]
        i += n
        pts = [(round(vals[k] + tx), round(vals[k + 1] + ty)) for k in range(0, n, 2)]
        if t == "M":
            # Absolute moves keep subpaths independent of rounding drift.
            x, y = pts[0]
            out.append("M" + _num(x, "") + _num(y, str(x)))
            cx, cy = sx, sy = x, y
            last_cmd = "M"
            continue
        if t == "C" and _flat(cx, cy, pts):
            t, pts = "L", pts[-1:]
        rel = [(x - cx, y - cy) for x, y in pts]
        if all(p == (0, 0) for p in rel):
            continue
        cmd = t.lower()
        buf = "" if cmd == last_cmd else cmd
        for x, y in rel:
            buf += _num(x, buf if buf else (out[-1] if out else ""))
            buf += _num(y, buf)
        out.append(buf)
        cx, cy = pts[-1]
        last_cmd = cmd
    return "".join(out)


def minify_paths(svg: str) -> list[tuple[str, str]]:
    """Returns (fill, d) for each vtracer path, in drawing order."""
    result = []
    for d, fill, tx, ty in PATH_RE.findall(svg):
        md = minify_d(d, float(tx), float(ty))
        if md.count("c") + md.count("l") == 0 and len(md) < 12:
            continue
        result.append((fill.lower(), md))
    return result
