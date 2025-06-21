"""Util functions relating to the resource market."""

import math

from energetica.database.player import Player
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.database.shipment import OngoingShipment
from energetica.enums import Fuel
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.formatting import display_money, format_mass


def create_resource_market_ask(player: Player, fuel: Fuel, quantity: float, unit_price: float) -> ResourceOnSale:
    """Put an offer on the resource market."""
    if player.resources[fuel] - player.resources_on_sale[fuel] < quantity:
        raise GameError("notEnoughResource")
    player.resources_on_sale[fuel] += quantity
    return ResourceOnSale(
        resource=fuel,
        quantity=quantity,
        unit_price=unit_price,
        player=player,
    )


def buy_resource_from_market(player: Player, quantity: float, sale: ResourceOnSale) -> ResourceOnSale | None:
    """
    Buy an offer from the resource market.

    Return the resulting ResourceOnSale if this is a partial purchase, return None otherwise.
    """
    assert player.tile is not None
    assert sale.player.tile is not None
    if quantity is None or quantity <= 0 or quantity > sale.quantity:
        raise GameError("invalidQuantity")
    total_price = sale.unit_price * quantity
    if player == sale.player:
        # TODO(mglst): this should be a different function
        # Player is buying their own resource
        sale.quantity -= quantity
        player.resources_on_sale[sale.resource] -= quantity
        if sale.quantity == 0:
            sale.delete()
            return None
        return sale
    else:
        if total_price > player.money:
            raise GameError("Not enough money")
        # Player buys form another player
        sale.quantity -= quantity
        player.money -= total_price
        sale.player.money += total_price
        player.resources[sale.resource] -= quantity
        player.resources_on_sale[sale.resource] -= quantity
        sale.player.progression_metrics["sold_resources"] += quantity
        player.progression_metrics["bought_resources"] += quantity
        player.check_trading_achievement()
        dq = player.tile.coordinates[0] - sale.player.tile.coordinates[0]
        dr = player.tile.coordinates[1] - sale.player.tile.coordinates[1]
        distance = math.sqrt(2 * (dq**2 + dr**2 + dq * dr))
        shipment_duration = distance * player.config["transport"]["time_per_tile"] / engine.in_game_seconds_per_tick
        shipment_duration = math.ceil(shipment_duration)
        OngoingShipment(
            resource=sale.resource,
            quantity=quantity,
            arrival_tick=engine.total_t + 1 + shipment_duration,
            duration=shipment_duration,
            power_demand=quantity * player.config["transport"]["power_per_kg"],
            player=player,
        )
        sale.player.notify(
            "Resource transaction",
            f"{player.username} bought {format_mass(quantity)} of "
            f"{sale.resource} for a total cost of {display_money(total_price)}.",
        )
        engine.log(
            f"{player.username} bought {format_mass(quantity)} of "
            f"{sale.resource} from {sale.player.username} for a total cost of "
            f"{display_money(total_price)}.",
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            sale.delete()
            return None
        return sale


def store_import(player: Player, fuel: Fuel, quantity: float) -> None:
    """
    Add a resource shipment to the player's warehouse.

    This function is executed when a resource shipment arrives.
    """
    assert player.tile is not None
    max_cap: float = player.config["warehouse_capacities"][fuel]
    if player.resources[fuel] + quantity > max_cap:
        player.resources[fuel] = max_cap
        # excess resources are stored in the ground
        # TODO(mglst): what if instead it was a political fiasco that the player had to deal with?
        player.tile.fuel_reserves[fuel] += player.resources[fuel] + quantity - max_cap
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
