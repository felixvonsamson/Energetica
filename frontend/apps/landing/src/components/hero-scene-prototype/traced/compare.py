"""PROTOTYPE (issue #1440): stacks 1:1 crops of the original and the previews, for review.

python compare.py x0 y0 x1 y1 out.png preview.png [preview.png ...]
"""

import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
BANNER = HERE.parents[2] / "assets" / "energetica_landing_banner.webp"

x0, y0, x1, y1 = map(int, sys.argv[1:5])
out = sys.argv[5]
images = [Image.open(BANNER)] + [Image.open(HERE / "previews" / p) for p in sys.argv[6:]]
crops = [im.convert("RGB").crop((x0, y0, x1, y1)) for im in images]
sheet = Image.new("RGB", (x1 - x0, (y1 - y0) * len(crops)))
for i, c in enumerate(crops):
    sheet.paste(c, (0, i * (y1 - y0)))
sheet.save(HERE / "previews" / out)
