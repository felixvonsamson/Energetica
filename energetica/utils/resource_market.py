"""Utility functions relating to the resource market."""

import math

from energetica.database.ongoing_shipment import OngoingShipment
from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.enums import Fuel
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.utils.formatting import display_money, format_mass


def calculate_shipment_duration(buyer: Player, seller: Player) -> float:
    """Calculate shipment duration in game ticks between buyer and seller tiles."""
    dq = buyer.tile.coordinates[0] - seller.tile.coordinates[0]
    dr = buyer.tile.coordinates[1] - seller.tile.coordinates[1]
    distance = math.sqrt(2 * (dq**2 + dr**2 + dq * dr))
    shipment_duration = distance * buyer.config["transport"]["time_per_tile"] / engine.in_game_seconds_per_tick
    return math.ceil(shipment_duration)


def create_ask(player: Player, fuel: Fuel, quantity: float, unit_price: float) -> ResourceOnSale:
    """Put an offer on the resource market."""
    if player.resources[fuel] - player.resources_on_sale[fuel] < quantity:
        raise GameError(GameExceptionType.NOT_ENOUGH_RESOURCE)
    player.resources_on_sale[fuel] += quantity
    ask = ResourceOnSale(
        resource=fuel,
        quantity=quantity,
        unit_price=unit_price,
        player=player,
    )
    # Invalidate resource market asks for everyone since the market list changed
    engine.emit("invalidate", {"queries": [["resource-market", "asks"]]})
    return ask


def purchase_resource(buyer: Player, quantity: float, sale: ResourceOnSale) -> ResourceOnSale | None:
    """
    Buy an offer from the resource market.

    Return the resulting ResourceOnSale if this is a partial purchase, return None otherwise.
    """
    if quantity > sale.quantity:
        raise GameError(GameExceptionType.INVALID_QUANTITY)
    total_price = sale.unit_price * quantity
    if buyer == sale.player:
        # TODO(mglst): this should be a different function
        # Player is buying their own resource
        sale.quantity -= quantity
        buyer.resources_on_sale[sale.resource] -= quantity
        if sale.quantity == 0:
            sale.delete()
        # Invalidate resource market asks for everyone since the market list changed
        engine.emit("invalidate", {"queries": [["resource-market", "asks"]]})
        return None if sale.quantity == 0 else sale
    else:
        if total_price > buyer.money:
            raise GameError(GameExceptionType.NOT_ENOUGH_MONEY)
        # Player buys form another player
        sale.quantity -= quantity
        buyer.money -= total_price
        sale.player.money += total_price
        sale.player.resources[sale.resource] -= quantity
        buyer.resources[sale.resource] += quantity
        sale.player.resources_on_sale[sale.resource] -= quantity
        buyer.progression_metrics["bought_resources"] += quantity
        sale.player.progression_metrics["sold_resources"] += quantity
        buyer.check_trading_achievement()
        sale.player.check_trading_achievement()

        # Calculate shipment duration
        shipment_duration = calculate_shipment_duration(buyer, sale.player)

        OngoingShipment(
            resource=sale.resource,
            quantity=quantity,
            arrival_tick=engine.total_t + 1 + shipment_duration,
            duration=shipment_duration,
            power_demand=quantity * buyer.config["transport"]["power_per_kg"],
            player=buyer,
        )
        sale.player.notify(
            "Resource transaction",
            f"{buyer.username} bought {format_mass(quantity)} of "
            f"{sale.resource} for a total cost of {display_money(total_price)}.",
        )
        engine.log(
            f"{buyer.username} bought {format_mass(quantity)} of "
            f"{sale.resource} from {sale.player.username} for a total cost of "
            f"{display_money(total_price)}.",
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            sale.delete()

        # Invalidate resource market asks for everyone since the market list changed
        engine.emit("invalidate", {"queries": [["resource-market", "asks"]]})
        return None if sale.quantity == 0 else sale


def patch_ask(sale: ResourceOnSale, unit_price: float | None = None, quantity: float | None = None) -> ResourceOnSale:
    """Update an ask in the resource market."""
    if unit_price is not None:
        sale.unit_price = unit_price
    if quantity is not None:
        sale.quantity = quantity
    # Invalidate resource market asks for everyone since an ask was modified
    engine.emit("invalidate", {"queries": [["resource-market", "asks"]]})
    return sale


def delete_ask(sale: ResourceOnSale) -> None:
    """Delete an ask from the resource market."""
    sale.player.resources_on_sale[sale.resource] -= sale.quantity
    sale.delete()
    # Invalidate resource market asks for everyone since the market list changed
    engine.emit("invalidate", {"queries": [["resource-market", "asks"]]})


def store_import(player: Player, fuel: Fuel, quantity: float) -> None:
    """
    Add a resource shipment to the player's warehouse.

    This function is executed when a resource shipment arrives.
    """
    max_cap: float = player.config["warehouse_capacities"][fuel]
    if player.resources[fuel] + quantity > max_cap:
        # excess resources are stored in the ground
        # TODO(mglst): what if instead it was a political fiasco that the player had to deal with?
        player.tile.fuel_reserves[fuel] += player.resources[fuel] + quantity - max_cap
        player.resources[fuel] = max_cap
        player.notify(
            "OngoingShipments",
            f"A shipment of {format_mass(quantity)} {fuel} arrived, but "
            f"only {format_mass(max_cap - player.resources[fuel])} could be "
            "stored in your warehouse.",
        )
        engine.log(
            f"{player.username} received a shipment of {format_mass(quantity)} "
            f"{fuel}, but could only store "
            f"{format_mass(max_cap - player.resources[fuel])} "
            "in their warehouse.",
        )
    else:
        player.resources[fuel] += quantity
        player.notify(
            "OngoingShipments",
            f"A shipment of {format_mass(quantity)} {fuel} arrived.",
        )
        engine.log(f"{player.username} received a shipment of {format_mass(quantity)} {fuel}.")
