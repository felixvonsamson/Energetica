"""PROTOTYPE: estimates a depth map for the landing banner with Depth Anything V2 Small.

Writes banner-depth.png next to this file: 8-bit greyscale, same size as the banner,
255 = nearest, 0 = farthest (the model's relative inverse depth, normalised).

Needs the throwaway venv (torch + transformers), not the project's .venv:
  ~/.cache/energetica-proto-1440/venv/bin/python make_depth.py
"""

from pathlib import Path

import numpy as np
from PIL import Image
from transformers import pipeline

HERE = Path(__file__).parent
BANNER = HERE.parents[2] / "assets" / "energetica_landing_banner.webp"

image = Image.open(BANNER).convert("RGB")
estimate = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device="mps")
depth = np.asarray(estimate(image)["predicted_depth"].squeeze(), dtype=np.float32)
depth = np.asarray(Image.fromarray(depth).resize(image.size, Image.BICUBIC))
lo, hi = np.percentile(depth, [0.5, 99.5])
out = np.clip((depth - lo) / (hi - lo), 0, 1) * 255
Image.fromarray(out.astype(np.uint8)).save(HERE / "banner-depth.png")
print("wrote", HERE / "banner-depth.png", image.size)
