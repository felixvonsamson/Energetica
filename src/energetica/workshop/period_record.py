"""What a settled Trading period did at each of its settlement points, kept whole for its review (#1007).

The engine in :mod:`~energetica.workshop.trading` adds a Trading period up into each player's result. The
review charts need more: power over time for each player's facility types and for the whole market, and
the merit order at any settlement point. A :class:`TradingPeriodRecord` keeps all of it, at every
settlement point the period cleared. Unlike the persistent world's charts, nothing is averaged into
coarser resolutions.

A settlement point is one clearing of one simulated day. Points are numbered in time order from 0, so
point ``day * clearings_per_day + clearing`` is clearing ``clearing`` of the ``day``-th simulated day.
Power is in W and stored energy in Wh, as the market sees them: a representative day is not scaled to the
season here.

**Time series.** For each pool (one player's operating facilities of one type), at each point:

- ``generation``: what it produced, sold plus dumped. For storage, what it discharged.
- ``dumped``: the renewable output that did not sell.
- ``charged``: what storage bought to charge.
- ``stored``: the energy storage held once the point was over. Zero for a facility that stores nothing.

What a pool sold is ``generation - dumped``. These come from the settlement, so they match what players
were paid. For each demand tier, ``served`` is what it bought.

**Merit orders.** Every bid of the period is kept, whether it sold or not. A period's prices are locked, so
each bid line (one pool's offer, one storage pool's bid to charge, or one demand tier's bid) has the same
player, facility and price at every point; only the power it offered changes. The record keeps the lines
once and ``offered`` holds each one's power at each point. :meth:`TradingPeriodRecord.merit_order` sorts
them back into the merit order the market cleared. Lines are kept in the order they were placed, so bids
at the same price come out in the order the market saw them.

**Blackouts.** At the point the grid went down, ``blackout_at``, the market cleared but settled nothing:
its merit order shows why, its price is the unbounded must-serve bid, ``math.inf``, and its series are
zero. Points after it never cleared: their price and quantity are NaN, they have no merit order, and
their series are zero apart from ``stored``, which holds steady.

A record is saved to its own compressed NumPy file, apart from the session file, since a full season's
record can take megabytes.
"""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import numpy as np
import numpy.typing as npt

from energetica.sim.market import Fill, MarketEntry, merit_order, order_columns
from energetica.workshop.atomic_file import write_atomically
from energetica.workshop.seasons import Season

Side = Literal["offer", "demand"]
Array = npt.NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class BidLine:
    """One bid placed at every settlement point of a period, at a fixed price."""

    side: Side
    player_id: int
    """The player's id, or a demand tier's reserved negative id."""
    facility: str
    """The facility type, or a demand tier's label."""
    price: float
    must_run: bool = False


@dataclass(frozen=True, slots=True)
class MeritOrder:
    """The market at one settlement point, in the shape of the persistent world's merit-order chart."""

    point: int
    offers: dict[str, list]
    """Offers sorted by price, as :func:`~energetica.sim.market.order_columns`, plus ``cleared``: the W of
    each that sold."""
    demands: dict[str, list]
    """Demands sorted by price, highest first, in the same shape. ``cleared`` is the W of each that was
    bought."""
    price: float
    quantity: float


@dataclass(frozen=True, eq=False)
class TradingPeriodRecord:
    """Everything one Trading period did at each settlement point. Arrays have one column per point."""

    round: int
    season: Season
    clearings_per_day: int
    days: tuple[int, ...]
    """The day of the year of each simulated day, in order."""
    blackout_at: int | None
    """The point the grid went down at, or None if it held."""
    price: Array
    """The price each point settled at, in $/MWh."""
    quantity: Array
    """The power each point cleared, in W."""
    pools: tuple[tuple[int, str], ...]
    """Each pool's player id and facility type: the rows of the pool series."""
    generation: Array
    dumped: Array
    charged: Array
    stored: Array
    tiers: tuple[str, ...]
    """Each demand tier's label: the rows of ``served``."""
    served: Array
    lines: tuple[BidLine, ...]
    """Every bid line, in the order they were placed: the rows of ``offered``."""
    offered: Array

    @property
    def point_count(self) -> int:
        """How many settlement points the period has, including any after a blackout."""
        return len(self.price)

    def merit_order(self, point: int) -> MeritOrder | None:
        """The merit order the market cleared at ``point``, or None if the grid was already down."""
        if not 0 <= point < self.point_count:
            raise IndexError(f"point {point} is outside the period's {self.point_count} points")
        if self.blackout_at is not None and point > self.blackout_at:
            return None
        quantity = float(self.quantity[point])

        def side(name: Side) -> dict[str, list]:
            entries = [
                MarketEntry(line.player_id, float(offered), line.price, line.facility, must_run=line.must_run)
                for line, offered in zip(self.lines, self.offered[:, point], strict=True)
                if line.side == name and offered > 0
            ]
            ordered = merit_order(entries, descending=name == "demand")
            return {**order_columns(ordered), "cleared": [Fill.from_entry(e, quantity).cleared for e in ordered]}

        return MeritOrder(point, side("offer"), side("demand"), float(self.price[point]), quantity)

    def save(self, path: Path) -> None:
        """Write the record to ``path``, replacing any file there in one step."""
        meta = {
            "round": self.round,
            "season": self.season,
            "clearings_per_day": self.clearings_per_day,
            "days": list(self.days),
            "blackout_at": self.blackout_at,
            "pools": [list(pool) for pool in self.pools],
            "tiers": list(self.tiers),
            "lines": [[line.side, line.player_id, line.facility, line.must_run] for line in self.lines],
        }
        buffer = io.BytesIO()
        np.savez_compressed(
            buffer,
            meta=np.array(json.dumps(meta)),
            line_price=np.array([line.price for line in self.lines], dtype=np.float64),
            price=self.price,
            quantity=self.quantity,
            generation=self.generation,
            dumped=self.dumped,
            charged=self.charged,
            stored=self.stored,
            served=self.served,
            offered=self.offered,
        )
        write_atomically(path, buffer.getvalue())

    @classmethod
    def load(cls, path: Path) -> TradingPeriodRecord:
        """Read the record saved at ``path``."""
        with np.load(path, allow_pickle=False) as data:
            meta = json.loads(str(data["meta"]))
            line_prices = data["line_price"].tolist()
            return cls(
                round=meta["round"],
                season=meta["season"],
                clearings_per_day=meta["clearings_per_day"],
                days=tuple(meta["days"]),
                blackout_at=meta["blackout_at"],
                price=data["price"],
                quantity=data["quantity"],
                pools=tuple((player_id, facility) for player_id, facility in meta["pools"]),
                generation=data["generation"],
                dumped=data["dumped"],
                charged=data["charged"],
                stored=data["stored"],
                tiers=tuple(meta["tiers"]),
                served=data["served"],
                lines=tuple(
                    BidLine(side, player_id, facility, price, must_run)
                    for (side, player_id, facility, must_run), price in zip(meta["lines"], line_prices, strict=True)
                ),
                offered=data["offered"],
            )
