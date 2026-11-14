"""PROTOTYPE (issue #1440): auto-traces the landing banner into a layered colour SVG.

Pipeline:
  1. Flatten: iterated bilateral filter in CIELAB, k-means palette over Lab plus a
     "not sky" depth channel, then small low-contrast regions merged into their
     surroundings (thin lines kept). This is what removes the AI-generation noise.
  2. Depth bands: split ../depth/banner-depth.png into bands by quantile, then move each
     flat-colour region whole into its median band so band edges follow the drawing.
     Each band becomes one <g class="px" style="--d:…"> group, drawn far to near.
  3. Trace each band with vtracer. Besides its own pixels, a band also carries a strip
     of the nearer pixels just above their lower edges, so that when it sinks (scroll
     parallax) no hole opens under the nearer objects. svgmin.py shrinks the paths.

Writes banner-traced.svg and previews/*.png next to this file. Run with the throwaway venv:
  ~/.cache/energetica-proto-1440/venv/bin/python trace_banner.py
compare.py makes 1:1 crop sheets (original above the previews) for review.
"""

import gzip
import sys
from pathlib import Path

import numpy as np
import resvg_py
import vtracer
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.cluster.vq import kmeans2, vq
from svgmin import minify_paths

HERE = Path(__file__).parent
BANNER = HERE.parents[2] / "assets" / "energetica_landing_banner.webp"
DEPTH = HERE.parent / "depth" / "banner-depth.png"
OUT_SVG = HERE / "banner-traced.svg"
PREVIEWS = HERE / "previews"

W, H = 2167, 725

# --- 1. Flatten -------------------------------------------------------------------
BILATERAL_PASSES = 3
BILATERAL_RADIUS = 4
BILATERAL_SIGMA_SPACE = 3.0
BILATERAL_SIGMA_COLOR = 7.0  # in Lab units
PALETTE_SIZE = 40
DEPTH_FEATURE = 30.0  # Lab-equivalent units separating "sky" from "anything nearer"
DEPTH_KNEE = 25  # depth at which a pixel counts as fully "not sky"
MODE_FILTER = 0  # px, on the label map
# Small regions are merged into their surroundings when they barely differ from them
# (grass mottling, cloud noise) but kept when they contrast (wheels, icons, blade tips).
MERGE_AREA = 400  # px; regions smaller than this are candidates
MERGE_DELTA_E = 14.0  # Lab distance below which a candidate merges
TINY_AREA = 12  # px; always merged
LINE_ELONGATION = 6.0  # longest side² / area above which a small region is a line; kept

# --- 2. Depth bands ---------------------------------------------------------------
BANDS = 16
SKY_DEPTH = 6  # depth <= this is band 0 (sky and far mountains)
SNAP_MAX_SPREAD = 1.0  # bands (std dev); flatter regions move whole into one band
MAX_SHIFT = 50  # banner px; the parallax amplitude the layers must survive (default 40)
DILATE = 3  # px a band's mask grows so its anti-aliased edge sits over itself
TOP_PAD = MAX_SHIFT + 4  # sky rows added above the image, revealed when far layers sink

STEAM = [(1060, 175), (1375, 185)]  # cooling tower tops, banner px
STEAM_PUFFS = 3  # per tower
STEAM_PERIOD = 9  # s

# --- 3. vtracer -------------------------------------------------------------------
VTRACER = dict(
    colormode="color",
    hierarchical="stacked",
    mode="spline",
    filter_speckle=4,
    color_precision=8,
    layer_difference=4,
    corner_threshold=60,
    length_threshold=8.0,
    max_iterations=10,
    splice_threshold=45,
    path_precision=2,
)


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack(
        [116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])],
        axis=-1,
    ).astype(np.float32)


def bilateral(lab: np.ndarray) -> np.ndarray:
    r = BILATERAL_RADIUS
    out = lab
    for _ in range(BILATERAL_PASSES):
        padded = np.pad(out, ((r, r), (r, r), (0, 0)), mode="edge")
        acc = np.zeros_like(out)
        wsum = np.zeros(out.shape[:2], np.float32)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                ws = np.exp(-(dx * dx + dy * dy) / (2 * BILATERAL_SIGMA_SPACE**2))
                if ws < 0.05:
                    continue
                nb = padded[r + dy : r + dy + out.shape[0], r + dx : r + dx + out.shape[1]]
                dc = ((nb - out) ** 2).sum(-1)
                w = ws * np.exp(-dc / (2 * BILATERAL_SIGMA_COLOR**2))
                acc += nb * w[..., None]
                wsum += w
        out = acc / wsum[..., None]
    return out


def flatten(rgb: np.ndarray, depth: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Returns the banner as a palette index per pixel, and the palette (sRGB).

    The k-means features are Lab plus a "not sky" channel from the depth map, so a thin
    white turbine blade gets its own palette entry instead of melting into pale haze.
    """
    lab = bilateral(srgb_to_lab(rgb.astype(np.float32)))
    near = DEPTH_FEATURE * np.clip(depth.astype(np.float32) / DEPTH_KNEE, 0, 1)
    flat = np.dstack([lab, near]).reshape(-1, 4)
    rng = np.random.default_rng(1440)
    sample = flat[rng.choice(len(flat), 200_000, replace=False)]
    centroids, _ = kmeans2(sample, PALETTE_SIZE, minit="++", seed=1440, iter=30)
    labels, _ = vq(flat, centroids)
    labels = labels.reshape(rgb.shape[:2]).astype(np.uint8)
    if MODE_FILTER > 1:
        labels = np.asarray(Image.fromarray(labels).filter(ImageFilter.ModeFilter(MODE_FILTER)))
    for _ in range(3):
        labels = merge_quiet_regions(labels, centroids)
    # Palette colour = mean original sRGB of the cluster's pixels (avoids Lab -> sRGB).
    palette = np.zeros((PALETTE_SIZE, 3), np.uint8)
    for k in range(PALETTE_SIZE):
        sel = labels == k
        if sel.any():
            palette[k] = np.clip(rgb[sel].mean(0).round(), 0, 255)
    return labels, palette


def segments(labels: np.ndarray) -> tuple[np.ndarray, int]:
    """Connected regions of one flat colour, numbered 1..n."""
    seg = np.zeros(labels.shape, np.int32)
    n = 0
    for k in np.unique(labels):
        comp, count = ndimage.label(labels == k)
        seg[comp > 0] = comp[comp > 0] + n
        n += count
    return seg, n


def merge_quiet_regions(labels: np.ndarray, lab_palette: np.ndarray) -> np.ndarray:
    seg, n = segments(labels)
    area = np.bincount(seg.ravel(), minlength=n + 1)
    out = labels.copy()
    cross = ndimage.generate_binary_structure(2, 1)
    for i, sl in enumerate(ndimage.find_objects(seg), start=1):
        if sl is None or area[i] >= MERGE_AREA:
            continue
        ys = slice(max(sl[0].start - 1, 0), sl[0].stop + 1)
        xs = slice(max(sl[1].start - 1, 0), sl[1].stop + 1)
        mine = seg[ys, xs] == i
        ring = ndimage.binary_dilation(mine, cross) & ~mine
        neighbours = labels[ys, xs][ring]
        if neighbours.size == 0:
            continue
        counts = np.bincount(neighbours, minlength=len(lab_palette))
        target = int(counts.argmax())
        own = int(labels[ys, xs][mine][0])
        delta = float(np.linalg.norm(lab_palette[own] - lab_palette[target]))
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        thin_line = max(h, w) ** 2 / area[i] > LINE_ELONGATION
        if area[i] < TINY_AREA or (delta < MERGE_DELTA_E and not thin_line):
            out[ys, xs][mine] = target
    return out


def snap_to_segments(labels: np.ndarray, band: np.ndarray) -> np.ndarray:
    """Moves each flat-colour region whole into its median band, unless it spans a wide
    depth range (sky, big fields), where the per-pixel band is kept. Band edges then
    follow the drawing's own outlines instead of cutting through shapes.
    """
    seg, n = segments(labels)
    ids = np.arange(1, n + 1)
    b = band.astype(np.float64)
    median = np.nan_to_num(np.asarray(ndimage.median(b, seg, ids)))
    spread = np.nan_to_num(np.sqrt(np.asarray(ndimage.variance(b, seg, ids))))
    snapped = np.concatenate([[0], np.rint(median)]).astype(band.dtype)[seg]
    keep = np.concatenate([[True], spread > SNAP_MAX_SPREAD])[seg]
    return np.where(keep, band, snapped)


def depth_bands(depth: np.ndarray) -> tuple[np.ndarray, list[float]]:
    """Band index per pixel (0 = farthest) and each band's --d (1 = at infinity)."""
    ground = depth[depth > SKY_DEPTH]
    qs = np.quantile(ground, np.linspace(0, 1, BANDS)[1:-1])
    edges = np.concatenate([[SKY_DEPTH + 0.5], qs])
    band = np.searchsorted(edges, depth, side="right")
    ds = []
    for k in range(BANDS):
        sel = depth[band == k]
        rep = 0.0 if k == 0 else float(np.median(sel))
        ds.append(round(1 - rep / 255, 3))
    return band, ds


def has_far_pixel_below(nearer: np.ndarray, reach: int) -> np.ndarray:
    """True where some pixel within `reach` rows below is not in `nearer`."""
    n = nearer.astype(np.int32)
    padded = np.concatenate([n, np.ones((reach, n.shape[1]), np.int32)])
    c = np.concatenate([np.zeros((1, n.shape[1]), np.int32), np.cumsum(padded, 0)])
    rows = np.arange(n.shape[0])
    count = c[rows + 1 + reach] - c[rows + 1]
    return count < reach


def band_masks(band: np.ndarray, ds: list[float]) -> list[np.ndarray]:
    """What each band's layer must draw: its own pixels, plus the nearer pixels a
    sinking layer would otherwise expose under nearer objects' lower edges.
    """
    disk = ndimage.generate_binary_structure(2, 1)
    masks = []
    for k in range(BANDS):
        own = band == k
        nearer = band > k
        reach = int(np.ceil(MAX_SHIFT * ds[k])) + 2 * DILATE
        strip = nearer & has_far_pixel_below(nearer, reach)
        mask = own | strip
        # Grow only underneath nearer layers: the overlap hides anti-aliasing seams
        # without giving a layer a visible halo of the background behind it.
        grown = ndimage.binary_dilation(mask, disk, iterations=DILATE) & nearer
        masks.append(mask | grown)
    return masks


def trace(flat: np.ndarray, mask: np.ndarray) -> list[tuple[str, str]]:
    """vtracer only sees the masked pixels; the rest is transparent."""
    rgba = np.dstack([flat, np.where(mask, 255, 0).astype(np.uint8)])
    rgba[~mask, :3] = 0
    h, w = mask.shape
    pixels = [tuple(p) for p in rgba.reshape(-1, 4).tolist()]
    svg = vtracer.convert_pixels_to_svg(pixels, (w, h), **VTRACER)
    return minify_paths(svg)


def steam_puffs(band: np.ndarray) -> dict[int, str]:
    """Animated puffs (the shared .steam class) over each cooling tower, keyed by the
    band of the tower top so they ride with the tower.
    """
    by_band: dict[int, list[str]] = {}
    for x, y in STEAM:
        k = int(band[y + TOP_PAD + 10, x])
        for i in range(STEAM_PUFFS):
            delay = -i * STEAM_PERIOD / STEAM_PUFFS
            by_band.setdefault(k, []).append(
                f'<circle class="steam" cx="{x}" cy="{y + TOP_PAD - 18}" r="26" fill="#f1f4f2" '
                f'style="--period:{STEAM_PERIOD}s;--delay:{delay:.1f}s;--wind:{60 + 12 * i}px"/>'
            )
    return {k: "".join(v) for k, v in by_band.items()}


def build_svg(
    layers: list[tuple[float, list[tuple[str, str]]]],
    shift: float | None,
    extras: dict[int, str] | None = None,
) -> str:
    """shift=None -> the real SVG (CSS does the parallax); a number -> a static preview
    with every band pre-shifted by shift * --d, as at the end of the scroll. `extras`
    maps a band index to markup drawn just in front of that band, at its depth.
    """
    extras = extras or {}
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">',
        f'<g transform="translate(0 -{TOP_PAD})">',
    ]
    for k, (d, paths) in enumerate(layers):
        attr = f' transform="translate(0 {shift * d:.1f})"' if shift is not None else ""
        out.append(f'<g class="px" style="--d:{d}"{attr}>')
        out.extend(f'<path fill="{f}" d="{p}"/>' for f, p in paths)
        out.append("</g>")
        if k in extras:
            out.append(f'<g class="px" style="--d:{d}">{extras[k]}</g>')
    out.append("</g></svg>")
    return "\n".join(out)


def render(svg: str, path: Path) -> None:
    # Magenta background: any hole the parallax opens shows up loudly.
    path.write_bytes(bytes(resvg_py.svg_to_bytes(svg_string=svg, background="#ff00ff")))


def main() -> None:
    PREVIEWS.mkdir(exist_ok=True)
    rgb = np.asarray(Image.open(BANNER).convert("RGB"))
    assert rgb.shape[:2] == (H, W), rgb.shape
    depth = np.asarray(Image.open(DEPTH).convert("L"))
    labels, palette = flatten(rgb, depth)
    Image.fromarray(palette[labels]).save(PREVIEWS / "1-flattened.png")
    if "--flatten-only" in sys.argv:
        return

    # Sky rows above the image, mirrored, for far layers to reveal as they sink.
    labels = np.concatenate([labels[TOP_PAD - 1 :: -1], labels])
    depth = np.concatenate([np.zeros((TOP_PAD, W), np.uint8), depth])
    band, ds = depth_bands(depth)
    band = snap_to_segments(labels, band)
    flat = palette[labels]
    masks = band_masks(band, ds)
    grey = np.linspace(0, 255, BANDS).astype(np.uint8)
    Image.fromarray(grey[band][TOP_PAD:]).save(PREVIEWS / "0-bands.png")

    layers = []
    for k, mask in enumerate(masks):
        paths = trace(flat, mask)
        layers.append((ds[k], paths))
        size = sum(len(p) for _, p in paths)
        print(
            f"band {k:2d}  --d {ds[k]:.3f}  {mask.mean():5.1%} of pixels  {len(paths):4d} paths  {size / 1000:6.1f} kB"
        )

    svg = build_svg(layers, None, steam_puffs(band))
    OUT_SVG.write_text(svg)
    print(f"wrote {OUT_SVG.name}: {len(svg) / 1000:.0f} kB, gzip {len(gzip.compress(svg.encode())) / 1000:.0f} kB")
    # Previews leave the steam out: without the page CSS the puffs would render solid.
    render(build_svg(layers, None), PREVIEWS / "2-traced.png")
    render(build_svg(layers, 40), PREVIEWS / "3-parallax-40.png")
    render(build_svg(layers, 60), PREVIEWS / "4-parallax-60.png")

    sheet = Image.new("RGB", (W, 3 * H))
    sheet.paste(Image.fromarray(rgb), (0, 0))
    sheet.paste(Image.open(PREVIEWS / "2-traced.png").convert("RGB"), (0, H))
    sheet.paste(Image.open(PREVIEWS / "3-parallax-40.png").convert("RGB"), (0, 2 * H))
    sheet.save(PREVIEWS / "5-before-after.png")


if __name__ == "__main__":
    main()
