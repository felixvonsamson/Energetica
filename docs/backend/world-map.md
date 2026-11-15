# World Map

The persistent world is set on a hex map: 331 hexagonal tiles in ten rings around a centre tile.
Each tile has a potential for each renewable (solar, wind, hydro), a reserve of each fuel (coal,
gas, uranium) and a climate risk. The game reads the map from
`backend/src/energetica/freeplay/data/map.csv` when it creates a new world.

## Generating a map

`energetica.worldmap.generation` generates maps. `generate_map(rng)` takes a `random.Random` and
returns the map as a list of `MapTile`, in the units the game reads. The same seed always gives
the same map, and generating writes no file. `write_csv(tiles, path)` writes a map in the format
of `map.csv`.

Run as a script, it writes ten candidate maps, `map0.csv` to `map9.csv`, to the current
directory. It prints the seed it used. Pass the seed back with `--seed` to write the same ten maps
again:

```
python -m energetica.worldmap.generation --seed 1234
```

Each file has one row per tile and these columns:

| Column                   | Meaning                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| `q`, `r`                 | The tile's axial hex coordinates. `r` is its latitude                         |
| `solar`, `wind`, `hydro` | Renewable potentials, from 0 to 1                                             |
| `coal`, `gas`, `uranium` | Fuel reserves                                                                 |
| `climate_risk`           | Climate risk level, from 0 to 10                                              |
| `score`                  | How good the tile is overall, from 0 (worst) to 1 (best). The game ignores it |

## How the current map was chosen

The map the game ships was chosen by hand:

1. Run the generator to write ten candidate maps.
2. Compare them and pick one. They were compared by eye, drawn by a
   [Processing](https://processing.org/) sketch that read the ten CSV files. The sketch was
   removed in #1112; git history still has it, under `tools/map_generation/`.
3. Copy the chosen file over `backend/src/energetica/freeplay/data/map.csv`.

The shipped `map.csv` is the `map1.csv` of such a run. That run predates seeding, so its seed is
unknown and the map cannot be generated again. Its solar column also differs slightly, from the
fifth significant figure, from what the generator now computes. The generator then started the year
at the local midnight of the machine that ran it, Zurich time for this map, and now starts it at
midnight UTC.

Generating a map for each new run, and letting a facilitator choose it, is planned in #1065.
