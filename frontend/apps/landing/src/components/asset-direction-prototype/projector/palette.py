# ruff: noqa
"""PROTOTYPE (issue #1440): base colours, sampled from the AI banner and then nudged by eye.

These are *unlit* base colours. The projector lightens faces turned to the sun and cools/darkens
faces turned away, and hazes everything with distance, so pick the colour a surface has in
neutral light. Add new entries here rather than hard-coding hex values in a facility, so the
whole scene stays in one palette.
"""

# sky and air
sky_top = "#4fb0e4"
sky_mid = "#86cdee"
sky_horizon = "#d6eff6"
cloud = "#ffffff"
cloud_shade = "#cfe2ee"
steam = "#ffffff"
steam_shade = "#dbe6ec"

# land
mountain_far = "#7fabc6"
mountain = "#6597a9"
mountain_rock = "#8ea3a8"
forest_far = "#3f8460"
forest = "#3f7d4a"
hill = "#8fbf4f"
hill_shade = "#6fa245"
grass = "#9cc94f"
grass_dry = "#b5cf63"
meadow = "#a8d35c"
tree = "#4f8f3a"
tree_dark = "#3a7232"
conifer = "#2f6b45"
trunk = "#6b4f3a"
dirt = "#7b6a55"
dirt_dark = "#5a4c3e"
rock = "#8d8b85"
coal = "#2c3138"
coal_light = "#454c55"
water = "#62bce3"
water_deep = "#3d9dcc"
water_foam = "#eaf6fb"

# built
concrete = "#ebe6da"  # cooling towers, reactor buildings
concrete_warm = "#e6dccb"
concrete_dark = "#b9b5ab"
white = "#f5f3ec"
steel = "#b8c1c8"
steel_dark = "#7d8891"
roof = "#c9ced2"
roof_dark = "#9aa4ad"
window = "#5f7f9c"
window_lit = "#9cc3df"
glass = "#7fb3d6"
asphalt = "#9aa1a7"
path = "#d9d2bf"
pad = "#cfcabd"

# accents
red = "#d9573b"  # chimney stripes, warning bands
orange = "#e3833f"  # pipework
yellow = "#f2b51c"  # mining vehicles
yellow_dark = "#c98d10"
blue = "#1f6fbf"  # hydrogen
blue_light = "#4a95d8"
green_accent = "#43b14b"  # battery bolts
solar = "#22427c"
solar_cell = "#2f5aa3"
solar_line = "#8fb1e6"
solar_frame = "#c9d1d8"
fan_dark = "#39414a"
fan_blade = "#6c7781"
tyre = "#2a2d31"
