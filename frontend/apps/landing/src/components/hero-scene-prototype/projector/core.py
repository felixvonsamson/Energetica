# Throwaway prototype code: type annotations and docstrings are kept light on purpose.
# ruff: noqa
"""PROTOTYPE (issue #1440): a tiny 3D-to-SVG projector for flat illustrated scenes.

Scenes are built from analytic primitives (boxes, convex polyhedra, surfaces of revolution,
planar decals, tubes, billboards, terrain curtains), projected through a pinhole camera and
painted back to front. No triangle meshes: every primitive emits a handful of clean SVG paths.

World axes: x right, y up, z away from the default camera (metres-ish). A primitive's
"front" faces -z, towards a camera at negative z.

Typical use (see facilities/*.py and hero.py):

    s = Scene(Camera.look_at(eye=(0, 30, -120), target=(0, 10, 0), f=1400, size=(900, 600)))
    with s.group(anchor=(0, 0, 0)):          # one sortable object
        s.box((0, 0, 0), (20, 10, 12), P.concrete)
        s.lathe((0, 10, 0), dome_profile(6, 6), P.dome, shading="radial")
    svg = s.to_svg()

Sorting: top-level items are painted far to near by camera depth of their anchor, ground
flats (roads, fields, shadows) before standing things. Inside a group, parts are painted in
order of (prio, -depth); pass prio=1 to force a part on top of its siblings, or
group(sort=False) to keep insertion order.
"""

from __future__ import annotations

import math
from contextlib import contextmanager
from dataclasses import dataclass, field

# ---------------------------------------------------------------- vector maths


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def length(a):
    return math.sqrt(dot(a, a))


def norm(a):
    n = length(a) or 1.0
    return (a[0] / n, a[1] / n, a[2] / n)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def newell(points):
    """Normal of a planar polygon (counter-clockwise seen from the front = normal towards you)."""
    nx = ny = nz = 0.0
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        nx += (p[1] - q[1]) * (p[2] + q[2])
        ny += (p[2] - q[2]) * (p[0] + q[0])
        nz += (p[0] - q[0]) * (p[1] + q[1])
    return norm((nx, ny, nz))


def centroid(points):
    n = len(points)
    return (sum(p[0] for p in points) / n, sum(p[1] for p in points) / n, sum(p[2] for p in points) / n)


def hull2d(points):
    """Convex hull (monotone chain) of 2D points."""
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def turn(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and turn(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and turn(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


# ---------------------------------------------------------------- colour


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def rgb2hex(c):
    return "#" + "".join(f"{max(0, min(255, round(v * 255))):02x}" for v in c)


def mix(a, b, t):
    """Mix two hex colours, t=0 gives a, t=1 gives b."""
    return rgb2hex(lerp(hex2rgb(a), hex2rgb(b), max(0.0, min(1.0, t))))


@dataclass
class Look:
    """Global style knobs. Shared by every primitive in a scene."""

    sun: tuple = norm((-0.62, 0.68, -0.40))  # direction TO the sun: upper left, slightly in front
    light_tint: str = "#fff4dc"  # lit faces drift towards this (warm)
    shadow_tint: str = "#34466b"  # faces away from the sun drift towards this (cool)
    light_amount: float = 0.20
    shadow_amount: float = 0.42
    haze: str = "#cfe6ee"  # atmospheric perspective target
    haze_max: float = 0.0  # 0 disables fog (gallery); the hero sets ~0.75
    haze_dist: float = 2500.0  # e-folding distance of the haze, in camera depth units
    outline: float = 0.0  # >0: stroke every shape with a darker version of its fill (px)
    cast_shadows: bool = True
    shadow_color: str = "#1d3340"
    shadow_opacity: float = 0.22


def tone(look: Look, color: str, k: float, z: float | None = None) -> str:
    """Shade `color` for a surface whose normal makes cos=k with the sun (-1..1), then haze by depth z."""
    t = (max(-1.0, min(1.0, k)) + 1) / 2
    if t >= 0.5:
        c = mix(color, mix(color, look.light_tint, look.light_amount), (t - 0.5) * 2)
    else:
        c = mix(mix(color, look.shadow_tint, look.shadow_amount), color, t * 2)
    return haze(look, c, z)


def haze(look: Look, color: str, z: float | None) -> str:
    if z is None or look.haze_max <= 0:
        return color
    return mix(color, look.haze, look.haze_max * (1 - math.exp(-max(z, 0) / look.haze_dist)))


# ---------------------------------------------------------------- camera


@dataclass
class Camera:
    pos: tuple
    yaw: float  # degrees; 0 looks along +z, positive turns right (towards +x)
    pitch: float  # degrees; positive looks down
    f: float  # focal length in output pixels
    size: tuple  # (width, height) of the output in pixels
    center: tuple | None = None  # principal point; defaults to the image centre

    def __post_init__(self):
        self.cx, self.cy = self.center or (self.size[0] / 2, self.size[1] / 2)
        y, p = math.radians(self.yaw), math.radians(self.pitch)
        self._cy, self._sy, self._cp, self._sp = math.cos(y), math.sin(y), math.cos(p), math.sin(p)

    @classmethod
    def look_at(cls, eye, target, f, size, center=None):
        d = sub(target, eye)
        yaw = math.degrees(math.atan2(d[0], d[2]))
        pitch = math.degrees(math.atan2(-d[1], math.hypot(d[0], d[2])))
        return cls(eye, yaw, pitch, f, size, center)

    def to_cam(self, p):
        d = sub(p, self.pos)
        x = d[0] * self._cy - d[2] * self._sy
        z = d[0] * self._sy + d[2] * self._cy
        y = d[1]
        return (x, y * self._cp + z * self._sp, -y * self._sp + z * self._cp)

    def depth(self, p):
        return self.to_cam(p)[2]

    def project(self, p):
        x, y, z = self.to_cam(p)
        z = max(z, 1e-3)
        return (self.cx + self.f * x / z, self.cy - self.f * y / z)

    def ray(self, u, v):
        """World direction of the ray through output pixel (u, v)."""
        x, y, z = (u - self.cx) / self.f, -(v - self.cy) / self.f, 1.0
        y2, z2 = y * self._cp - z * self._sp, y * self._sp + z * self._cp
        return norm((x * self._cy + z2 * self._sy, y2, -x * self._sy + z2 * self._cy))

    def ground_at(self, u, v, y=0.0):
        """World point where the ray through pixel (u, v) meets the horizontal plane at height y."""
        r = self.ray(u, v)
        if r[1] >= -1e-9:
            raise ValueError(f"pixel ({u}, {v}) is above the horizon of plane y={y}")
        t = (y - self.pos[1]) / r[1]
        return add(self.pos, mul(r, t))

    def at_depth(self, u, v, z):
        """World point on the ray through (u, v) at camera depth z."""
        r = self.ray(u, v)
        t = z / dot(r, self.forward())
        return add(self.pos, mul(r, t))

    def forward(self):
        return self.ray(self.cx, self.cy)

    def px_per_unit(self, p):
        """Output pixels per world unit for something at point p (for sizing things to match a picture)."""
        return self.f / max(self.depth(p), 1e-3)


# ---------------------------------------------------------------- frames (local coordinates)


@dataclass
class Frame:
    origin: tuple = (0.0, 0.0, 0.0)
    yaw: float = 0.0  # degrees, rotation about +y (positive turns +z towards +x)
    scale: float = 1.0

    def point(self, p):
        a = math.radians(self.yaw)
        c, s = math.cos(a), math.sin(a)
        x, y, z = p[0] * self.scale, p[1] * self.scale, p[2] * self.scale
        return (self.origin[0] + x * c + z * s, self.origin[1] + y, self.origin[2] - x * s + z * c)

    def vector(self, v):
        a = math.radians(self.yaw)
        c, s = math.cos(a), math.sin(a)
        return (v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c)


# ---------------------------------------------------------------- scene


def fmt(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def path_d(pts2d, close=True):
    d = "M" + " ".join(f"{fmt(u)},{fmt(v)}" for u, v in pts2d)
    return d + ("Z" if close else "")


@dataclass
class _Part:
    prio: int
    z: float
    svg: str
    flat: bool


@dataclass
class _Group:
    anchor: tuple | None
    sort: bool
    flat: bool
    parts: list = field(default_factory=list)
    d_anchor: tuple | None = None


@dataclass
class Item:
    z: float  # painter key: camera depth (bigger = farther)
    flat: bool  # ground flats are painted before everything standing
    svg: str
    dz: float  # camera depth used for parallax


class Scene:
    def __init__(self, cam: Camera, look: Look | None = None, prefix="s"):
        self.cam = cam
        self.look = look or Look()
        self.prefix = prefix
        self.items: list[Item] = []
        self.defs: list[str] = []
        self._frames: list[Frame] = []
        self._groups: list[_Group] = []
        self._ids = 0
        self.bbox = [math.inf, math.inf, -math.inf, -math.inf]

    # ---- coordinates

    @contextmanager
    def frame(self, origin=(0, 0, 0), yaw=0.0, scale=1.0):
        """Everything inside is in local coordinates: origin, rotation about +y, uniform scale."""
        self._frames.append(Frame(origin, yaw, scale))
        try:
            yield
        finally:
            self._frames.pop()

    def W(self, p):
        """Local point -> world point."""
        for fr in reversed(self._frames):
            p = fr.point(p)
        return p

    def Wv(self, v):
        """Local direction -> world direction (unscaled)."""
        for fr in reversed(self._frames):
            v = fr.vector(v)
        return v

    def scale(self):
        k = 1.0
        for fr in self._frames:
            k *= fr.scale
        return k

    def P(self, p_world):
        u, v = self.cam.project(p_world)
        b = self.bbox
        b[0], b[1], b[2], b[3] = min(b[0], u), min(b[1], v), max(b[2], u), max(b[3], v)
        return (u, v)

    def uid(self, kind="g"):
        self._ids += 1
        return f"{self.prefix}-{kind}{self._ids}"

    # ---- colour helpers for authors

    def tone(self, color, normal_world=None, at_world=None, k=None):
        """Shaded + hazed colour. Give a world normal, or k directly (-1 shadow .. 1 lit)."""
        if k is None:
            k = dot(norm(normal_world), self.look.sun) if normal_world else 0.0
        z = self.cam.depth(at_world) if at_world is not None else None
        return tone(self.look, color, k, z)

    def haze(self, color, at_world):
        return haze(self.look, color, self.cam.depth(at_world))

    def _style(self, fill, extra=""):
        s = f'fill="{fill}"'
        if self.look.outline > 0 and fill.startswith("#"):
            s += f' stroke="{mix(fill, "#1b2733", 0.55)}" stroke-width="{self.look.outline}" stroke-linejoin="round" vector-effect="non-scaling-stroke"'
        return s + (" " + extra if extra else "")

    # ---- grouping and emission

    @contextmanager
    def group(self, anchor=(0, 0, 0), sort=True, flat=False, parallax_anchor=None):
        """Collect parts into one object painted as a unit, keyed by the camera depth of `anchor`
        (local coordinates). `parallax_anchor` (local) overrides the depth used for parallax."""
        g = _Group(self.W(anchor), sort, flat, d_anchor=self.W(parallax_anchor) if parallax_anchor else None)
        self._groups.append(g)
        try:
            yield g
        finally:
            self._groups.pop()
            parts = g.parts
            if sort:
                parts = sorted(parts, key=lambda p: (not p.flat, p.prio, -p.z))
            svg = "".join(p.svg for p in parts)
            if svg:
                self.emit(svg, g.anchor, flat=flat, dz_world=g.d_anchor)

    def emit(self, svg, at_world, flat=False, prio=0, dz_world=None):
        """Add raw SVG (already in output pixels), keyed by the camera depth of a world point."""
        z = self.cam.depth(at_world)
        if self._groups:
            self._groups[-1].parts.append(_Part(prio, z, svg, flat))
        else:
            dz = self.cam.depth(dz_world) if dz_world is not None else z
            self.items.append(Item(z, flat, svg, dz))

    def to_svg(
        self, *, viewbox=None, parallax=True, z_near=None, d_step=0.02, background=None, extra_defs="", fit="slice"
    ):
        """Serialize. With parallax=True, consecutive items with similar depth are wrapped in
        <g class="px" style="--d:…"> where --d = 1 - z_near/z (0 nearest, 1 infinitely far)."""
        items = sorted(self.items, key=lambda it: (not it.flat, -it.z))
        if viewbox is None:
            x0, y0, x1, y1 = self.bbox
            m = 0.04 * max(x1 - x0, y1 - y0)
            viewbox = (x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m)
        out = []
        if background:
            out.append(background)
        if parallax:
            zn = z_near or min(it.dz for it in items if it.dz > 0)
            cur, buf = None, []
            for it in items:
                d = 1.0 if math.isinf(it.dz) else max(0.0, 1 - zn / max(it.dz, zn))
                q = round(round(d / d_step) * d_step, 3)
                if q != cur and buf:
                    out.append(f'<g class="px" style="--d:{cur}">{"".join(buf)}</g>')
                    buf = []
                cur = q
                buf.append(it.svg)
            if buf:
                out.append(f'<g class="px" style="--d:{cur}">{"".join(buf)}</g>')
        else:
            out += [it.svg for it in items]
        vb = " ".join(fmt(v) for v in viewbox)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" preserveAspectRatio="xMidYMid {fit}">'
            f"<defs>{''.join(self.defs)}{extra_defs}</defs>{''.join(out)}</svg>"
        )

    # ---- shadows

    def _cast_shadow(self, pts_world, ground_y=None):
        if not self.look.cast_shadows:
            return
        sun = self.look.sun
        gy = min(p[1] for p in pts_world) if ground_y is None else ground_y
        flat = []
        for p in pts_world:
            t = (p[1] - gy) / max(sun[1], 1e-3)
            flat.append((p[0] - sun[0] * t, p[2] - sun[2] * t))
        hull = hull2d([(round(x, 2), round(z, 2)) for x, z in flat])
        if len(hull) < 3:
            return
        pts = [self.P((x, gy + 0.05, z)) for x, z in hull]
        c = centroid([(x, gy, z) for x, z in hull])
        op = self.look.shadow_opacity
        if self.look.haze_max > 0:
            op *= 1 - self.look.haze_max * (1 - math.exp(-self.cam.depth(c) / self.look.haze_dist))
        self.emit(f'<path d="{path_d(pts)}" fill="{self.look.shadow_color}" opacity="{op:.2f}"/>', c, flat=True)

    # ---- primitives

    def poly(self, pts, color, *, two_sided=True, shade=True, flat=False, prio=0, extra="", k=None):
        """Planar polygon from local 3D points. Faces away from the camera are skipped unless two_sided."""
        w = [self.W(p) for p in pts]
        n = newell(w)
        c = centroid(w)
        facing = dot(n, sub(self.cam.pos, c)) > 0
        if not facing:
            if not two_sided:
                return
            n = mul(n, -1)
        fill = self.tone(color, n, c, k=k) if shade else self.haze(color, c)
        self.emit(f'<path d="{path_d([self.P(p) for p in w])}" {self._style(fill, extra)}/>', c, flat=flat, prio=prio)

    def polyhedron(self, verts, faces, color, *, colors=None, prio=0, shadow=True):
        """Convex polyhedron. faces: lists of vertex indices, counter-clockwise seen from outside.
        colors: optional {face_index: colour}. Back faces are culled."""
        w = [self.W(v) for v in verts]
        svg = []
        for i, f in enumerate(faces):
            fp = [w[j] for j in f]
            n = newell(fp)
            c = centroid(fp)
            if dot(n, sub(self.cam.pos, c)) <= 0:
                continue
            fill = self.tone((colors or {}).get(i, color), n, c)
            svg.append(f'<path d="{path_d([self.P(p) for p in fp])}" {self._style(fill)}/>')
        if shadow:
            self._cast_shadow(w)
        if svg:
            self.emit("".join(svg), centroid(w), prio=prio)

    def box(self, at, size, color, *, colors=None, prio=0, shadow=True):
        """Axis-aligned (in the local frame) box. at = centre of the bottom face; size = (w, h, d).
        colors: {"top"|"front"|"back"|"left"|"right": colour} overrides."""
        x, y, z = at
        w, h, d = size[0] / 2, size[1], size[2] / 2
        v = [
            (x - w, y, z - d), (x + w, y, z - d), (x + w, y, z + d), (x - w, y, z + d),
            (x - w, y + h, z - d), (x + w, y + h, z - d), (x + w, y + h, z + d), (x - w, y + h, z + d),
        ]  # fmt: skip
        faces = [[0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0], [4, 7, 6, 5], [0, 1, 2, 3]]
        names = ["front", "right", "back", "left", "top", "bottom"]
        cmap = {names.index(k): c for k, c in (colors or {}).items()}
        self.polyhedron(v, faces, color, colors=cmap, prio=prio, shadow=shadow)

    def prism(self, at, footprint, height, color, *, colors=None, prio=0, shadow=True, top_offset=None):
        """Vertical extrusion of a convex footprint [(x, z), ...] (counter-clockwise seen from above)
        from y=at.y to y=at.y+height. top_offset: optional per-vertex (dx, dz) for the top ring,
        to make gable roofs etc. colors: {face_index: colour}, with sides numbered from 0 and
        then top = len(footprint)."""
        x0, y0, z0 = at
        n = len(footprint)
        bot = [(x0 + px, y0, z0 + pz) for px, pz in footprint]
        offs = top_offset or [(0, 0)] * n
        top = [(x0 + px + ox, y0 + height, z0 + pz + oz) for (px, pz), (ox, oz) in zip(footprint, offs)]
        verts = bot + top
        # footprint is CCW seen from above (x right, z up the page) -> sides outward
        faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i][::-1] for i in range(n)]
        faces.append(list(range(2 * n - 1, n - 1, -1)))
        faces.append(list(range(n)))
        self.polyhedron(verts, faces, color, colors=colors, prio=prio, shadow=shadow)

    def lathe(self, at, profile, color, *, segments=48, top="closed", inner="#3c4650", cap=None,
              shading="horizontal", prio=0, shadow=True, bands=None):  # fmt: skip
        """Surface of revolution about a vertical axis through `at` (local).
        profile: [(radius, height), ...] from bottom to top.
        top: "closed" (radius 0 or flat cap drawn with `cap` colour), "open" (dark inside, cooling towers).
        shading: "horizontal" (cylinders, towers) or "radial" (domes, spheres).
        bands: [(y0, y1, colour), ...] coloured stripes in profile heights, painted over the body."""
        rings = []
        for r, h in profile:
            ring = []
            for i in range(segments):
                t = 2 * math.pi * i / segments
                ring.append(self.W((at[0] + r * math.cos(t), at[1] + h, at[2] + r * math.sin(t))))
            rings.append(ring)
        proj = [[self.P(p) for p in ring] for ring in rings]
        base_w, top_w = self.W(at), self.W((at[0], at[1] + profile[-1][1], at[2]))
        eye_y = self.cam.pos[1]
        # silhouette
        left = [min(range(segments), key=lambda i: pr[i][0]) for pr in proj]
        right = [max(range(segments), key=lambda i: pr[i][0]) for pr in proj]

        def arc(pr, i0, i1, front):
            """Indices from i0 to i1 along the ring, choosing the near (front) or far half."""
            a = [(i0 + k) % segments for k in range((i1 - i0) % segments + 1)]
            b = [(i0 - k) % segments for k in range((i0 - i1) % segments + 1)]
            mean_v = lambda idx: sum(pr[i][1] for i in idx) / len(idx)
            pick = max if front else min
            return pick((a, b), key=mean_v)

        outline = []
        nr = len(rings)
        for k in range(nr - 1, -1, -1):
            outline.append(proj[k][left[k]])
        outline += [proj[0][i] for i in arc(proj[0], left[0], right[0], front=base_w[1] < eye_y or True)]
        for k in range(nr):
            outline.append(proj[k][right[k]])
        top_r = profile[-1][0]
        top_above = top_w[1] < eye_y  # we look down on the top ring
        if top_r > 1e-6:
            outline += [proj[-1][i] for i in arc(proj[-1], right[-1], left[-1], front=not top_above)]

        # shading
        widest = max(range(nr), key=lambda k: profile[k][0])
        mid_w = self.W((at[0], at[1] + profile[widest][1], at[2]))
        zc = self.cam.depth(mid_w)
        gid = self.uid("lg")
        if shading == "radial":
            cu, cv = self.P(mid_w)
            rad = (proj[widest][right[widest]][0] - proj[widest][left[widest]][0]) / 2
            sun = self.look.sun
            fx, fy = cu - sun[0] * rad * 0.55, cv - sun[1] * rad * 0.45
            stops = "".join(
                f'<stop offset="{o}" stop-color="{tone(self.look, color, k, zc)}"/>'
                for o, k in ((0, 0.95), (0.45, 0.45), (0.85, -0.25), (1, -0.45))
            )
            self.defs.append(
                f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{fmt(fx)}" cy="{fmt(fy)}" r="{fmt(rad * 1.5)}">{stops}</radialGradient>'
            )
        lp, rp = proj[widest][left[widest]], proj[widest][right[widest]]
        to_cam = sub(self.cam.pos, mid_w)
        vh = norm((to_cam[0], 0, to_cam[2]))
        side = cross(vh, (0, 1, 0))

        def hgrad(col):
            """Horizontal gradient across the silhouette, lit by the sun as a cylinder would be."""
            gid_ = self.uid("lg")
            stops = []
            for j in range(9):
                phi = -math.pi / 2 + math.pi * j / 8
                nrm = add(mul(vh, math.cos(phi)), mul(side, math.sin(phi)))
                t = (1 + math.sin(phi)) / 2
                stops.append(
                    f'<stop offset="{t:.3f}" stop-color="{tone(self.look, col, dot(nrm, self.look.sun) * 0.9, zc)}"/>'
                )
            self.defs.append(
                f'<linearGradient id="{gid_}" gradientUnits="userSpaceOnUse" x1="{fmt(lp[0])}" y1="{fmt(lp[1])}" x2="{fmt(rp[0])}" y2="{fmt(rp[1])}">{"".join(stops)}</linearGradient>'
            )
            return f"url(#{gid_})"

        if shading != "radial":
            gid = hgrad(color)[5:-1]
        svg = [f'<path d="{path_d(outline)}" {self._style(f"url(#{gid})")}/>']

        # bands (stripes): re-run the same silhouette maths on a sub-profile
        for y0b, y1b, bc in bands or []:
            sub_prof = [(self._radius_at(profile, y), y) for y in (y0b, (y0b + y1b) / 2, y1b)]
            bring = []
            for r, h in sub_prof:
                bring.append(
                    [
                        self.W(
                            (
                                at[0] + r * math.cos(2 * math.pi * i / segments),
                                at[1] + h,
                                at[2] + r * math.sin(2 * math.pi * i / segments),
                            )
                        )
                        for i in range(segments)
                    ]
                )
            bp = [[self.P(p) for p in ring] for ring in bring]
            bl = [min(range(segments), key=lambda i: pr[i][0]) for pr in bp]
            br = [max(range(segments), key=lambda i: pr[i][0]) for pr in bp]
            o = [bp[0][i] for i in arc(bp[0], bl[0], br[0], front=True)]
            o += [bp[1][br[1]]]
            o += [bp[2][i] for i in arc(bp[2], br[2], bl[2], front=True)]
            o += [bp[1][bl[1]]]
            svg.append(f'<path d="{path_d(o)}" {self._style(hgrad(bc))}/>')

        # top
        if top_r > 1e-6 and top_above:
            top_pts = proj[-1]
            if top == "open":
                inner_ring = [
                    self.P(
                        self.W(
                            (
                                at[0] + top_r * 0.9 * math.cos(2 * math.pi * i / segments),
                                at[1] + profile[-1][1],
                                at[2] + top_r * 0.9 * math.sin(2 * math.pi * i / segments),
                            )
                        )
                    )
                    for i in range(segments)
                ]
                svg.append(f'<path d="{path_d(top_pts)}" {self._style(self.tone(color, (0, 1, 0), top_w))}/>')
                svg.append(f'<path d="{path_d(inner_ring)}" fill="{self.haze(inner, top_w)}"/>')
            else:
                svg.append(f'<path d="{path_d(top_pts)}" {self._style(self.tone(cap or color, (0, 1, 0), top_w))}/>')
        if shadow:
            self._cast_shadow(
                [p for ring in rings[:: max(1, nr // 6)] + [rings[-1]] for p in ring[::4]], ground_y=base_w[1]
            )
        self.emit("".join(svg), base_w, prio=prio)

    @staticmethod
    def _radius_at(profile, y):
        for (r0, h0), (r1, h1) in zip(profile, profile[1:]):
            if h0 <= y <= h1:
                return r0 + (r1 - r0) * (y - h0) / ((h1 - h0) or 1)
        return profile[-1][0]

    def tube(self, pts, radius, color, *, cap="round", prio=0, k=None):
        """Thick 3D polyline (pipes, struts, lattice members, cables). Width follows the depth of its midpoint."""
        w = [self.W(p) for p in pts]
        c = centroid(w)
        width = 2 * radius * self.scale() * self.cam.px_per_unit(c)
        d = sub(w[-1], w[0])
        if k is None:
            # a tube's visible surface faces the camera; its brightness leans on how its axis meets the sun
            k = 0.35 - 0.5 * abs(dot(norm(d), self.look.sun))
        fill = self.tone(color, None, c, k=k)
        self.emit(
            f'<path d="{path_d([self.P(p) for p in w], close=False)}" fill="none" stroke="{fill}" stroke-width="{max(width, 0.6):.2f}" stroke-linecap="{cap}" stroke-linejoin="round"/>',
            c,
            prio=prio,
        )

    def plane(self, origin, u, v):
        """A planar drawing surface in local coordinates: point = origin + x*u + y*v.
        Use it for windows, logos, panel grids, fan housings, ground markings."""
        return Plane(self, self.W(origin), self.Wv(u), self.Wv(v), self.scale())

    def ground(self, pts_xz, color, y=0.0, *, prio=0, shade=False, extra=""):
        """Flat polygon on the horizontal plane at height y (fields, pads, roads, lakes)."""
        w = [self.W((x, y, z)) for x, z in pts_xz]
        c = centroid(w)
        fill = self.tone(color, (0, 1, 0), c) if shade else self.haze(color, c)
        self.emit(f'<path d="{path_d([self.P(p) for p in w])}" {self._style(fill, extra)}/>', c, flat=True, prio=prio)

    def road(self, pts_xz, width, color, y=0.0, *, prio=0):
        """Ribbon of constant width along a centre line on the ground."""
        left, right = [], []
        for i, (x, z) in enumerate(pts_xz):
            a = pts_xz[max(i - 1, 0)]
            b = pts_xz[min(i + 1, len(pts_xz) - 1)]
            dx, dz = b[0] - a[0], b[1] - a[1]
            n = math.hypot(dx, dz) or 1
            ox, oz = -dz / n * width / 2, dx / n * width / 2
            left.append((x + ox, z + oz))
            right.append((x - ox, z - oz))
        self.ground(left + right[::-1], color, y, prio=prio)

    def billboard(self, at, draw, *, prio=0, flat=False, bounds=None):
        """2D art that always faces the camera (trees, bushes, people, clouds, steam), placed at a
        local 3D point and scaled with depth. draw(tone) returns SVG in local units with y UP and
        the anchor at (0, 0); tone(colour, k=0) returns a shaded and hazed colour.
        bounds = (x0, y0, x1, y1) of the art in those units, so auto-framing includes it."""
        w = self.W(at)
        u, v = self.P(w)
        k = self.scale() * self.cam.px_per_unit(w)
        if bounds:
            b = self.bbox
            b[0], b[2] = min(b[0], u + k * bounds[0]), max(b[2], u + k * bounds[2])
            b[1], b[3] = min(b[1], v - k * bounds[3]), max(b[3], v - k * bounds[1])
        z = self.cam.depth(w)
        body = draw(lambda color, k=0.0: tone(self.look, color, k, z))
        self.emit(
            f'<g transform="translate({fmt(u)},{fmt(v)}) scale({k:.4f},{-k:.4f})">{body}</g>', w, prio=prio, flat=flat
        )

    def ridge(self, pts, color, *, base_y=None, crest=0.25, foot=-0.25, prio=0, decorate=None, gradient=True):
        """Terrain curtain: a crest line of local 3D points, closed straight down to base_y
        (default: the lowest crest point minus a lot). Shaded with a vertical gradient from a
        lit crest to a shaded foot. decorate(scene) may add parts (trees on the crest) to the same object."""
        w = [self.W(p) for p in pts]
        by = base_y if base_y is not None else min(p[1] for p in w) - 400
        foot_pts = [(p[0], by, p[2]) for p in reversed(w)]
        pp = [self.P(p) for p in w + foot_pts]
        c = centroid(w)
        anchor = (c[0], by, c[2])
        top_v = min(v for _, v in pp[: len(w)])
        bot_v = max(v for _, v in pp)
        if gradient:
            gid = self.uid("rg")
            self.defs.append(
                f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="0" y1="{fmt(top_v)}" x2="0" y2="{fmt(min(bot_v, top_v + 260))}">'
                f'<stop offset="0" stop-color="{self.tone(color, None, c, k=crest)}"/><stop offset="1" stop-color="{self.tone(color, None, c, k=foot)}"/></linearGradient>'
            )
            fill = f"url(#{gid})"
        else:
            fill = self.tone(color, None, c, k=crest)
        with self.group(anchor=self._inv_local(anchor)):
            self.emit(f'<path d="{path_d(pp)}" {self._style(fill)}/>', c, prio=-5)
            if decorate:
                decorate(self)

    def _inv_local(self, p_world):
        # ridge/group anchors are given in local coordinates; when the frame stack is empty they coincide
        if not self._frames:
            return p_world
        raise NotImplementedError("ridge() inside a frame is not supported in this prototype")


class Plane:
    """Drawing surface on a 3D plane. Coordinates (x, y) map to origin + x*u + y*v (world)."""

    def __init__(self, scene: Scene, origin, u, v, scale):
        self.s, self.o, self.u, self.v, self.k = scene, origin, mul(u, scale), mul(v, scale), scale
        self.n = norm(cross(self.u, self.v))
        if dot(self.n, sub(scene.cam.pos, origin)) < 0:
            self.n = mul(self.n, -1)

    def at(self, x, y):
        return add(self.o, add(mul(self.u, x), mul(self.v, y)))

    def visible(self):
        """True when the plane faces the camera, for the natural convention: u to the right and v
        up as seen from outside. (The world is left-handed as seen by the viewer, so the
        outward normal is v x u.)"""
        return dot(cross(self.v, self.u), sub(self.s.cam.pos, self.o)) > 0

    def poly(self, pts, color, *, shade=True, k=None, prio=1, flat=False, extra=""):
        w = [self.at(x, y) for x, y in pts]
        c = centroid(w)
        fill = self.s.tone(color, self.n, c, k=k) if shade else self.s.haze(color, c)
        self.s.emit(
            f'<path d="{path_d([self.s.P(p) for p in w])}" {self.s._style(fill, extra)}/>', c, prio=prio, flat=flat
        )

    def rect(self, x, y, w, h, color, **kw):
        self.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], color, **kw)

    def circle(self, cx, cy, r, color, n=36, **kw):
        self.poly(
            [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)],
            color,
            **kw,
        )

    def line(self, pts, color, width, *, k=None, prio=1):
        """Stroke in plane units (width too). Good for panel grids and frames."""
        w = [self.at(x, y) for x, y in pts]
        c = centroid(w)
        px = width * self.s.cam.px_per_unit(c)
        fill = self.s.tone(color, self.n, c, k=k)
        self.s.emit(
            f'<path d="{path_d([self.s.P(p) for p in w], close=False)}" fill="none" stroke="{fill}" stroke-width="{max(px, 0.5):.2f}" stroke-linecap="round" stroke-linejoin="round"/>',
            c,
            prio=prio,
        )

    def affine(self, x, y):
        """SVG matrix(a b c d e f) mapping plane coordinates around (x, y) to output pixels, using
        the projection's local linearisation at that point. Plane y points along v (usually up)."""
        p0 = self.s.cam.project(self.at(x, y))
        eps = 0.01
        px = self.s.cam.project(self.at(x + eps, y))
        py = self.s.cam.project(self.at(x, y + eps))
        a, b = (px[0] - p0[0]) / eps, (px[1] - p0[1]) / eps
        c, d = (py[0] - p0[0]) / eps, (py[1] - p0[1]) / eps
        return f"matrix({a:.4f} {b:.4f} {c:.4f} {d:.4f} {fmt(p0[0])} {fmt(p0[1])})"

    def svg(self, x, y, body, *, prio=1, cls=None, style=None):
        """Raw 2D SVG drawn in plane units centred on (x, y), with y along v. Use for text and
        for animated content: wrap moving bits in <g class="spin"> to rotate them about (x, y)."""
        attrs = f' class="{cls}"' if cls else ""
        attrs += f' style="{style}"' if style else ""
        self.s.emit(f'<g transform="{self.affine(x, y)}"><g{attrs}>{body}</g></g>', self.at(x, y), prio=prio)

    def spinner(self, x, y, body, period=6.0, ccw=False, prio=2):
        """`body` (SVG centred on 0,0, plane units) rotates about (x, y) on the plane."""
        cls = "spin spin-ccw" if ccw else "spin"
        self.svg(x, y, body, prio=prio, cls=cls, style=f"--period:{period}s;transform-origin:0 0")

    def tone(self, color, k=None):
        return self.s.tone(color, self.n, self.o, k=k)


# ---------------------------------------------------------------- profiles for lathe()


def cylinder_profile(r, h):
    return [(r, 0), (r, h)]


def cone_profile(r0, r1, h):
    return [(r0, 0), (r1, h)]


def dome_profile(r, h=None, n=10, base=0.0):
    """Quarter ellipse from radius r at height base up to the apex at base+h (default h=r)."""
    h = r if h is None else h
    return [(r * math.cos(math.pi / 2 * i / n), base + h * math.sin(math.pi / 2 * i / n)) for i in range(n + 1)]


def capsule_profile(r, h, cap=None, n=8):
    """Vertical cylinder of radius r and body height h with a domed top of height cap (default r*0.6)."""
    cap = r * 0.6 if cap is None else cap
    return [(r, 0)] + dome_profile(r, cap, n, base=h)


def hyperboloid_profile(r_base, r_waist, r_top, h, waist=0.72, n=14):
    """Cooling-tower profile: hyperbola through the three radii, waist at waist*h."""
    out = []
    for i in range(n + 1):
        y = h * i / n
        yw = waist * h
        if y <= yw:
            t = (yw - y) / yw
            r = math.sqrt(r_waist**2 + (r_base**2 - r_waist**2) * t * t)
        else:
            t = (y - yw) / (h - yw)
            r = math.sqrt(r_waist**2 + (r_top**2 - r_waist**2) * t * t)
        out.append((r, y))
    return out
