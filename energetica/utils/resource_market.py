"""Util functions relating to the resource market"""

import math
from datetime import datetime

from flask import current_app

from energetica.database import db
from energetica.database.resource_on_sale import ResourceOnSale
from energetica.database.shipment import Shipment
from energetica.game_engine import GameError
from energetica.utils.formatting import display_money, format_mass


def put_resource_on_market(player, resource, quantity, price):
    """Put an offer on the resource market"""
    if getattr(player, resource) - getattr(player, resource + "_on_sale") < quantity:
        raise GameError("notEnoughResource")
    setattr(
        player,
        resource + "_on_sale",
        getattr(player, resource + "_on_sale") + quantity,
    )
    new_sale = ResourceOnSale(
        resource=resource,
        quantity=quantity,
        price=price,
        creation_date=datetime.now(),
        player=player,
    )
    db.session.add(new_sale)
    db.session.commit()


def buy_resource_from_market(player, quantity, sale):
    """Buy an offer from the resource market"""
    engine = current_app.config["engine"]

    if quantity is None or quantity <= 0 or quantity > sale.quantity:
        raise GameError("invalidQuantity")
    total_price = sale.price * quantity
    if player == sale.player:
        # Player is buying their own resource
        sale.quantity -= quantity
        if sale.quantity == 0:
            db.session.delete(sale)
        setattr(
            player,
            sale.resource + "_on_sale",
            getattr(player, sale.resource + "_on_sale") - quantity,
        )
        db.session.commit()
    else:
        if total_price > player.money:
            raise GameError("notEnoughMoney")
        # Player buys form another player
        sale.quantity -= quantity
        player.money -= total_price
        sale.player.money += total_price
        setattr(
            sale.player,
            sale.resource,
            getattr(sale.player, sale.resource) - quantity,
        )
        setattr(
            sale.player,
            sale.resource + "_on_sale",
            getattr(sale.player, sale.resource + "_on_sale") - quantity,
        )
        sale.player.progression_metrics.sold_resources += quantity
        player.progression_metrics.bought_resources += quantity
        player.check_trading_achievement()
        dq = player.tile.q - sale.player.tile.q
        dr = player.tile.r - sale.player.tile.r
        distance = math.sqrt(2 * (dq**2 + dr**2 + dq * dr))
        shipment_duration = distance * player.config["transport"]["time_per_tile"] / engine.in_game_seconds_per_tick
        shipment_duration = math.ceil(shipment_duration)
        new_shipment = Shipment(
            resource=sale.resource,
            quantity=quantity,
            arrival_tick=engine.data["total_t"] + 1 + shipment_duration,
            duration=shipment_duration,
            player_id=player.id,
        )
        db.session.add(new_shipment)
        sale.player.notify(
            "Resource transaction",
            f"{player.username} bought {format_mass(quantity)} of "
            f"{sale.resource} for a total cost of {display_money(total_price)}.",
        )
        engine.log(
            f"{player.username} bought {format_mass(quantity)} of "
            f"{sale.resource} from {sale.player.username} for a total cost of "
            f"{display_money(total_price)}."
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            db.session.delete(sale)
        db.session.commit()


def store_import(player, resource, quantity):
    """This function is executed when a resource shipment arrives"""
    engine = current_app.config["engine"]
    max_cap = player.config["warehouse_capacities"][resource]
    if getattr(player, resource) + quantity > max_cap:
        setattr(player, resource, max_cap)
        # excess resources are stored in the ground
        setattr(
            player.tile,
            resource,
            getattr(player.tile, resource) + getattr(player, resource) + quantity - max_cap,
        )
        player.notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived, but "
            f"only {format_mass(max_cap - getattr(player, resource))} could be "
            "stored in your warehouse.",
        )
        engine.log(
            f"{player.username} received a shipment of {format_mass(quantity)} "
            f"{resource}, but could only store "
            f"{format_mass(max_cap - getattr(player, resource))} "
            "in their warehouse."
        )
    else:
        setattr(player, resource, getattr(player, resource) + quantity)
        player.notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived.",
        )
        engine.log(f"{player.username} received a shipment of {format_mass(quantity)} {resource}.")
