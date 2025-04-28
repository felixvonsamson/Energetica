"""TODO"""

import math
from noise import pnoise2
import numpy as np

# Parameters
map_radius = 30
noise_scale = 10.0  # Bigger = larger features
noise_seed = 42
n_tiles = map_radius * (map_radius + 1) * 3 + 1
directions = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]


class Tile:
    def __init__(self, tile_id):
        self.id: int = tile_id
        self.coordinates: tuple[int, int] = id_to_coordinates(tile_id)
        self.altitude: float = None
        self.solar: float = None
        self.wind: float = None
        self.hydro: float = None
        self.coal: float = None
        self.gas: float = None
        self.uranium: float = None

        self.basin: int = None

    def get_neighbors(self, map) -> list[int]:
        """Return the neighbors of the tile."""
        neighbors = []
        for direction in directions:
            neighbor_id = coordinates_to_id(
                self.coordinates[0] + direction[0], self.coordinates[1] + direction[1]
            )
            if neighbor_id < n_tiles:
                neighbors.append(map[neighbor_id])
        return neighbors

    def square_coordinates(self) -> tuple[float, float]:
        """Return the real coordinates of the tile."""
        x = np.sqrt(3) * (self.coordinates[0] + 0.5 * self.coordinates[1])
        y = 1.5 * self.coordinates[1]
        return (x, y)


def id_to_coordinates(tile_id: int) -> tuple[int, int]:
    """Convert the id of a tile to its q and r coordinates (outwards spiral)."""

    def sgn(x: int) -> int:
        sgnArray = [0, 1, 1, 0, -1, -1]
        return sgnArray[x % 6]

    if tile_id == 0:
        return (0, 0)
    layer = 1 + math.floor((math.sqrt(12 * tile_id - 3) - 3) / 6)
    tile_id -= 3 * layer * (layer - 1) + 1
    edge = math.floor(tile_id / layer)
    position = tile_id % layer + 1
    q = sgn(edge + 2) * layer + sgn(edge + 4) * position
    r = sgn(edge) * layer + sgn(edge + 2) * position
    return (q, r)


def coordinates_to_id(q: int, r: int) -> int:
    """Convert the q and r coordinates of a tile to its id (outwards spiral)."""
    if q == 0 and r == 0:
        return 0
    layer = 0.5 * (abs(q) + abs(r) + abs(q + r))
    n = 3 * layer * (layer - 1)
    if q == layer:
        return int(n + r + 6 * layer)
    if q + r == layer:
        return int(n + r)
    if r == layer:
        return int(n + layer - q)
    if q == -layer:
        return int(n + 3 * layer - r)
    if q + r == -layer:
        return int(n + 3 * layer - r)
    return int(n + 4 * layer + q)


def generate_map() -> list[Tile]:
    """Generate a map of tiles with random features."""
    map = []
    for tile_id in range(n_tiles):
        tile = Tile(tile_id)
        map.append(tile)
    for tile in map:
        x, y = tile.square_coordinates()
        tile.altitude = generate_altitude(x, y)
    return map


def generate_altitude(x: float, y: float) -> float:
    """Generate the altitude of the tiles based on 2D perlin noise."""
    altitude_min = -5000
    altitude_max = 5000
    ocean_noise = pnoise2(
        0.3 * x / noise_scale, 0.3 * y / noise_scale, octaves=2, base=noise_seed
    )
    if ocean_noise < -0.25:
        return np.interp(ocean_noise, [-1, -0.25], [altitude_min, 0])
    mult = min(1, (ocean_noise + 0.25) * 2)
    terrain_noise = pnoise2(
        x / noise_scale, y / noise_scale, octaves=6, base=noise_seed
    )
    # altitude = np.clip(np.interp(noise_val, [-1, 1], [2*altitude_min, 2*altitude_max]), altitude_min, altitude_max)
    altitude = abs(terrain_noise) * mult * 2 * altitude_max
    return min(
        altitude_max,
        np.interp(ocean_noise, [-0.25, 1], [0, 0.2 * altitude_max]) + altitude,
    )


def check_for_basins(map: list[Tile]):
    """Assign basin IDs to each tile based on flow direction. -1 if it flows to ocean."""
    for tile in map:
        tile.basin = None
    for tile in map:
        if tile.basin is not None:
            continue
        path = []
        current = tile
        while True:
            path.append(current)
            # If we reached ocean
            if current.altitude <= 0:
                for t in path:
                    t.basin = -1
                break
            # If we encounter a tile that already has a basin assigned
            if current.basin is not None:
                for t in path:
                    t.basin = current.basin
                break
            # Find the neighbor with the lowest altitude
            neighbors = current.get_neighbors(map)
            lowest_neighbor = min(neighbors, key=lambda neighbor: neighbor.altitude)
            # If no neighbor is lower, this is a basin
            if lowest_neighbor.altitude >= current.altitude:
                basin_id = current.id
                for t in path:
                    t.basin = basin_id
                break
            # Otherwise flow downhill
            current = lowest_neighbor


def fix_basins(map: list[Tile]):
    """Removes basins by forming a valley."""
    basin_values = set()
    for tile in map:
        if tile.basin >= 0:
            basin_values.add(tile.basin)
    for tile_id in basin_values:
        current = map[tile_id]
        # find the closest ocean tile
        ocean_tiles = [t for t in map if t.altitude <= 0]
        closest_ocean_tile = min(
            ocean_tiles,
            key=lambda t: (t.coordinates[0] - current.coordinates[0]) ** 2
            + (t.coordinates[1] - current.coordinates[1]) ** 2,
        )
        while True:
            direction = (
                closest_ocean_tile.coordinates[0] - current.coordinates[0],
                closest_ocean_tile.coordinates[1] - current.coordinates[1],
            )
            # set of directions that are < 90 degrees from the direction to the ocean
            valid_directions = []
            for d in directions:
                if (d[0] * direction[0] + d[1] * direction[1]) > 0.1:
                    valid_directions.append(d)
            assert len(valid_directions) <= 3, "More than 3 valid directions"
            assert len(valid_directions) > 0, "no valid directions"
            tile_to_dig = None
            for vd in valid_directions:
                neighbor_tile_id = coordinates_to_id(
                    current.coordinates[0] + vd[0], current.coordinates[1] + vd[1]
                )
                if neighbor_tile_id < n_tiles:
                    if (
                        tile_to_dig is None
                        or map[neighbor_tile_id].altitude < tile_to_dig.altitude
                        and map[neighbor_tile_id].altitude > current.altitude + 1.5
                    ):
                        tile_to_dig = map[neighbor_tile_id]
            if tile_to_dig.altitude <= current.altitude:
                break
            tile_to_dig.altitude = current.altitude - 1
            current = tile_to_dig


def generate_rivers(map: list[Tile]):
    """Generate rivers flowing down form the mountains."""
    for tile in map:
        tile.hydro = 0
    # randomly sample 20 tiles with an altitude above 1000
    source_tiles = [tile for tile in map if tile.altitude > 1000]
    source_tiles = np.random.choice(source_tiles, round(0.01 * n_tiles), replace=False)
    for tile in source_tiles:
        current = tile
        flow_value = 1
        while True:
            # If we reached ocean
            if current.altitude <= 0:
                break
            current.hydro += flow_value
            flow_value += 0.1
            # Find the neighbor with the lowest altitude
            neighbors = current.get_neighbors(map)
            lowest_neighbor = min(neighbors, key=lambda neighbor: neighbor.altitude)
            # If no neighbor is lower, dig a valley
            if lowest_neighbor.altitude >= current.altitude:
                break
            # Otherwise flow downhill
            current = lowest_neighbor
    max_hydro = max([tile.hydro for tile in map])
    for tile in map:
        tile.hydro = math.sqrt(tile.hydro / max_hydro)
