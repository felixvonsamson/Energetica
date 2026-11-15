# ruff: noqa
"""PROTOTYPE (#1469): palettes to compare on the map camera.

Each palette is a set of overrides applied on top of the defaults (the banner colours in
palette.py and the per-facility constants), plus Look overrides for the light and shadow
tints. `apply(name, key)` resets every module to its defaults first, so renders never leak
colours into each other.

- banner: the current banner's colours (palette.py as sampled in #1440). Bright, saturated.
- brief:  warm neutrals (bone, sand, warm stone, muted warm greens). Colour appears only as the
          facility's chart colour, softened. Everything else that was coloured goes neutral.
- pine:   Felix's mockup: cream structures on pine-green ground, with shades that lean green
          rather than blue. Same softened chart accents as `brief`.
"""

import importlib
import math

import palette as P

FACILITY_MODULES = ["nuclear", "wind", "solar", "hydro_dam", "coal_mine", "battery"]

# ---------------------------------------------------------------- colour maths (OKLCH)


def _srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _lin_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_oklch(h):
    h = h.lstrip("#")
    r, g, b = (_srgb_to_lin(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = l ** (1 / 3), m ** (1 / 3), s ** (1 / 3)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def oklch_to_hex(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return "#" + "".join(f"{max(0, min(255, round(_lin_to_srgb(max(0, v)) * 255))):02x}" for v in (r, g, bb))


def soften(h, L=None, Lmin=0.46, Lmax=0.80, Cmax=0.10, dL=0.0):
    """Illustration version of a chart colour: lightness clamped into a band, chroma capped."""
    l, c, hue = hex_to_oklch(h)
    l = L if L is not None else min(Lmax, max(Lmin, l)) + dL
    return oklch_to_hex(l, min(c, Cmax), hue)


# ---------------------------------------------------------------- chart colours (global.css)

CHART = {
    "nuclear": "#bfd200",  # --asset-color-nuclear-reactor
    "wind": "#49a078",  # --asset-color-onshore-wind-turbine
    "offshore": "#216869",  # --asset-color-offshore-wind-turbine
    "solar": "#ffea00",  # --asset-color-pv-solar
    "hydro_dam": "#03045e",  # --asset-color-large-water-dam
    "coal_mine": "#495057",  # --asset-color-coal-mine
    "coal": "#000000",  # --asset-color-coal
    "battery": "#6c584c",  # --asset-color-lithium-ion-batteries
}

ACCENT = {
    "nuclear": soften(CHART["nuclear"], Lmax=0.78, Cmax=0.12),
    "wind": soften(CHART["wind"], Cmax=0.09),
    "offshore": soften(CHART["offshore"], Lmin=0.52, Cmax=0.07),
    "solar": soften(CHART["solar"], Lmax=0.82, Cmax=0.12),
    "hydro_dam": soften(CHART["hydro_dam"], Lmin=0.48, Cmax=0.09),
    "coal_mine": soften(CHART["coal_mine"], Lmin=0.50),
    "coal": oklch_to_hex(0.30, 0.008, 60),  # warm charcoal instead of pure black
    "battery": soften(CHART["battery"], Lmin=0.56, Cmax=0.05),
}


def accent_dark(key, k=0.10):
    l, c, h = hex_to_oklch(ACCENT[key])
    return oklch_to_hex(max(0, l - k), c, h)


# ---------------------------------------------------------------- palettes

BRAND = {
    "bone50": "#eee5ca", "bone100": "#e5d9b6", "bone150": "#d5c38f", "bone300": "#b3a06d",
    "bone600": "#876d22", "pine100": "#b5ca95", "pine200": "#a4be7b", "pine500": "#5f8d4e",
    "pine700": "#285430", "pine800": "#1b3820", "pine900": "#0d1f13",
}  # fmt: skip

# Tile colours are not in palette.py; these are the banner-style defaults.
TILE_BANNER = {
    "grass": P.grass,
    "grass_edge": P.hill_shade,
    "soil": "#8a7458",
    "soil_deep": "#6b5844",
    "water": P.water,
    "water_edge": P.water_deep,
    "seabed": "#4f7f93",
    "sand": "#e6d6a6",
}


def _accent_overrides(fac):
    """Per-facility overrides that route the chart colour into the facility's signature parts.
    Used by `brief` and `pine`."""
    a = ACCENT
    return {
        "nuclear": {"P": {"red": a["nuclear"], "orange": P.steel}},
        "wind": {"wind": {"TIP_RED": a["wind"]}},
        "wind_one": {"wind": {"TIP_RED": a["wind"]}},
        "offshore": {"wind": {"TIP_RED": a["offshore"], "TRANSITION": a["offshore"]}},
        "solar": {"P": {"solar_frame": a["solar"]}},
        "hydro_dam": {"hydro_dam": {"GATE": a["hydro_dam"], "GATE_DARK": accent_dark("hydro_dam")}},
        "coal_mine": {
            "P": {"coal": a["coal"], "coal_light": oklch_to_hex(0.40, 0.008, 60)},
            "coal_mine": {"HEADFRAME": a["coal_mine"]},
        },
        "battery": {"P": {"green_accent": a["battery"]}, "battery": {"ROOF": a["battery"]}},
    }.get(fac, {})


BRIEF = {
    "label": "Brief: warm neutrals + chart accents",
    "look": {"light_tint": "#fff3dc", "shadow_tint": "#3f4658", "shadow_color": "#3a3328", "shadow_opacity": 0.20},
    "P": {
        "grass": "#a9ad7c", "grass_dry": "#bdb68a", "meadow": "#b0b282", "hill": "#a3a676", "hill_shade": "#8c9066",
        "tree": "#7f8a58", "tree_dark": "#646d47", "conifer": "#5a654a", "trunk": "#6e5a47",
        "dirt": "#8f7c63", "dirt_dark": "#6c5e4c", "rock": "#9b9387", "coal": "#3b3936", "coal_light": "#56524c",
        "water": "#86aab0", "water_deep": "#668d95", "water_foam": "#eef1ea",
        "concrete": "#e9e0cb", "concrete_warm": "#e2d5ba", "concrete_dark": "#b9ad96", "white": "#f2ebdc",
        "steel": "#aaa8a0", "steel_dark": "#6f6c66", "roof": "#c6beac", "roof_dark": "#9d9585",
        "window": "#58676b", "window_lit": "#a9b8b5", "glass": "#7f9aa0", "asphalt": "#9e978a",
        "path": "#d8cdb3", "pad": "#d0c6ae",
        "red": "#b8816b", "orange": "#aaa8a0", "yellow": "#cdb57a", "yellow_dark": "#a89260",
        "blue": "#6f8aa0", "green_accent": "#8a9a6a",
        "solar_frame": "#c9c4b6", "fan_dark": "#4a4844", "fan_blade": "#7a766e", "tyre": "#34312d",
        "steam": "#fbf8f1", "steam_shade": "#e0ddd4",
    },
    "solar": {"GLASS": "#2c3d4f", "GRID": "#6c7f8c", "SHEEN": "#dfe5e3"},
    "battery": {"SEAM": "#b8b2a6", "ROOF": "#d3cbbb", "LOUVRE": "#c7c0b2", "SLAT": "#8f897e", "TRANSFORMER": "#a9a69c"},
    "hydro_dam": {
        "DAM": "#d6cfbf", "DAM_PIER": "#ded8c9", "CREST_ROAD": "#aaa395", "POOL": "#8db3b8",
        "SHEET_TOP": "#dde6e2", "SHEET_MID": "#b8cfd0", "SHEET_FOOT": "#f1f3ee", "STREAK_LIGHT": "#fafaf5",
        "STREAK_DARK": "#93b3b6", "FOAM": "#fbfaf5", "FOAM_SHADE": "#d9e0dc",
    },
    "coal_mine": {
        "CONV": "#8a8a84", "SCREEN": "#7d7c76", "RUST": "#6f5a4a", "YARD": "#57524b", "CUT": "#5a4f44",
        "CHROME": "#b1aea6",
    },
    "wind": {"TRANSITION": "#cdb57a"},
    "tile": {
        "grass": "#a9ad7c", "grass_edge": "#8c9066", "soil": "#b09a7a", "soil_deep": "#8d7a60",
        "water": "#86aab0", "water_edge": "#668d95", "seabed": "#6e8580", "sand": "#ddd0b0",
    },
}  # fmt: skip

PINE = {
    "label": "Pine: cream on pine green (Felix's mockup)",
    "look": {
        "light_tint": "#fff6dc",
        "shadow_tint": BRAND["pine800"],
        "shadow_amount": 0.38,
        "shadow_color": BRAND["pine900"],
        "shadow_opacity": 0.26,
    },
    "P": {
        "grass": "#6f9a57", "grass_dry": "#86a565", "meadow": "#7aa25e", "hill": "#6a9454", "hill_shade": "#557d45",
        "tree": "#4f7a42", "tree_dark": "#3c6234", "conifer": "#335a33", "trunk": "#5f4b36",
        "dirt": "#8a7656", "dirt_dark": "#665640", "rock": "#9a9480", "coal": "#2f332c", "coal_light": "#464b41",
        "water": "#79aeb0", "water_deep": "#4f8a8f", "water_foam": "#eef3e6",
        "concrete": BRAND["bone50"], "concrete_warm": BRAND["bone100"], "concrete_dark": BRAND["bone300"],
        "white": "#f5eed8", "steel": "#b5ae92", "steel_dark": "#6f6c58", "roof": BRAND["bone150"],
        "roof_dark": BRAND["bone300"], "window": BRAND["pine700"], "window_lit": "#a8c49a", "glass": "#6f9690",
        "asphalt": "#9c9682", "path": BRAND["bone100"], "pad": "#d9cda8",
        "red": "#b9654a", "orange": "#b5ae92", "yellow": BRAND["bone150"], "yellow_dark": BRAND["bone300"],
        "blue": "#5e8796", "green_accent": BRAND["pine500"], "solar_frame": BRAND["bone100"],
        "fan_dark": "#3f4436", "fan_blade": "#787762", "tyre": "#2c2e26", "steam": "#fbf7ea", "steam_shade": "#dcdccb",
    },
    "solar": {"GLASS": "#23413f", "GRID": "#5f8278", "SHEEN": "#e3ead6"},
    "battery": {"SEAM": "#bfb595", "ROOF": BRAND["bone150"], "LOUVRE": "#cfc4a0", "SLAT": "#8f8668", "TRANSFORMER": "#aca78e"},
    "hydro_dam": {
        "DAM": "#ddd3b4", "DAM_PIER": "#e5dbbe", "CREST_ROAD": "#aaa185", "POOL": "#86b8b5",
        "SHEET_TOP": "#dfeae0", "SHEET_MID": "#b5d1cb", "SHEET_FOOT": "#f3f5ea", "STREAK_LIGHT": "#fbfbf3",
        "STREAK_DARK": "#8bb5b1", "FOAM": "#fbfaf2", "FOAM_SHADE": "#d5e1d6",
    },
    "coal_mine": {
        "CONV": "#8b8a74", "SCREEN": "#7b7c66", "RUST": "#6f5845", "YARD": "#4f5244", "CUT": "#4e4b3c",
        "CHROME": "#b4b098",
    },
    "wind": {"TRANSITION": BRAND["bone150"]},
    "tile": {
        "grass": "#6f9a57", "grass_edge": "#557d45", "soil": "#8b7552", "soil_deep": BRAND["pine800"],
        "water": "#79aeb0", "water_edge": "#4f8a8f", "seabed": "#3f6a63", "sand": BRAND["bone100"],
    },
}  # fmt: skip

BANNER = {"label": "Banner: the current hero's colours", "look": {}, "tile": TILE_BANNER}

PALETTES = {"banner": BANNER, "brief": BRIEF, "pine": PINE}

# ---------------------------------------------------------------- apply

_mods = {"P": P}
for _m in FACILITY_MODULES:
    _mods[_m] = importlib.import_module(f"facilities.{_m}")
_defaults = {
    k: {n: v for n, v in vars(m).items() if n.isupper() or (k == "P" and not n.startswith("_"))}
    for k, m in _mods.items()
}
_defaults["P"] = {n: v for n, v in vars(P).items() if isinstance(v, str) and v.startswith("#")}

TILE = dict(TILE_BANNER)


def apply(name, fac=None):
    """Reset every colour to its default, then apply palette `name` (and the facility's accent
    routing for `fac`, a facility key such as "nuclear" or "offshore"). Returns Look overrides."""
    for k, vals in _defaults.items():
        for n, v in vals.items():
            setattr(_mods[k], n, v)
    pal = PALETTES[name]
    layers = [pal] + ([_accent_overrides(fac)] if name != "banner" and fac else [])
    for layer in layers:
        for k, vals in layer.items():
            if k in _mods:
                for n, v in vals.items():
                    setattr(_mods[k], n, v)
    TILE.clear()
    TILE.update(pal.get("tile", TILE_BANNER))
    return dict(pal.get("look", {}))
