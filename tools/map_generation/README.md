# Map generation

An offline tool for authoring the persistent world's hex map. It is not part of the game's code:
nothing imports it, and it does not ship with the `energetica` package. Its output files are its
only interface to the game.

- `map_generation.py` generates ten candidate maps and writes them as `map0.csv` to `map9.csv` in
  the current directory. It uses `energetica.sim.astro`, so run it with the project installed
  (`pip install -e '.[dev]'`), from this directory.
- `map_generation.pde` (with `Hex.pde` and `Button.pde`) is a [Processing](https://processing.org/)
  sketch that draws those files so you can compare them.

The game reads its map from `src/energetica/freeplay/data/map.csv`, which has the same columns.
