"""
Generate a hex map: each tile's renewable potentials, fuel reserves and climate risk.

:func:`generate_map` builds one map from a random source and returns it. :func:`write_csv` writes a
map in the format of the persistent world's ``freeplay/data/map.csv``. Generating never writes a
file, and never touches the interpreter-wide :mod:`random` state, so a server can call it in-process.

Run as a script, it writes ten candidate maps, ``map0.csv`` to ``map9.csv``, to the current
directory (see docs/backend/world-map.md)::

    python -m energetica.worldmap.generation [--seed SEED]
"""

from __future__ import annotations

import argparse
import functools
import math
import random
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, fields
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType

import numpy as np

from energetica.sim.astro import direct_horizontal_irradiance

__all__ = ["MapTile", "generate_map", "write_csv"]

# The map is a hexagon of hexagonal tiles, SIZE_PARAM rings around a centre tile.
SIZE_PARAM = 10
MAP_SIZE = SIZE_PARAM * (SIZE_PARAM + 1) * 3 + 1

DIRECTIONS = ((1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1))

# What a fraction of 1 of each fuel is in kg, the unit the game counts reserves in.
COAL_RESERVE_KG = 2_000_000_000
GAS_RESERVE_KG = 600_000_000
URANIUM_RESERVE_KG = 8_000_000
# Turns a climate risk between 0 and 1 into a level from 0 to 10.
CLIMATE_RISK_LEVELS = 10.9


@dataclass(frozen=True)
class MapTile:
    """
    One tile of a generated map, in the units the game reads.

    The renewable potentials and ``score`` are fractions between 0 and 1. The fuel reserves are in
    kg, and ``climate_risk`` is a level from 0 to 10.
    """

    q: int
    r: int
    solar: float
    wind: float
    hydro: float
    coal: float
    gas: float
    uranium: float
    climate_risk: int
    score: float


CSV_COLUMNS = tuple(field.name for field in fields(MapTile))


class _Tile:
    """A tile while its map is being generated, with every resource still a fraction between 0 and 1."""

    def __init__(self, tile_id: int, tiles: list[_Tile]) -> None:
        """Initialize a tile of the map `tiles`, which holds every tile at the index of its id."""
        self.id: int = tile_id
        self.tiles = tiles
        coords = id_to_coordinates(tile_id)
        self.q: int = coords[0]
        self.r: int = coords[1]
        self.solar: float = 0.0
        self.wind: float = 0.0
        self.hydro: float = 0.0
        self.coal: float = 0.0
        self.gas: float = 0.0
        self.uranium: float = 0.0
        self.risk: float = 0.0
        self.score: float = 0.0

    def __str__(self) -> str:
        """A string representation of the tile."""
        return f"Tile {self.id}"

    def is_on_border(self) -> bool:
        """Returns True if the tile is on the border of the map."""
        return abs(self.q) == SIZE_PARAM or abs(self.r) == SIZE_PARAM or abs(self.q + self.r) == SIZE_PARAM

    def get_neighbors(self) -> list[_Tile]:
        """Return the neighbors of the tile."""
        neighbors = []
        for direction in DIRECTIONS:
            neighbor_id = coordinates_to_id(self.q + direction[0], self.r + direction[1])
            if neighbor_id < MAP_SIZE:
                neighbors.append(self.tiles[neighbor_id])
        return neighbors

    def n_neighbors18(self) -> int:
        """Return the number of tile in a 2-hexagon radius around the tile."""
        neighbors18 = []
        for neighbor in self.get_neighbors():
            neighbors18.append(neighbor)
            for neighbor2 in neighbor.get_neighbors():
                if neighbor2 not in neighbors18:
                    neighbors18.append(neighbor2)
        return len(neighbors18)

    def dist(self, tile: _Tile) -> float:
        """Return the distance between the tile and another tile."""
        return math.sqrt(2 * (self.q - tile.q) ** 2 + (self.r - tile.r) ** 2 + (self.q - tile.q) * (self.r - tile.r))

    def sigmoid_probability(self, inverted: bool = False) -> float:
        """Return the probability of occurrence of heat and cold waves based on the latitude."""

        def cdf(x: float) -> float:
            return (3 * np.log(math.exp(x / 3) + math.exp(-1 / 3)) + 0.88) / 11.44

        lower_bound = -0.5
        upper_bound = 0.5
        cdf_lower = cdf(-self.r + lower_bound if inverted else self.r + lower_bound)
        cdf_upper = cdf(-self.r + upper_bound if inverted else self.r + upper_bound)
        n_latitudes = 2 * SIZE_PARAM + 1 - abs(self.r)
        return (cdf_upper - cdf_lower) / n_latitudes

    def normal_probability(self) -> float:
        """Return the probability of occurrence of wildfires based on the latitude."""

        def cdf(x: float) -> float:
            return (1 / (1 + np.exp(-(x - 2.5) / 3.5)) - 0.02) / 0.88

        lower_bound = -0.5
        upper_bound = 0.5
        cdf_lower = cdf(self.r + lower_bound)
        cdf_upper = cdf(self.r + upper_bound)
        n_latitudes = 2 * SIZE_PARAM + 1 - abs(self.r)
        return (cdf_upper - cdf_lower) / n_latitudes

    def get_downstream_tiles(self, n: int) -> list[_Tile]:
        """Return up to `n` many tiles that are downstream (related to hydro) from the current tile."""
        downstream_tiles = []

        def find_downstream(tile: _Tile, n: int) -> None:
            if n == 0:
                return
            for neighbor in tile.get_neighbors():
                if neighbor not in downstream_tiles and neighbor.hydro > tile.hydro:
                    downstream_tiles.append(neighbor)
                    find_downstream(neighbor, n - 1)

        find_downstream(self, n)
        return downstream_tiles


def id_to_coordinates(tile_id: int) -> tuple[int, int]:
    """Convert the id of a tile to its coordinates (outwards spiral)."""

    def sgn(x: int) -> int:
        signs = [0, 1, 1, 0, -1, -1]
        return signs[x % 6]

    if tile_id == 0:
        return (0, 0)
    ring = 1 + math.floor((math.sqrt(12 * tile_id - 3) - 3) / 6)
    tile_id -= 3 * ring * (ring - 1) + 1
    side = math.floor(tile_id / ring)
    step = tile_id % ring + 1
    x = sgn(side + 2) * ring + sgn(side + 4) * step
    y = sgn(side) * ring + sgn(side + 2) * step
    return (x, y)


def coordinates_to_id(x: int, y: int) -> int:
    """Convert the coordinates of a tile to its id (outwards spiral)."""
    if x == 0 and y == 0:
        return 0
    ring = 0.5 * (abs(x) + abs(y) + abs(x + y))
    n = 3 * ring * (ring - 1)
    if x == ring:
        return int(n + y + 6 * ring)
    if x + y == ring:
        return int(n + y)
    if y == ring:
        return int(n + ring - x)
    if x == -ring:
        return int(n + 3 * ring - y)
    if x + y == -ring:
        return int(n + 3 * ring - y)
    return int(n + 4 * ring + x)


def generate_map(rng: random.Random) -> list[MapTile]:
    """
    Generate a map, drawing every random choice from `rng`.

    The same seed gives the same map. The tiles are in id order, an outward spiral from the centre.
    """
    tiles: list[_Tile] = []
    for i in range(MAP_SIZE):
        tiles.append(_Tile(i, tiles))
    generate_solar(tiles, calculate_solar_potentials())
    generate_hydro(tiles, rng)
    calculate_risk(tiles)
    generate_coal(tiles, rng)
    generate_gas(tiles, rng)
    generate_uranium(tiles, rng)
    generate_wind(tiles, rng)
    generate_background_resources(tiles, rng)
    for tile in tiles:
        tile.risk = round(tile.risk, 1)
    max_score = 0.0
    min_score = 0.0
    for tile in tiles:
        tile.score = tile.solar + tile.wind + tile.hydro + tile.coal + tile.gas + tile.uranium - tile.risk
        if tile.score > max_score:
            max_score = tile.score
        if tile.score < min_score:
            min_score = tile.score
    for tile in tiles:
        tile.score = (tile.score - min_score) / (max_score - min_score)
    return [
        MapTile(
            q=tile.q,
            r=tile.r,
            solar=tile.solar,
            wind=tile.wind,
            hydro=tile.hydro,
            coal=tile.coal * COAL_RESERVE_KG,
            gas=tile.gas * GAS_RESERVE_KG,
            uranium=tile.uranium * URANIUM_RESERVE_KG,
            climate_risk=math.floor(tile.risk * CLIMATE_RISK_LEVELS),
            score=tile.score,
        )
        for tile in tiles
    ]


def write_csv(tiles: Iterable[MapTile], path: Path) -> None:
    """Write a map to `path` as CSV, with the columns of the persistent world's map.csv."""
    with open(path, "w", encoding="utf-8") as f:
        f.write(",".join(CSV_COLUMNS) + "\n")
        for tile in tiles:
            f.write(",".join(f"{getattr(tile, column)}" for column in CSV_COLUMNS) + "\n")


@functools.cache
def calculate_solar_potentials() -> Mapping[int, float]:
    """Calculate the solar potentials for each latitude."""
    # The year starts at midnight UTC, matching the longitude of 0 passed below. It used to start at
    # the local midnight of whichever machine ran this, so the same seed gave different maps.
    start_date = datetime(2023, 1, 1, tzinfo=UTC).timestamp()
    end_date = datetime(2024, 1, 1, tzinfo=UTC).timestamp()
    timesteps = np.linspace(start_date, end_date, 365 * 24)
    rows = range(-10, 11)
    latitudes = np.array([(r - 10) * 85 / 21 for r in rows])
    potentials = direct_horizontal_irradiance(timesteps[None, :], latitudes[:, None], 0).mean(axis=1)
    potentials /= potentials.max()
    # Read-only, because the cache hands the same mapping to every caller.
    return MappingProxyType(dict(zip(rows, potentials)))


def generate_solar(tiles: list[_Tile], potentials: Mapping[int, float]) -> None:
    """Generate solar resources on the map based on the internal clear sky model and depending on the latitude."""
    for tile in tiles:
        tile.solar = potentials[tile.r]


def generate_hydro(tiles: list[_Tile], rng: random.Random) -> None:
    """Generate rivers from the border to the center of the map."""

    def count_hydro_neighbors(tile: _Tile) -> int:
        count = 0
        for neighbor in tile.get_neighbors():
            if neighbor.hydro > 0 or neighbor in sources:
                count += 1
        return count

    def non_adjacent_tiles(candidates: list[_Tile]) -> list[_Tile]:
        if candidates[0] in candidates[1].get_neighbors():
            if candidates[0] in candidates[2].get_neighbors():
                return [candidates[1], candidates[2]]
            else:
                return [candidates[0], candidates[2]]
        else:
            return [candidates[0], candidates[1]]

    random_border_id = rng.randint(0, 6 * SIZE_PARAM - 1)
    for i in range(2):
        sources = []
        random_border_id = (random_border_id + rng.randint(2 * SIZE_PARAM, 4 * SIZE_PARAM)) % (6 * SIZE_PARAM)
        source_tile = tiles[MAP_SIZE - random_border_id - 1]
        while count_hydro_neighbors(source_tile) != 0:
            random_border_id = (random_border_id + rng.randint(0, SIZE_PARAM)) % (6 * SIZE_PARAM)
            source_tile = tiles[MAP_SIZE - random_border_id - 1]
        sources = [source_tile]
        hydro_value = 1.0
        while sources:
            start_tile = sources.pop(0)
            start_tile.hydro = hydro_value
            hydro_value -= 0.01
            if hydro_value <= 0.2:
                break
            possible_upstream_tiles = start_tile.get_neighbors()
            filtered_tiles = []
            for tile in possible_upstream_tiles:
                if tile.is_on_border() or count_hydro_neighbors(tile) > 1:
                    continue
                filtered_tiles.append(tile)
            if len(filtered_tiles) >= 3 and rng.random() < 0.5 - 0.3 * hydro_value:
                hydro_value -= 0.05
                if hydro_value <= 0.2:
                    break
                next_tiles = non_adjacent_tiles(filtered_tiles)
                sources.append(next_tiles[0])
                sources.append(next_tiles[1])
            elif len(filtered_tiles) > 0:
                next_tile = rng.choice(filtered_tiles)
                sources.append(next_tile)


def calculate_risk(tiles: list[_Tile]) -> None:
    """Calculate the climate risk of each tile based on the cost of climate events and their probability."""
    heatwave_event_probability = (
        1.016  # calculated as the integral of the probability density function spread overt one year
    )
    heatwave_cost = 0.3 * 3  # industry cost fraction times the duration in days
    for tile in tiles:
        tile_probability = tile.sigmoid_probability()
        tile.risk += tile_probability * heatwave_event_probability * heatwave_cost
        for neighbor in tile.get_neighbors():
            tile.risk += neighbor.sigmoid_probability() * heatwave_event_probability * heatwave_cost

    coldwave_event_probability = 1.016
    coldwave_cost = 0.3 * 3
    for tile in tiles:
        tile_probability = tile.sigmoid_probability(inverted=True)
        tile.risk += tile_probability * coldwave_event_probability * coldwave_cost
        for neighbor in tile.get_neighbors():
            tile.risk += neighbor.sigmoid_probability(inverted=True) * coldwave_event_probability * coldwave_cost

    wildfire_event_probability = 1.13
    wildfire_cost = 0.6 * 2
    for tile in tiles:
        tile_probability = tile.normal_probability()
        tile.risk += tile_probability * wildfire_event_probability * wildfire_cost
        for neighbor in tile.get_neighbors():
            tile.risk += neighbor.normal_probability() * wildfire_event_probability * wildfire_cost

    flood_event_probability = 0.8
    flood_cost = 0.5 * 6
    hydro_count = 0
    for tile in tiles:
        if tile.hydro > 0.2:
            hydro_count += 1
    for tile in tiles:
        if tile.hydro > 0.2:
            tile.risk += flood_event_probability * flood_cost / hydro_count
            downstream_tiles = tile.get_downstream_tiles(10)
            for downstream_tile in downstream_tiles:
                downstream_tile.risk += 0.04 * flood_event_probability * flood_cost / hydro_count

    hurricane_event_probability = 0.2
    hurricane_cost = 0.8 * 7
    for tile in tiles:
        tile.risk += hurricane_event_probability * hurricane_cost / MAP_SIZE * tile.n_neighbors18()

    max_risk = 0.0
    for tile in tiles:
        if tile.risk > max_risk:
            max_risk = tile.risk
    for tile in tiles:
        tile.risk = tile.risk / max_risk


def generate_coal(tiles: list[_Tile], rng: random.Random) -> None:
    """Generate coal resources on the map as big patches."""

    def extend_patch(patch: list[_Tile], coal_value: float) -> None:
        while patch:
            tile = patch.pop(0)
            tile.coal = min(1, coal_value)
            coal_value -= rng.random() * 0.025
            if coal_value <= 0:
                return
            for neighbor in tile.get_neighbors():
                if neighbor.coal == 0 and neighbor not in patch:
                    patch.append(neighbor)

    for tile in tiles:
        tile.score += tile.hydro
        if tile.hydro > 0:
            for neighbor in tile.get_neighbors():
                neighbor.score += tile.hydro / 10
    for i in range(3):
        for tile in tiles:
            if tile.score > 0:
                for neighbor in tile.get_neighbors():
                    neighbor.score += tile.score / 12

    first_tile = None
    second_tile = None
    for tile in tiles:
        if tile.score < 0.05 and first_tile is None:
            first_tile = tile
        if tile.score < 0.04 and first_tile is not None and second_tile is None and tile.dist(first_tile) > SIZE_PARAM:
            second_tile = tile

    if first_tile is None:
        first_tile = rng.choice(tiles)
    if second_tile is None:
        second_tile = rng.choice(tiles)
        while second_tile.dist(first_tile) < 0.7 * SIZE_PARAM:
            second_tile = rng.choice(tiles)

    coal_value = 1.1
    patch = [first_tile]
    extend_patch(patch, coal_value)
    coal_value = 0.8
    patch = [second_tile]
    extend_patch(patch, coal_value)


def generate_gas(tiles: list[_Tile], rng: random.Random) -> None:
    """Generate gas resources on the map as veins."""

    def count_gas_neighbors(tile: _Tile) -> int:
        count = 0
        for neighbor in tile.get_neighbors():
            if neighbor.gas > 0 or neighbor in vein:
                count += 1
        return count

    for tile in tiles:
        tile.score = tile.solar + tile.hydro + tile.coal - tile.risk

    gas_count = 0
    while gas_count < 0.3 * MAP_SIZE:
        random_tile = rng.choice(tiles)
        vein = []
        trials = 0
        while (random_tile.score > 0.15 or count_gas_neighbors(random_tile) > 0) and trials < 25:
            random_tile = rng.choice(tiles)
            trials += 1
        while random_tile.score > 0.2 or count_gas_neighbors(random_tile) > 2:
            random_tile = rng.choice(tiles)

        vein = [random_tile]
        gas_value = 1.0
        while vein:
            tile = vein.pop(0)
            tile.gas = min(1, gas_value)
            gas_count += 1
            gas_value += 0.2 * (rng.random() - 0.8)
            if gas_value <= 0.2:
                break
            for neighbor in tile.get_neighbors():
                if (
                    count_gas_neighbors(neighbor) <= 2
                    and neighbor.score < 0.25
                    and neighbor.gas == 0
                    and neighbor not in vein
                ):
                    vein.append(neighbor)


def generate_uranium(tiles: list[_Tile], rng: random.Random) -> None:
    """Generate uranium resources on the map as isolated groups of tiles."""
    for tile in tiles:
        tile.score = tile.solar + tile.hydro + tile.coal + tile.gas - tile.risk

    count_uranium = 0
    threshold = 0.0
    while count_uranium < 0.15 * MAP_SIZE:
        for tile in tiles:
            if tile.score < threshold and tile.uranium == 0:
                tile.uranium = max(0, min(1, 0.8 * rng.random() + 0.3 - threshold))
                count_uranium += 1
        threshold += 0.05


def generate_wind(tiles: list[_Tile], rng: random.Random) -> None:
    """Generate wind resources on the map trying to balance all tiles."""
    for tile in tiles:
        tile.score = tile.solar + tile.hydro + tile.coal + tile.gas + tile.uranium - tile.risk

    for tile in tiles:
        tile.wind = min(1, max(0.01 + 0.05 * rng.random(), 1.2 - tile.score + 0.2 * rng.random()))


def generate_background_resources(tiles: list[_Tile], rng: random.Random) -> None:
    """Generate low amount of background resources on each tile."""

    def equilibrator(score: float) -> float:
        return 0.3 * (max_score - score) / (max_score - min_score)

    max_score = 0.0
    min_score = 0.0
    for tile in tiles:
        tile.score = tile.solar + tile.wind + tile.hydro + tile.coal + tile.gas + tile.uranium - tile.risk
        if tile.score > max_score:
            max_score = tile.score
        if tile.score < min_score:
            min_score = tile.score

    for tile in tiles:
        if tile.hydro < 0.1:
            tile.score -= tile.hydro
            tile.hydro = min(0.199, max(0.01, -0.05 + 0.2 * rng.random() + equilibrator(tile.score)))
            tile.score += tile.hydro
            if tile.score > max_score:
                max_score = tile.score
        if tile.coal < 0.1:
            tile.score -= tile.coal
            tile.coal = max(0, -0.02 + 0.22 * rng.random() + equilibrator(tile.score))
            tile.score += tile.coal
            if tile.score > max_score:
                max_score = tile.score
        if tile.gas < 0.1:
            tile.score -= tile.gas
            tile.gas = max(0, -0.04 + 0.2 * rng.random() + equilibrator(tile.score))
            tile.score += tile.gas
            if tile.score > max_score:
                max_score = tile.score
        if tile.uranium < 0.1:
            tile.score -= tile.uranium
            tile.uranium = max(0, -0.1 + 0.2 * rng.random() + equilibrator(tile.score))
            tile.score += tile.uranium


def main() -> None:
    """Write ten candidate maps to the current directory, all drawn from one seed."""
    parser = argparse.ArgumentParser(description="Write ten candidate maps, map0.csv to map9.csv, to this directory.")
    parser.add_argument("--seed", type=int, help="seed for the random source (default: a random seed)")
    args = parser.parse_args()
    seed = args.seed if args.seed is not None else random.SystemRandom().randrange(2**32)
    print(f"Seed: {seed}")
    rng = random.Random(seed)
    for m in range(10):
        write_csv(generate_map(rng), Path(f"map{m}.csv"))
        print(f"Map {m} saved.")


if __name__ == "__main__":
    main()
