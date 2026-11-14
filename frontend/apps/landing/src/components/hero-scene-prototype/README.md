# PROTOTYPE: landing hero scene, round 2 (issue #1440)

Throwaway code on a throwaway branch. Not for merging.

**Question:** can the landing hero keep what works about the AI banner (its colour, its
recognisable facilities and its flat, slightly cartoonish look) while losing its excess
detail and AI artefacts, and gain depth (scroll parallax) and ambient motion? And can the
same pipeline produce the game's facility assets?

## Run it

```sh
cd frontend/apps/landing && bun run dev
```

Open http://localhost:5175/ and scroll. The floating bar (or the ← / → keys) switches
variants, and its − / + buttons change the parallax strength. The same settings work as
URL parameters: `?variant=…`, `?amp=40` (banner pixels), and `?s=0…1` to pin the scroll
position.

| `?variant=`    | What it is                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `projected`    | The hero rebuilt as a small 3D scene of analytic shapes, projected to flat SVG. Each object has its own real depth. |
| `facilities`   | The same 3D models rendered alone with one shared camera and sun, as game assets.                                   |
| `traced`       | The AI banner auto-traced to colour vector shapes, split into 16 depth bands using a depth map.                     |
| `raster-depth` | The AI banner, pixels unchanged, with WebGL depth-map parallax, steam, water, cloud drift and 3 spinning rotors.    |
| `original`     | The current AI banner.                                                                                              |

## How each is made

- `depth/`: a depth map of the banner from Depth Anything V2 Small (`make_depth.py`). It
  feeds `traced` and `raster-depth`.
- `projector/`: the 3D-to-SVG projector (`core.py`), the palette sampled from the banner,
  shared effects, and one module per facility in `facilities/`. `hero.py` composes the hero
  in banner pixels plus depth, and `gallery.py` renders the stand-alone assets.
  `FACILITY_BRIEF.md` is the API brief the facility modules were written against.
- `traced/`: `trace_banner.py` (bilateral flattening, a depth-aware k-means palette,
  vtracer per depth band).
- `raster-depth/`: `make_maps.py` (depth, water and sky masks, turbine blades painted out)
  plus the WebGL shaders.

The Python scripts need a throwaway venv with torch, transformers, vtracer and resvg_py,
kept outside the repo at `~/.cache/energetica-proto-1440/venv`:

```sh
python3 -m venv ~/.cache/energetica-proto-1440/venv
~/.cache/energetica-proto-1440/venv/bin/pip install torch transformers pillow numpy scipy vtracer resvg-py
~/.cache/energetica-proto-1440/venv/bin/python projector/hero.py      # and gallery.py, traced/trace_banner.py, ...
```

Scroll performance: with a dev server running, `bun bench/bench.ts http://localhost:5175
projected raster-depth original` scrolls each variant in headless Chrome. It reports frame
rate and main-thread time. Headless numbers are only comparable with each other.

`screenshots/` holds stills for the issue. They can't show the motion.
