"""TODO"""

import heapq
import math
import pickle

import numpy as np
from noise import pnoise2

# Parameters
map_radius = 210
noise_scale = 10.0  # Bigger = larger features
noise_seed = 13
n_tiles = map_radius * (map_radius + 1) * 3 + 1
directions = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
altitude_min = -5000
altitude_max = 5000


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
        self.shore: bool = False
        self.valid: bool = True
        self.flow_direction: tuple[int, int] = None
        self.region: int = None
        self.type: str = None

    def get_neighbors(self, map) -> list[int]:
        """Return the neighbors of the tile."""
        neighbors = []
        for direction in directions:
            neighbor_id = coordinates_to_id(self.coordinates[0] + direction[0], self.coordinates[1] + direction[1])
            if neighbor_id in map:
                neighbors.append(map[neighbor_id])
        return neighbors

    def square_coordinates(self) -> tuple[float, float]:
        """Return the real coordinates of the tile."""
        x = np.sqrt(3) * (self.coordinates[0] + 0.5 * self.coordinates[1])
        y = 1.5 * self.coordinates[1]
        return (x, y)

    def __lt__(self, other):
        """Define the less-than operator for tiles based on their IDs."""
        return self.id < other.id


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
    """Generate a map of tiles with no features."""
    map = {}
    for tile_id in range(n_tiles):
        tile = Tile(tile_id)
        map[tile_id] = tile
    return map


def trace_regions(map: dict[int, Tile]):
    """Trace the regions of the map."""
    region_size = 10

    def assign_region(center_tile: Tile, region_id: int):
        region_tiles = [
            t
            for t in map.values()
            if max(
                abs(t.coordinates[0] - center_tile.coordinates[0]),
                abs(t.coordinates[1] - center_tile.coordinates[1]),
                abs(t.coordinates[0] + t.coordinates[1] - center_tile.coordinates[0] - center_tile.coordinates[1]),
            )  # noqa: E501
            < region_size
        ]
        # if the majority of the tiles of the region have a negative altitude, assign the region to -1
        if len([t for t in region_tiles if t.altitude < 0]) > 0.6 * len(region_tiles):
            region_id = -1
        for tile in region_tiles:
            tile.region = region_id
        # Assign the special types to the center tiles
        if region_id != -1:
            center_tiles = {
                "network": center_tile,
                "industry": map[coordinates_to_id(center_tile.coordinates[0] + 1, center_tile.coordinates[1] - 1)],
                "laboratory": map[coordinates_to_id(center_tile.coordinates[0], center_tile.coordinates[1] - 1)],
                "warehouse": map[coordinates_to_id(center_tile.coordinates[0] - 1, center_tile.coordinates[1])],
                "carbon_capture": map[
                    coordinates_to_id(center_tile.coordinates[0] - 1, center_tile.coordinates[1] + 1)
                ],
                "politics": map[coordinates_to_id(center_tile.coordinates[0], center_tile.coordinates[1] + 1)],
                "News": map[coordinates_to_id(center_tile.coordinates[0] + 1, center_tile.coordinates[1])],
            }
            for type, tile in center_tiles.items():
                tile.type = type
                tile.altitude += 10**6
            center_tile.altitude += 10**5

    region_id = 0
    center_coordinates = [0, 0]
    assign_region(map[coordinates_to_id(*center_coordinates)], region_id)
    directions = [(1, 1), (-1, 2), (-2, 1), (-1, -1), (1, -2), (2, -1)]
    for i in range(math.floor(0.5 * map_radius / region_size)):
        radius = region_size
        center_coordinates[0] += radius * directions[0][0]
        center_coordinates[1] += radius * directions[0][1]
        for j in range(6):
            for k in range(i + 1):
                region_id += 1
                tile_id = coordinates_to_id(*center_coordinates)
                if tile_id in map:
                    assign_region(map[tile_id], region_id)
                center_coordinates[0] += radius * directions[(j + 2) % 6][0]
                center_coordinates[1] += radius * directions[(j + 2) % 6][1]
    tiles_to_remove = []
    for tile in map.values():
        neighbors = tile.get_neighbors(map)
        if len([t for t in neighbors if t.region is not None]) < 3:
            tiles_to_remove.append(tile.id)
    for tile_id in tiles_to_remove:
        map.pop(tile_id)


def generate_oceans(map: dict[int, Tile]):
    """Generate oceans using a large perlin noise with few details"""
    for tile in map.values():
        x, y = tile.square_coordinates()
        ocean_noise = pnoise2(0.3 * x / noise_scale, 0.3 * y / noise_scale, octaves=2, base=noise_seed) - max(
            0,
            0.04
            * (
                max(
                    abs(tile.coordinates[0] - tile.coordinates[1]),
                    abs(tile.coordinates[0] + 2 * tile.coordinates[1]),
                    abs(2 * tile.coordinates[0] + tile.coordinates[1]),
                )
                - 1.4 * map_radius
            ),
        )
        if ocean_noise < -0.25:
            tile.altitude = np.interp(ocean_noise, [-1, -0.25], [altitude_min, 0])
        else:
            tile.altitude = np.interp(ocean_noise, [-0.25, 1], [0, 0.5 * altitude_max])


def generate_mountains(map: dict[int, Tile]) -> float:
    """Generate mountains onn the continent using 2D perlin noise."""
    for tile in map.values():
        if tile.altitude > 0:
            x, y = tile.square_coordinates()
            mult = min(1, 10 * tile.altitude / altitude_max)
            terrain_noise = pnoise2(0.5 * x / noise_scale, 0.5 * y / noise_scale, octaves=6, base=noise_seed)
            # altitude = np.clip(np.interp(noise_val, [-1, 1], [2*altitude_min, 2*altitude_max]), altitude_min, altitude_max)
            altitude = (terrain_noise * 2.2) ** 2 * mult * altitude_max
            tile.altitude = min(
                altitude_max,
                tile.altitude + altitude,
            )


def check_for_basins(map: dict[int, Tile]):
    """Assign basin IDs to each tile based on flow direction. -1 if it flows to ocean."""
    for tile in map.values():
        tile.basin = None
    for tile in map.values():
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


def dist_to_nearest_ocean(tile: Tile, map: dict[int, Tile]) -> float:
    """Return the distance to the nearest ocean tile."""
    x_tile, y_tile = tile.square_coordinates()
    ocean_tiles = [t for t in map.values() if t.altitude <= 0]
    minimum_distance = min(
        [
            math.sqrt((t.square_coordinates()[0] - x_tile) ** 2 + (t.square_coordinates()[1] - y_tile) ** 2)
            for t in ocean_tiles
        ]
    )
    return minimum_distance


def a_star_basin_breach(start_tile, map: dict[int, Tile]):
    open_set = []
    heapq.heappush(open_set, (0, start_tile, 0))

    came_from = {}
    g_score = {start_tile: 0}

    while open_set:
        _, current, path_length = heapq.heappop(open_set)
        if current.basin == -1 and current.altitude < start_tile.altitude - path_length:
            # Reconstruct the path
            path = [current]
            while current in came_from:
                current = came_from[current]
                path.append(current)
            return path[::-1]  # Return reversed path
        for neighbor in current.get_neighbors(map):
            elevation_diff = neighbor.altitude - current.altitude
            step_cost = neighbor.altitude + 10 * max(0, elevation_diff) + 30
            tenative_g_score = g_score[current] + step_cost
            if neighbor not in g_score or tenative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tenative_g_score
                f_score = tenative_g_score + dist_to_nearest_ocean(neighbor, map) * 30
                heapq.heappush(open_set, (f_score, neighbor, path_length + 1))


def fix_basins(map: dict[int, Tile]):
    """Removes basins by forming a valley."""
    for tile in map.values():
        if tile.basin >= 0 and tile.altitude < 200:
            tile.altitude = 200 + np.random.uniform(0, 200)
    check_for_basins(map)
    basin_values = set()
    for tile in map.values():
        if tile.basin >= 0:
            basin_values.add(tile.basin)
    basin_values = sorted(basin_values, key=lambda x: map[x].altitude)
    for n, tile_id in enumerate(basin_values):
        path = a_star_basin_breach(map[tile_id], map)
        for i, tile in enumerate(path):
            tile.altitude = min(tile.altitude, path[0].altitude - i)
            tile.basin = -1
        basin_tiles = [t for t in map.values() if t.basin == tile_id]
        for t in basin_tiles:
            t.basin = -1
        print(f"Fixed basin {tile_id} with {len(path)} tiles ({n}/{len(basin_values)})")


def generate_rivers(map: dict[int, Tile]):
    """Generate rivers flowing down form the mountains."""
    for tile in map.values():
        tile.hydro = 0

    total_hydro = 0
    valid_source_tiles = [tile for tile in map.values() if tile.altitude > 1000 and tile.altitude < 4000]
    while total_hydro < 0.1 * n_tiles:
        tile = np.random.choice(valid_source_tiles)
        neighbors = tile.get_neighbors(map)
        if not any([t.hydro != 0 for t in neighbors]):
            current = tile
            flow_value = 1
            while True:
                # If we reached ocean
                if current.altitude <= 0:
                    break
                current.hydro += flow_value
                total_hydro += 1
                flow_value += 0.1
                # Find the neighbor with the lowest altitude
                neighbors = current.get_neighbors(map)
                lowest_neighbor = min(neighbors, key=lambda neighbor: neighbor.altitude)
                current = lowest_neighbor

    max_hydro = max([tile.hydro for tile in map.values()])
    for tile in map.values():
        tile.hydro = math.sqrt(tile.hydro / max_hydro)


def assign_types(map: dict[int, Tile]):
    """Assigning types to the tiles on the map"""
    for tile in map.values():
        if tile.type is not None:
            tile.altitude = 100
            continue
        if tile.hydro > 0:
            tile.type = "river"
        elif tile.altitude < 0:
            if tile.altitude < -750:
                tile.type = "deep_ocean"
            else:
                tile.type = "shallow_ocean"
        elif tile.altitude > 1000:
            if tile.altitude > 3000:
                tile.type = "mountain_peak"
            elif tile.altitude > 2000:
                tile.type = "mountain"
            else:
                tile.type = "hill"
        else:
            tile.type = "land"
        if tile.region is None:
            tile.type = "border"


def generate_solar(map: dict[int, Tile]):
    """Generate solar potential based latitude and altitude."""
    # TODO: This should be derivate from the games weather model.
    for tile in map.values():
        if tile.type not in ["land", "mountain", "hill"]:
            tile.solar = None
        else:
            tile.solar = min(
                0.999,
                math.cos((tile.coordinates[1] + map_radius) / (2 * map_radius) * 0.48 * math.pi)
                * (0.5 + 0.6 * (tile.altitude / 3000)),
            )


def generate_wind(map: dict[int, Tile]):
    """Generate wind potential."""
    for tile in map.values():
        tile.wind = 0
    for tile in map.values():
        if tile.altitude <= 750:
            tile.wind += 0.35
        elif tile.altitude <= 0:
            tile.wind += 0.1
        else:
            if tile.altitude > 2000:
                tile.wind += 0.1
            neighbors = tile.get_neighbors(map)
            if all([tile.altitude > neighbor.altitude for neighbor in neighbors]):
                tile.wind += 0.15

        x, y = tile.square_coordinates()
        tile.wind += abs(pnoise2(2 * x / noise_scale, 2 * y / noise_scale, octaves=3, base=noise_seed + 1))
        tile.wind = min(1, tile.wind)
        if tile.type not in ["land", "mountain", "hill", "shallow_ocean", "deep_ocean"]:
            tile.wind = None


def generate_coal(map: dict[int, Tile]):
    """Generate coal reserves."""
    for tile in map.values():
        x, y = tile.square_coordinates()
        coal_noise = (pnoise2(0.5 * x / noise_scale, 0.5 * y / noise_scale, octaves=1, base=noise_seed + 2) * 1.5) ** 2
        coal_noise += abs(pnoise2(3 * x / noise_scale, 3 * y / noise_scale, octaves=4, base=noise_seed + 3)) * 0.5
        tile.coal = min(1, coal_noise)
        if tile.type not in ["land", "hill"]:
            tile.coal = None


def generate_gas(map: dict[int, Tile]):
    """Generate gas reserves."""
    for tile in map.values():
        x, y = tile.square_coordinates()
        gas_noise = (pnoise2(0.5 * x / noise_scale, y / noise_scale, octaves=2, base=noise_seed + 4) * 2) ** 2
        tile.gas = min(1, gas_noise)
        if tile.type not in ["land", "hill"]:
            tile.gas = None


def generate_uranium(map: dict[int, Tile]):
    """Generate uranium reserves."""
    for tile in map.values():
        x, y = tile.square_coordinates()
        uranium_noise = (abs(pnoise2(x / noise_scale, y / noise_scale, octaves=5, base=noise_seed + 5)) * 2.5) ** 3
        uranium_noise = (
            uranium_noise
            * abs(pnoise2(0.2 * x / noise_scale, 0.2 * y / noise_scale, octaves=1, base=noise_seed + 6))
            * 2
        )
        tile.uranium = min(1, uranium_noise)
        if tile.type not in ["land", "hill"]:
            tile.uranium = None


def save_map(map: dict[int, Tile]):
    """Save the map to a pickle file."""
    map_data = {
        tile.id: {
            "coordinates": tile.coordinates,
            "altitude": tile.altitude,
            "solar": tile.solar,
            "wind": tile.wind,
            "hydro": tile.hydro,
            "coal": tile.coal,
            "gas": tile.gas,
            "uranium": tile.uranium,
            "region": tile.region,
        }
        for tile in map.values()
    }
    with open("map.pck", "wb") as f:
        pickle.dump(map_data, f)
    # save a second version called map_min.pck with only the id, altitude, wind, hydro, coal, gas, uranium
    map_data_min = {
        tile.id: {
            "altitude": tile.altitude,
            "wind": tile.wind,
            "hydro": tile.hydro,
            "coal": tile.coal,
            "gas": tile.gas,
            "uranium": tile.uranium,
        }
        for tile in map.values()
    }
    with open("map_min.pck", "wb") as f:
        pickle.dump(map_data_min, f)


# Map Generation code sequence:
print("Generating empty tiles...")
hexmap = generate_map()
print("Generating oceans...")
generate_oceans(hexmap)
print("Generating mountains...")
generate_mountains(hexmap)
print("Tracing regions...")
trace_regions(hexmap)
print("Checking for basins...")
check_for_basins(hexmap)
print("Fixing basins...")
fix_basins(hexmap)
print("Checking for basins again...")
check_for_basins(hexmap)
print("Generating rivers...")
generate_rivers(hexmap)
print("Assigning tile types...")
assign_types(hexmap)
print("Generating solar potential...")
generate_solar(hexmap)
print("Generating wind potential...")
generate_wind(hexmap)
print("Generating coal reserves...")
generate_coal(hexmap)
print("Generating gas reserves...")
generate_gas(hexmap)
print("Generating uranium reserves...")
generate_uranium(hexmap)
print("Saving map...")
save_map(hexmap)
print("Map generation complete.")
