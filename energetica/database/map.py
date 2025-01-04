"""Module for the `HexTile` class, which contains resource information, and which makes up the map."""
# TODO(mglst): rename this file to `hex_tile.py`

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from energetica.database import DBModel

if TYPE_CHECKING:
    from energetica.database.player import Player


@dataclass
class HexTile(DBModel):
    """Class for the tiles that compose the map."""

    coordinates: tuple[int, int]  # q, r

    solar_potential: float
    wind_potential: float
    hydro_potential: float

    climate_risk: int

    reserves: dict[str, float] = field(default_factory=lambda: {"coal": 0, "gas": 0, "uranium": 0})

    player: Player | None = None

    def __repr__(self) -> str:
        """Return a string representation of the tile."""
        return f"<Tile {self.id}>"

    def get_neighbors(self, n: int = 1) -> list[HexTile]:
        """Return the neighbors of the tile plus the tile itself."""

        def get_hex_at_distance(q: int, r: int, distance: int) -> list[tuple[int, int]]:
            """Generate all hex coordinates within a given distance."""
            results: list[tuple[int, int]] = []
            results.extend(
                (q + dq, r + dr)
                for dq in range(-distance, distance + 1)
                for dr in range(max(-distance, -dq - distance), min(distance, -dq + distance) + 1)
            )
            return results

        neighbors = []
        tiles_at_distance = get_hex_at_distance(*self.coordinates, n)
        for q, r in tiles_at_distance:
            neighbor = next(HexTile.filter_by(coordinates=(q, r)), None)
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
