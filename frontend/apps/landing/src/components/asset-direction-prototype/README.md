# PROTOTYPE (#1469): facility asset visual direction

Throwaway code on the branch `prototype-asset-direction`. Never merge it.

It answers this question: can one set of 3D facility models, projected to flat SVG with a fixed
map camera, give facility assets that read at map-tile size and don't look bland? It also puts
the open style questions from the brief (palette, light, lines, texture) side by side.

## Looking at it

The renders are not checked in (about 28 MB), so generate them first, as described under
"Regenerating the renders" below. Then:

```sh
cd frontend/apps/landing && bun run dev
```

Then open http://localhost:5175/prototype/asset-direction. The floating bar at the bottom (or
the ← / → keys) picks the palette for sections 2 to 5. Section 1 always shows every palette.
The page background buttons check how the assets sit on paper, pine green and dark.

`screenshots/` holds the contact sheets posted on #1469.

## Sharing it as one file

`projector/export_html.py` writes `export/energetica-asset-direction-1469.html` (about 4 MB,
gitignored). It contains every render and works offline in any current browser, so it can be
sent as an attachment. Run it after `render.py`.

## Regenerating the renders

The projector is plain Python. `resvg_py` is only needed for the PNG previews. It uses the
throwaway venv from #1440, kept outside the repo:

```sh
python3 -m venv ~/.cache/energetica-proto-1440/venv   # once
~/.cache/energetica-proto-1440/venv/bin/pip install resvg_py pillow
cd projector
~/.cache/energetica-proto-1440/venv/bin/python render.py          # everything, about 30 s
~/.cache/energetica-proto-1440/venv/bin/python render.py --png    # also PNGs in previews/
~/.cache/energetica-proto-1440/venv/bin/python render.py --quick wind solar  # fast iteration
```

## What is where

- `projector/core.py`: the 3D-to-SVG projector from #1440 (`origin/prototype-hero-3d`), plus
  `OrthoCamera`, a parallel projection for the map camera.
- `projector/facilities/`: the facility models from #1440. `wind.py` gained an offshore
  foundation.
- `projector/tiles.py`: hex tiles (grass, water), and where each facility sits on its tile.
- `projector/palettes.py`: the three palettes. Chart colours are softened in OKLCH (lightness
  clamped, chroma capped) and routed into each facility's signature parts.
- `projector/stylize.py`: lines and texture, applied as a pass over the finished SVG.
- `projector/render.py`: the camera, the light presets and the list of renders. Writes
  `renders/` and `renders/manifest.json`.
- `asset-direction-prototype.tsx`: the gallery page, mounted at `/prototype/asset-direction`.
