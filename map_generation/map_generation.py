"""This file generates 10 maps for the game Energetica with the resources and climate risks."""

import math
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from pvlib.location import Location
from scipy.stats import norm

# Parameters
size_param = 10
mapsize = size_param * (size_param + 1) * 3 + 1

directions = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]


class Tile:
    def __init__(self, tile_id):
        self.id = tile_id
        coords = id_to_coordinates(tile_id)
        self.q = coords[0]
        self.r = coords[1]
        self.solar = 0
        self.wind = 0
        self.hydro = 0
        self.coal = 0
        self.gas = 0
        self.uranium = 0
        self.risk = 0
        self.score = 0

    def __str__(self):
        return f"Tile {self.id}"

    def is_on_border(self):
        """Returns True if the tile is on the border of the map."""
        return abs(self.q) == size_param or abs(self.r) == size_param or abs(self.q + self.r) == size_param

    def get_neighbors(self):
        """Returns the neighbors of the tile."""
        neighbors = []
        for direction in directions:
            neighbor_id = coordinates_to_id(self.q + direction[0], self.r + direction[1])
            if neighbor_id < mapsize:
                neighbors.append(map[neighbor_id])
        return neighbors

    def n_neighbors18(self):
        """Returns the number of tile in a 2-hexagon radius around the tile."""
        neighbors18 = []
        for neighbor in self.get_neighbors():
            neighbors18.append(neighbor)
            for neighbor2 in neighbor.get_neighbors():
                if neighbor2 not in neighbors18:
                    neighbors18.append(neighbor2)
        return len(neighbors18)

    def dist(self, tile):
        """Returns the distance between the tile and another tile."""
        return math.sqrt(2 * (self.q - tile.q) ** 2 + (self.r - tile.r) ** 2 + (self.q - tile.q) * (self.r - tile.r))

    def sigmoid_probability(self, inverted=False):
        """
        This function is used for heat and cold waves and returns the probability of occurrence based on the latitude.
        """

        def cdf(x):
            return (3 * np.log(math.exp(x / 3) + math.exp(-1 / 3)) + 0.88) / 11.44

        lower_bound = -0.5
        upper_bound = 0.5
        cdf_lower = cdf(-self.r + lower_bound if inverted else self.r + lower_bound)
        cdf_upper = cdf(-self.r + upper_bound if inverted else self.r + upper_bound)
        n_latitudes = 2 * size_param + 1 - abs(self.r)
        return (cdf_upper - cdf_lower) / n_latitudes

    def normal_probability(self):
        """Returns the probability of occurrence of wildfires based on the latitude."""

        def cdf(x):
            return (1 / (1 + np.exp(-(x - 2.5) / 3.5)) - 0.02) / 0.88

        lower_bound = -0.5
        upper_bound = 0.5
        cdf_lower = cdf(self.r + lower_bound)
        cdf_upper = cdf(self.r + upper_bound)
        n_latitudes = 2 * size_param + 1 - abs(self.r)
        return (cdf_upper - cdf_lower) / n_latitudes

    def get_downstream_tiles(self, n):
        """returns up to `n` many tiles that are downstream (related to hydro) from the current tile"""
        downstream_tiles = []

        def find_downstream(tile, n):
            if n == 0:
                return
            for neighbor in tile.get_neighbors():
                if neighbor not in downstream_tiles and neighbor.hydro > tile.hydro:
                    downstream_tiles.append(neighbor)
                    find_downstream(neighbor, n - 1)

        find_downstream(self, n)
        return downstream_tiles


def id_to_coordinates(tile_id):
    """Converts the id of a tile to its coordinates. (outwards spiral)"""

    def sgn(x):
        sgnArray = [0, 1, 1, 0, -1, -1]
        return sgnArray[x % 6]

    if tile_id == 0:
        return (0, 0)
    L = 1 + math.floor((math.sqrt(12 * tile_id - 3) - 3) / 6)
    tile_id -= 3 * L * (L - 1) + 1
    S = math.floor(tile_id / L)
    R = tile_id % L + 1
    x = sgn(S + 2) * L + sgn(S + 4) * R
    y = sgn(S) * L + sgn(S + 2) * R
    return (x, y)


def coordinates_to_id(x, y):
    """Converts the coordinates of a tile to its id. (outwards spiral)"""
    if x == 0 and y == 0:
        return 0
    L = 0.5 * (abs(x) + abs(y) + abs(x + y))
    n = 3 * L * (L - 1)
    if x == L:
        return int(n + y + 6 * L)
    if x + y == L:
        return int(n + y)
    if y == L:
        return int(n + L - x)
    if x == -L:
        return int(n + 3 * L - y)
    if x + y == -L:
        return int(n + 3 * L - y)
    return int(n + 4 * L + x)


def save_as_csv(map, m):
    """Saves the map as a csv file."""
    with open(f"map{m}.csv", "w") as f:
        f.write("q,r,solar,wind,hydro,coal,gas,uranium,climate_risk,score\n")
        for tile in map:
            f.write(
                f"{tile.q},{tile.r},{tile.solar},{tile.wind},{tile.hydro},{tile.coal * 2_000_000_000},{tile.gas * 600_000_000},{tile.uranium * 8_000_000},{math.floor(tile.risk*10.9)},{tile.score}\n"
            )
    print(f"Map {m} saved.")


def calculate_solar_potentials():
    """Calculates the solar potentials for each latitude with pvlib."""
    start_date = datetime(2023, 1, 1)
    time_steps = []
    for d in range(72):
        day_of_year = d * 365 // 72
        for t in range(216):
            time_of_day = 4 * 3600 + t * 3600 * 18 // 216
            time_steps.append(start_date + timedelta(days=day_of_year, seconds=time_of_day))
    time_steps = pd.DatetimeIndex(time_steps)

    potentials = {}
    max_potential = 0
    for r in range(-10, 11):
        latitude = (r - 10) * 85 / 21
        loc = Location(latitude, 0)
        clear_sky = loc.get_clearsky(time_steps)["ghi"]
        potentials[r] = clear_sky.mean()
        if potentials[r] > max_potential:
            max_potential = potentials[r]
    for pot in potentials:
        potentials[pot] = potentials[pot] / max_potential
    return potentials


def generate_solar(map, potentials):
    """Generates solar resources on the map based on the pvlib clear sky model and depending on the latitude."""
    for tile in map:
        tile.solar = potentials[tile.r]


def generate_hydro(map):
    """Generates rivers from the border to the center of the map."""

    def count_hydro_neighbors(tile):
        count = 0
        for neighbor in tile.get_neighbors():
            if neighbor.hydro > 0 or neighbor in sources:
                count += 1
        return count

    def non_adjacent_tiles(tiles):
        if tiles[0] in tiles[1].get_neighbors():
            if tiles[0] in tiles[2].get_neighbors():
                return [tiles[1], tiles[2]]
            else:
                return [tiles[0], tiles[2]]
        else:
            return [tiles[0], tiles[1]]

    random_border_id = random.randint(0, 6 * size_param - 1)
    for i in range(2):
        sources = []
        random_border_id = (random_border_id + random.randint(2 * size_param, 4 * size_param)) % (6 * size_param)
        source_tile = map[mapsize - random_border_id - 1]
        while count_hydro_neighbors(source_tile) != 0:
            random_border_id = (random_border_id + random.randint(0, size_param)) % (6 * size_param)
            source_tile = map[mapsize - random_border_id - 1]
        sources = [source_tile]
        hydro_value = 1
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
            if len(filtered_tiles) >= 3 and random.random() < 0.5 - 0.3 * hydro_value:
                hydro_value -= 0.05
                if hydro_value <= 0.2:
                    break
                next_tiles = non_adjacent_tiles(filtered_tiles)
                sources.append(next_tiles[0])
                sources.append(next_tiles[1])
            elif len(filtered_tiles) > 0:
                next_tile = random.choice(filtered_tiles)
                sources.append(next_tile)


def calculate_risk(map):
    """Calculates the climate risk of each tile based on the cost of climate events and their probability."""
    heatwave_event_probability = (
        1.016  # calculated as the integral of the probability density function spread overt one year
    )
    heatwave_cost = 0.3 * 3  # industry cost fraction times the duration in days
    for tile in map:
        tile_probability = tile.sigmoid_probability()
        tile.risk += tile_probability * heatwave_event_probability * heatwave_cost
        for neighbor in tile.get_neighbors():
            tile.risk += neighbor.sigmoid_probability() * heatwave_event_probability * heatwave_cost

    coldwave_event_probability = 1.016
    coldwave_cost = 0.3 * 3
    for tile in map:
        tile_probability = tile.sigmoid_probability(inverted=True)
        tile.risk += tile_probability * coldwave_event_probability * coldwave_cost
        for neighbor in tile.get_neighbors():
            tile.risk += neighbor.sigmoid_probability(inverted=True) * coldwave_event_probability * coldwave_cost

    wildfire_event_probability = 1.13
    wildfire_cost = 0.6 * 2
    for tile in map:
        tile_probability = tile.normal_probability()
        tile.risk += tile_probability * wildfire_event_probability * wildfire_cost
        for neighbor in tile.get_neighbors():
            tile.risk += neighbor.normal_probability() * wildfire_event_probability * wildfire_cost

    flood_event_probability = 0.8
    flood_cost = 0.5 * 6
    hydro_count = 0
    for tile in map:
        if tile.hydro > 0.2:
            hydro_count += 1
    for tile in map:
        if tile.hydro > 0.2:
            tile.risk += flood_event_probability * flood_cost / hydro_count
            downstream_tiles = tile.get_downstream_tiles(10)
            for downstream_tile in downstream_tiles:
                downstream_tile.risk += 0.04 * flood_event_probability * flood_cost / hydro_count

    hurricane_event_probability = 0.2
    hurricane_cost = 0.8 * 7
    for tile in map:
        tile.risk += hurricane_event_probability * hurricane_cost / mapsize * tile.n_neighbors18()

    max_risk = 0
    for tile in map:
        if tile.risk > max_risk:
            max_risk = tile.risk
    for tile in map:
        tile.risk = tile.risk / max_risk


def generate_coal(map):
    """Generates coal resources on the map as big patches."""

    def extend_patch(patch, coal_value):
        while patch:
            tile = patch.pop(0)
            tile.coal = min(1, coal_value)
            coal_value -= random.random() * 0.025
            if coal_value <= 0:
                return
            for neighbor in tile.get_neighbors():
                if neighbor.coal == 0 and neighbor not in patch:
                    patch.append(neighbor)

    for tile in map:
        tile.score += tile.hydro
        if tile.hydro > 0:
            for neighbor in tile.get_neighbors():
                neighbor.score += tile.hydro / 10
    for i in range(3):
        for tile in map:
            if tile.score > 0:
                for neighbor in tile.get_neighbors():
                    neighbor.score += tile.score / 12

    first_tile = None
    second_tile = None
    for tile in map:
        if tile.score < 0.05 and first_tile is None:
            first_tile = tile
        if tile.score < 0.04 and second_tile is None and tile.dist(first_tile) > size_param:
            second_tile = tile

    if first_tile is None:
        first_tile = random.choice(map)
    if second_tile is None:
        second_tile = random.choice(map)
        while second_tile.dist(first_tile) < 0.7 * size_param:
            second_tile = random.choice(map)

    coal_value = 1.1
    patch = [first_tile]
    extend_patch(patch, coal_value)
    coal_value = 0.8
    patch = [second_tile]
    extend_patch(patch, coal_value)


def generate_gas(map):
    """Generates gas resources on the map as veins."""

    def count_gas_neighbors(tile):
        count = 0
        for neighbor in tile.get_neighbors():
            if neighbor.gas > 0 or neighbor in vein:
                count += 1
        return count

    for tile in map:
        tile.score = tile.solar + tile.hydro + tile.coal - tile.risk

    gas_count = 0
    while gas_count < 0.3 * mapsize:
        random_tile = random.choice(map)
        vein = []
        trials = 0
        while (random_tile.score > 0.15 or count_gas_neighbors(random_tile) > 0) and trials < 25:
            random_tile = random.choice(map)
            trials += 1
        while random_tile.score > 0.2 or count_gas_neighbors(random_tile) > 2:
            random_tile = random.choice(map)

        vein = [random_tile]
        gas_value = 1
        while vein:
            tile = vein.pop(0)
            tile.gas = min(1, gas_value)
            gas_count += 1
            gas_value += 0.2 * (random.random() - 0.8)
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


def generate_uranium(map):
    """Generates uranium resources on the map as isolated groups of tiles."""
    for tile in map:
        tile.score = tile.solar + tile.hydro + tile.coal + tile.gas - tile.risk

    count_uranium = 0
    threshold = 0
    while count_uranium < 0.15 * mapsize:
        for tile in map:
            if tile.score < threshold and tile.uranium == 0:
                tile.uranium = max(0, min(1, 0.8 * random.random() + 0.3 - threshold))
                count_uranium += 1
        threshold += 0.05


def generate_wind(map):
    """Generates wind resources on the map trying to balance all tiles."""
    for tile in map:
        tile.score = tile.solar + tile.hydro + tile.coal + tile.gas + tile.uranium - tile.risk

    for tile in map:
        tile.wind = min(1, max(0.01 + 0.05 * random.random(), 1.2 - tile.score + 0.2 * random.random()))


def generate_background_resources(map):
    """Generates low amount of background resources on each tile."""

    def equilibrator(score):
        return 0.3 * (max_score - score) / (max_score - min_score)

    max_score = 0
    min_score = 0
    for tile in map:
        tile.score = tile.solar + tile.wind + tile.hydro + tile.coal + tile.gas + tile.uranium - tile.risk
        if tile.score > max_score:
            max_score = tile.score
        if tile.score < min_score:
            min_score = tile.score

    for tile in map:
        if tile.hydro < 0.1:
            tile.score -= tile.hydro
            tile.hydro = min(0.199, max(0.01, -0.05 + 0.2 * random.random() + equilibrator(tile.score)))
            tile.score += tile.hydro
            if tile.score > max_score:
                max_score = tile.score
        if tile.coal < 0.1:
            tile.score -= tile.coal
            tile.coal = max(0, -0.02 + 0.22 * random.random() + equilibrator(tile.score))
            tile.score += tile.coal
            if tile.score > max_score:
                max_score = tile.score
        if tile.gas < 0.1:
            tile.score -= tile.gas
            tile.gas = max(0, -0.04 + 0.2 * random.random() + equilibrator(tile.score))
            tile.score += tile.gas
            if tile.score > max_score:
                max_score = tile.score
        if tile.uranium < 0.1:
            tile.score -= tile.uranium
            tile.uranium = max(0, -0.1 + 0.2 * random.random() + equilibrator(tile.score))
            tile.score += tile.uranium


solar_potentials = calculate_solar_potentials()
for m in range(10):
    map = []
    for i in range(mapsize):
        map.append(Tile(i))
    generate_solar(map, solar_potentials)
    generate_hydro(map)
    calculate_risk(map)
    generate_coal(map)
    generate_gas(map)
    generate_uranium(map)
    generate_wind(map)
    generate_background_resources(map)
    for tile in map:
        tile.risk = round(tile.risk, 1)
    max_score = 0
    min_score = 0
    for tile in map:
        tile.score = tile.solar + tile.wind + tile.hydro + tile.coal + tile.gas + tile.uranium - tile.risk
        if tile.score > max_score:
            max_score = tile.score
        if tile.score < min_score:
            min_score = tile.score
    for tile in map:
        tile.score = (tile.score - min_score) / (max_score - min_score)
    save_as_csv(map, m)
