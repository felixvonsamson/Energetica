"""Module for the `HexTile` class, which contains resource information, and which makes up the map."""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from typing import ClassVar

from flask import current_app

from energetica.database import db


@dataclass
class HexTile:
    """Class for the tiles that compose the map."""

    __next_id: ClassVar[int] = itertools.count()
    id: int

    coordinates: tuple[int, int]

    solar_potential: float
    wind_potential: float
    hydro_potential: float

    coal_reserves: float
    gas_reserves: float
    uranium_reserves: float

    climate_risk: int

    def __post_init__(self):
        """Post initialization method."""
        self.id = next(HexTile.__next_id)
        # TODO !! > current_app.config["engine"]players[self.id] = self

    def __repr__(self) -> str:
        """Return a string representation of the tile."""
        return f"<Tile {self.id}>"

    def get_neighbors(self, n: int = 1) -> list[HexTile]:
        """Return the neighbors of the tile plus the tile itself."""

        def get_hex_at_distance(q: int, r: int, distance: int) -> list[tuple[int, int]]:
            """Generate all hex coordinates within a given distance."""
            results = []
            results.extend(
                (q + dq, r + dr)
                for dq in range(-distance, distance + 1)
                for dr in range(max(-distance, -dq - distance), min(distance, -dq + distance) + 1)
            )
            return results

        neighbors = []
        tiles_at_distance = get_hex_at_distance(self.q, self.r, n)
        for q, r in tiles_at_distance:
            neighbor = HexTile.query.filter_by(q=q, r=r).first()
            if neighbor:
                neighbors.append(neighbor)
        return neighbors

    def get_downstream_tiles(self, n: int) -> list[HexTile]:
        """Return up to `n` many tiles that are downstream (related to hydro) from the current tile."""
        downstream_tiles = []

        def find_downstream(tile: HexTile, n: int) -> None:
            if n == 0:
                return
            for neighbor in tile.get_neighbors():
                if neighbor not in downstream_tiles and neighbor.hydro_potential > tile.hydro_potential:
                    downstream_tiles.append(neighbor)
                    find_downstream(neighbor, n - 1)

        find_downstream(self, n)
        return downstream_tiles
