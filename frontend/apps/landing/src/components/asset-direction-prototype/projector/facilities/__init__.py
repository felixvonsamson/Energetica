"""PROTOTYPE (issue #1440): one module per facility.

Contract for each module:

    NAME = "Nuclear power plant"            # human label
    EXTENT = (w, h, d)                      # rough bounding size in metres, frames the gallery camera
    def build(s: Scene) -> None: ...        # draw at the local origin, ground at y=0, front facing -z

Build in metres with believable proportions *within* the facility; the hero scene rescales
and places each facility to match the banner composition via `with s.frame(origin, yaw, scale)`.
Wrap the facility (or each separable building) in `with s.group(anchor=...)` so it sorts as a unit.
"""
