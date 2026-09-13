#!/usr/bin/env python3
"""
Convert raster images under src/energetica/static/images/ to WebP (#1073).

Usage: python scripts/dev/optimize_images.py [--dry-run]

Run this after adding a PNG or JPEG export to the image tree. It rewrites each
file as WebP at the size and quality its directory calls for, deletes the
original, and prints what changed. Files that are already WebP are skipped, so
running it twice does nothing the second time -- re-encoding a lossy file only
degrades it.

Requires the cwebp encoder: `brew install webp` or `apt-get install webp`.

`scripts/guard-image-weight.ts` enforces the result in CI, so a heavy PNG that
skips this script fails the build rather than reaching production.
"""

import shutil
import struct
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).parent.parent.parent
IMAGE_ROOT = ROOT / "src/energetica/static/images"


class Policy(NamedTuple):
    """How wide a group's images may be, and how hard to compress them."""

    max_width: int
    quality: int


# Each cap is about twice the largest size the group is ever displayed at, which
# covers 2x displays with nothing to spare:
#
#   landing_page/  tiles render ~560 CSS px wide, the lightbox at most 1024
#                  (max-w-5xl in landing-page.tsx); the hero banner and the
#                  educators photo span a max-w-6xl column, so 1152
#   wiki/          figures sit in a max-w-4xl prose column, so 896 CSS px
#   facilities,    the card thumbnail is a few hundred px and the detail dialog
#   technologies   is max-w-4xl, so again 896 CSS px
#
# The illustrations take a lower quality than the screenshots because they are
# painted artwork. Lossy encoders betray themselves through ringing -- faint
# halos alongside a hard edge, where the encoder cannot represent an abrupt
# jump in colour -- and painted artwork has few such edges for it to show up
# against. The landing banners and wiki figures are screenshots full of small
# text, which is nothing but hard edges, so they keep more headroom. That
# headroom is also what makes it safe to re-encode the handful of JPEG sources
# here: at these qualities WebP reproduces the JPEG's own artifacts rather than
# adding to them.
POLICIES: list[tuple[str, Policy]] = [
    ("landing_page/", Policy(max_width=2400, quality=85)),
    ("wiki/", Policy(max_width=1800, quality=85)),
    ("technologies/", Policy(max_width=1344, quality=82)),
    ("_facilities/", Policy(max_width=1344, quality=82)),
]
DEFAULT_POLICY = Policy(max_width=1600, quality=85)

# Files that stay in their original format, named one by one rather than by
# directory. icon_green.png is the PWA icon, which manifest.json declares as
# "image/png", and is also the icon Web Push notifications render.
# icons/quiz.png is 3.5 KB, where conversion buys nothing.
#
# Exempting the whole icons/ directory would be easier to write and wrong: it
# would wave through a heavy PNG dropped in there later, which is the mistake
# this script exists to prevent. A new icon either converts like everything
# else or earns its own line here with a reason.
#
# guard-image-weight.ts anchors its copy of this list at the tree root, so this
# one compares whole paths for the same reason. An unanchored match here would
# skip a file the guard then fails, and the failure would tell you to run this
# script -- the one that just skipped it.
EXEMPT_FILES = ("icon_green.png", "icons/quiz.png")

GREEN, RESET = "\033[92m", "\033[0m"


def policy_for(relative_path: str) -> Policy:
    for prefix, policy in POLICIES:
        if prefix in relative_path:
            return policy
    return DEFAULT_POLICY


def is_exempt(relative_path: Path) -> bool:
    """Whether this file keeps its original format. Anchored at the tree root."""
    return relative_path.as_posix() in EXEMPT_FILES


def png_width(data: bytes) -> int:
    """Width from the IHDR chunk, which the spec requires to come first."""
    return struct.unpack(">I", data[16:20])[0]


def jpeg_width(data: bytes) -> int:
    """Width from the frame header.

    Walking the marker chain is the only reliable way in: a phone photo carries
    an Exif thumbnail whose own dimensions appear earlier in the file, so
    anything that just scans for the first size finds the wrong one.
    """
    offset = 2  # past the SOI marker
    while offset < len(data):
        if data[offset] != 0xFF:
            break
        marker = data[offset + 1]
        # SOF0-SOF15 carry the real dimensions; DHT (C4), JPG (C8) and DAC (CC)
        # share the range but are not frame headers.
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            return struct.unpack(">H", data[offset + 7 : offset + 9])[0]
        (segment_length,) = struct.unpack(">H", data[offset + 2 : offset + 4])
        offset += 2 + segment_length
    raise ValueError("no JPEG frame header found")


def image_width(path: Path) -> int:
    data = path.read_bytes()
    return png_width(data) if path.suffix == ".png" else jpeg_width(data)


def main() -> int:
    dry_run = "--dry-run" in sys.argv[1:]

    if shutil.which("cwebp") is None:
        print(
            "error: cwebp not found. Install it with 'brew install webp' or 'apt-get install webp'.",
            file=sys.stderr,
        )
        return 1

    sources = sorted(
        path
        for pattern in ("*.png", "*.jpg", "*.jpeg")
        for path in IMAGE_ROOT.rglob(pattern)
        if not is_exempt(path.relative_to(IMAGE_ROOT))
    )

    total_before = total_after = converted = 0
    for source in sources:
        relative = source.relative_to(IMAGE_ROOT)
        max_width, quality = policy_for(str(relative))
        width = image_width(source)

        before = source.stat().st_size
        if dry_run:
            print(f"would convert {relative}: {width}px -> {min(width, max_width)}px, q{quality}")
            continue

        target = source.with_suffix(".webp")
        command = ["cwebp", "-quiet", "-q", str(quality), "-metadata", "none"]
        # cwebp upscales when asked to, so only pass -resize when it shrinks.
        if width > max_width:
            command += ["-resize", str(max_width), "0"]
        subprocess.run([*command, str(source), "-o", str(target)], check=True)

        after = target.stat().st_size
        total_before += before
        total_after += after
        converted += 1
        source.unlink()
        print(f"{str(relative):<56} {before:>8} -> {after:>7} bytes  −{100 - after * 100 / before:.1f}%")

    if total_before and not dry_run:
        saved = 100 - total_after * 100 / total_before
        print(f"\n{GREEN}{converted} files: {total_before:,} -> {total_after:,} bytes (−{saved:.1f}%){RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
