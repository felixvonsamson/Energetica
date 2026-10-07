"""The prices a Workshop player offers their facilities' power at (#1002).

A player sets one price per facility type, per MWh. A base tier and its upgrade are separate types
with separate prices. A storage type has two: the price it sells at when it discharges, and the price
it buys at when it charges. Renewable facilities get a price like any other type; output they do not
sell is dumped (#992 §1, "Supply offers and dumping").

A player can change their prices freely while a Trading period's price-setting window is open. When
the window closes they are locked, and they hold for every settlement period of that Trading period.
They then carry over as the starting prices of the next window.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from energetica.workshop.facilities import CATALOG, FacilityId
from energetica.workshop.seasons import Season

#: What dumping unsold power costs its owner, per MWh: renewable output that does not sell, at a price
#: the player chose (#992 §1).
DUMP_COST = 25.0
#: The lowest price a player can set, per MWh. Below it, dumping would cost less than selling.
PRICE_FLOOR = -DUMP_COST

PriceSide = Literal["sell", "buy"]


def is_storage(facility: FacilityId) -> bool:
    """Whether ``facility`` is storage, and so has a buy price as well as a sell price."""
    return CATALOG[facility].base_storage_capacity is not None


class PriceSheet(BaseModel):
    """A player's prices, per MWh."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    sell: dict[FacilityId, float] = Field(description="The price each facility type sells its power at")
    buy: dict[FacilityId, float] = Field(description="The price each storage type buys power at to charge")

    @model_validator(mode="after")
    def _only_storage_buys(self) -> PriceSheet:
        if not all(is_storage(facility) for facility in self.buy):
            raise ValueError("only storage has a buy price")
        return self

    def with_price(self, facility: FacilityId, side: PriceSide, price: float) -> PriceSheet:
        """These prices, with ``facility``'s ``side`` price set to ``price``."""
        if side == "sell":
            return self.model_copy(update={"sell": {**self.sell, facility: price}})
        return self.model_copy(update={"buy": {**self.buy, facility: price}})

    def only(self, facilities: set[FacilityId]) -> PriceSheet:
        """These prices, for ``facilities`` alone."""
        return PriceSheet(
            sell={facility: price for facility, price in self.sell.items() if facility in facilities},
            buy={facility: price for facility, price in self.buy.items() if facility in facilities},
        )


class LockedPrices(BaseModel):
    """The prices a player's facilities were offered at during one Trading period."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    round: int = Field(ge=1)
    season: Season
    prices: PriceSheet = Field(description="The prices of the facility types the player had operating")


# Controllable and storage facilities start at the persistent world's default prices, restated
# because Workshop does not import it. Facilities with no persistent-world counterpart get invented
# prices: the modern coal plant a little below the coal burner, and pumped hydro halfway between the
# persistent world's small and large pumped hydro. Renewables have no default there, since the
# persistent world always offers them at its floor of -5, so Workshop sets its own. All are
# placeholders until the game-balance pass (#1145).
_DEFAULT_SELL = {
    FacilityId.ONSHORE_WIND_TURBINE: 135.0,
    FacilityId.OFFSHORE_WIND_TURBINE: 120.0,
    FacilityId.COAL_BURNER: 600.0,
    FacilityId.MODERN_COAL_PLANT: 550.0,
    FacilityId.GAS_BURNER: 500.0,
    FacilityId.COMBINED_CYCLE: 450.0,
    FacilityId.SMALL_WATER_DAM: 45.0,
    FacilityId.LARGE_WATER_DAM: 40.0,
    FacilityId.NUCLEAR_REACTOR: 275.0,
    FacilityId.NUCLEAR_REACTOR_GEN4: 375.0,
    FacilityId.PV_SOLAR: 30.0,
    FacilityId.MULTI_LAYER_PV: 25.0,
    FacilityId.CSP_SOLAR: 80.0,
    FacilityId.LITHIUM_ION_BATTERIES: 940.0,
    FacilityId.SOLID_STATE_BATTERIES: 900.0,
    FacilityId.HYDROGEN_STORAGE: 880.0,
    FacilityId.PUMPED_HYDRO: 785.0,
}
_DEFAULT_BUY = {
    FacilityId.LITHIUM_ION_BATTERIES: 425.0,
    FacilityId.SOLID_STATE_BATTERIES: 420.0,
    FacilityId.HYDROGEN_STORAGE: 230.0,
    FacilityId.PUMPED_HYDRO: 205.0,
}

DEFAULT_PRICES = PriceSheet(sell=_DEFAULT_SELL, buy=_DEFAULT_BUY)
"""Every player's prices before they first change one: a price for every facility type in the catalog."""
