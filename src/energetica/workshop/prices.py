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
#: The price per MWh a clearing settles at when supply exactly meets must-serve demand, which would
#: otherwise clear at the unbounded must-serve bid.
SCARCITY_PRICE = 1000.0
#: The highest price a player can set, per MWh. Without it, one player offering at a huge price could set
#: the clearing price for everyone (#1221).
PRICE_CEILING = SCARCITY_PRICE

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


# Every facility type's default prices were set by the first recalibration (#1227), around power prices of
# about 100 per MWh, without the carbon tax. Coal and gas plants sell at about 1.7 times their fuel cost,
# nuclear and renewables low, and storage sells at about 150 and buys at about 60, less for the long-term types.
_DEFAULT_SELL = {
    FacilityId.ONSHORE_WIND_TURBINE: 30.0,
    FacilityId.OFFSHORE_WIND_TURBINE: 25.0,
    FacilityId.COAL_BURNER: 65.0,
    FacilityId.MODERN_COAL_PLANT: 50.0,
    FacilityId.GAS_BURNER: 90.0,
    FacilityId.COMBINED_CYCLE: 70.0,
    FacilityId.SMALL_WATER_DAM: 45.0,
    FacilityId.LARGE_WATER_DAM: 40.0,
    FacilityId.NUCLEAR_REACTOR: 25.0,
    FacilityId.NUCLEAR_REACTOR_GEN4: 20.0,
    FacilityId.PV_SOLAR: 30.0,
    FacilityId.MULTI_LAYER_PV: 25.0,
    FacilityId.CSP_SOLAR: 40.0,
    FacilityId.LITHIUM_ION_BATTERIES: 150.0,
    FacilityId.SOLID_STATE_BATTERIES: 145.0,
    FacilityId.HYDROGEN_STORAGE: 140.0,
    FacilityId.PUMPED_HYDRO: 130.0,
}
_DEFAULT_BUY = {
    FacilityId.LITHIUM_ION_BATTERIES: 60.0,
    FacilityId.SOLID_STATE_BATTERIES: 60.0,
    FacilityId.HYDROGEN_STORAGE: 35.0,
    FacilityId.PUMPED_HYDRO: 30.0,
}

DEFAULT_PRICES = PriceSheet(sell=_DEFAULT_SELL, buy=_DEFAULT_BUY)
"""Every player's prices before they first change one: a price for every facility type in the catalog."""
