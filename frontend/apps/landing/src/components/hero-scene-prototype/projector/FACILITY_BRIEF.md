# PROTOTYPE: modelling a facility for the 3D-to-SVG projector (issue #1440)

This is throwaway prototype code. It answers this question: can a small 3D scene of analytic
shapes, projected to flat SVG, give the landing hero (and later the game's facility assets)
the colour and recognisability of the current AI banner, without its excess detail and
generation artefacts, while gaining real depth for parallax?

## What exists

All paths are relative to this folder (`projector/`).

- `core.py`: camera, `Scene`, and the primitives. **Read its docstrings; that is the API.**
  - `box`, `prism`, `polyhedron`: flat-shaded convex solids with per-face colours.
  - `lathe`: surface of revolution with a gradient body, optional `bands` (stripes), and
    `top="open"` for chimneys and cooling towers. It comes with these profile helpers:
    `cylinder_profile`, `cone_profile`, `dome_profile`, `capsule_profile`,
    `hyperboloid_profile`.
  - `plane(origin, u, v)` returns a `Plane` drawing surface in 3D: `rect`, `circle`, `poly`,
    `line` (strokes in plane units), `svg` (raw 2D SVG through a local affine), and `spinner`
    (rotating 2D art: blades, fans).
  - `tube`: pipes, struts, lattice members, cables, handrails.
  - `ground` and `road`: flat polygons on the ground (pads, paths, puddles).
  - `billboard`: camera-facing 2D art (people, vehicles' small bits, foliage).
  - `group(anchor=…)`: makes one painter-sorted object. Parts inside are sorted by
    `(prio, -depth)`; raise `prio` to force a part on top of its siblings.
  - `frame(origin, yaw, scale)`: local coordinates.
  - Cast shadows are automatic for `box`, `prism`, `polyhedron` and `lathe`. Pass
    `shadow=False` for parts that sit on top of other parts.
- `palette.py`: the shared base colours, sampled from the banner. **Do not edit it.** Use its
  names, and if you need extra colours, define them as constants at the top of your own
  module, sampled from the reference crop.
- `effects.py`: `steam`, `plume`, `cloud`, `tree`, `conifer`, `bush`.
- `facilities/__init__.py`: the module contract (`NAME`, `EXTENT`, `build(s)`).
- `facilities/nuclear.py`: **the reference facility.** Read it before writing yours.
- `gallery.py`: renders facilities with the shared camera into
  `../projected/facilities/<key>.svg` and `previews/<key>.png`.
- `previews/ref-<key>.png`: a 2x crop of the facility from the AI banner. It is your visual
  reference, and the original banner is at `../../../assets/energetica_landing_banner.webp`.

## Rules

- Write **only** your own `facilities/<key>.py` files. Do not edit `core.py`, `effects.py`,
  `palette.py`, `gallery.py`, other facilities, or anything outside `projector/`. Other agents
  are working in parallel in the same folder. If the core is missing something, write a small
  helper inside your module (you can emit raw SVG with `s.emit(svg, at_world)` and project
  points with `s.P(s.W(p))`), and mention it in your report as a suggested core addition. If
  you find a real bug in the core, work around it and report it.
- No git commands. Keep bash commands simple (no heredocs, no `cd … &&` chains); the session
  is sandboxed to the worktree. Run scripts with absolute paths, or from `projector/` using
  the `cwd` the parent gives you.
- Python: `~/.cache/energetica-proto-1440/venv/bin/python` (it has resvg_py for previews).

## Style target

- **Colour from the banner**, flat-shaded, with the core's lighting: the sun is upper left;
  lit faces go warm and shaded faces go cool. No outlines by default.
- **More detail than a pictogram, less than the AI image.** Add the details that make the
  thing recognisable at a glance and that read at hero size: windows in rows, panel grids,
  stripes, pipe runs, ladders, railings, lattice legs, warning bands, logos (H₂, lightning
  bolts). Skip noise, texture and small clutter. If a detail is under ~2 px at the size the
  facility appears in the hero (see your brief), drop it.
- Believable proportions **within** the facility, in metres. The hero rescales whole
  facilities, so absolute size doesn't matter, but relative size within one does.
- Follow the banner's design (silhouette, colours, signature details) closely, but it's a
  redraw, not a trace. Fix things the AI got wrong (warped geometry, inconsistent
  perspective).

## Two viewpoints to survive

1. **Gallery:** the camera sits front-right and above (see `AZIMUTH`/`ELEVATION` in
   `gallery.py`), so the front (-z) and right (+x) faces show.
2. **Hero:** the camera looks roughly front-on (along +z) from slightly above. A facility left
   of the image centre shows its right (+x) side a bit; one right of centre shows its left
   (-x) side. So make all four sides plausible, and only put decals on faces that face the
   camera: check `plane.visible()` before drawing on a `Plane`, since a decal on a hidden face
   would draw through the solid. To check your facility from a hero-like view as well, you may
   temporarily change `AZIMUTH` to -15 or 0 **in a copy** of gallery.py named
   `gallery_<key>.py`, then delete the copy when done.

## Painter's order pitfalls

- Sorting is per part, by the camera depth of the part's anchor or centroid. For tall thin
  things next to big boxes, or for parts stacked on top of each other, use separate
  `group`s or `prio`.
- Inside one convex solid, faces never conflict. Between solids they can: check every
  preview for a near thing hidden behind a far thing.
- `ground`/`road` parts are "flat" and are painted before standing things in the same group,
  and top-level flats are painted before all standing items.

## Animation (where the facility moves)

Use CSS classes from `../hero-scene.prototype.css`; previews are static, which is fine:

- `plane.spinner(x, y, body, period)`: rotating rotors and fans. Draw `body` centred on (0, 0)
  in plane units.
- `effects.steam(...)` / `effects.plume(...)`: exhaust and steam.
- Flowing water or conveyors: a stroked path with `class="flow"` (dash animation;
  `style="--period:…"`).

## Done means

- `gallery.py <key>` runs cleanly, and you have looked at `previews/<key>.png` and iterated
  until it is clean: no ordering errors, no decals on hidden faces, and it reads as the
  banner's facility.
- Also check it once with `--outline 1.2`.
- The asset SVG is reasonably small (aim for under ~40 KB per facility; report the size).
- Your report: what you modelled, what you left out, any core suggestions or bugs, file
  sizes, and the PNG paths.
