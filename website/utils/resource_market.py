"""Util functions relating to the resource market"""

import math
from datetime import datetime

from flask import current_app, flash

from website import db
from website.database.player_assets import ResourceOnSale, Shipment
from website.utils.formatting import format_mass
from website.utils.misc import flash_error


def put_resource_on_market(player, resource, quantity, price):
    """Put an offer on the resource market"""
    if getattr(player, resource) - getattr(player, resource + "_on_sale") < quantity:
        flash_error(f"You have not enough {resource} available")
    else:
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
        flash(
            f"You put {quantity/1000}t of {resource} on sale for "
            "{price*1000}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>/t",
            category="message",
        )


def buy_resource_from_market(player, quantity, sale_id):
    """Buy an offer from the resource market"""
    engine = current_app.config["engine"]
    sale = ResourceOnSale.query.filter_by(id=sale_id).first()
    if quantity is None or quantity <= 0 or quantity > sale.quantity:
        return {"response": "invalidQuantity"}
    total_price = sale.price * quantity
    if player == sale.player:
        # Player is buying their own resource
        sale.quantity -= quantity
        if sale.quantity == 0:
            ResourceOnSale.query.filter_by(id=sale_id).delete()
        setattr(
            player,
            sale.resource + "_on_sale",
            getattr(player, sale.resource + "_on_sale") - quantity,
        )
        db.session.commit()
        return {
            "response": "removedFromMarket",
            "quantity": quantity,
            "available_quantity": sale.quantity,
            "resource": sale.resource,
        }
    if total_price > player.money:
        return {"response": "notEnoughMoney"}
    else:
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
        sale.player.sold_resources += quantity
        player.bought_resources += quantity
        player.check_trading_achievement()
        dq = player.tile.q - sale.player.tile.q
        dr = player.tile.r - sale.player.tile.r
        distance = math.sqrt(2 * (dq**2 + dr**2 + dq * dr))
        shipment_duration = (
            distance * engine.config[player.id]["transport"]["time_per_tile"] / engine.in_game_seconds_per_tick
        )
        shipment_duration = math.ceil(shipment_duration)
        new_shipment = Shipment(
            resource=sale.resource,
            quantity=quantity,
            departure_time=engine.data["total_t"],
            duration=shipment_duration,
            player_id=player.id,
        )
        db.session.add(new_shipment)
        sale.player.notify(
            "Resource transaction",
            f"{player.username} bought {format_mass(quantity)} of "
            "{sale.resource} for a total cost of {display_money(total_price)}.",
        )
        engine.log(
            f"{player.username} bought {format_mass(quantity)} of "
            "{sale.resource} from {sale.player.username} for a total cost of "
            "{display_money(total_price)}."
        )
        if sale.quantity == 0:
            # Player is purchasing all available quantity
            ResourceOnSale.query.filter_by(id=sale_id).delete()
        db.session.commit()
        return {
            "response": "success",
            "resource": sale.resource,
            "total_price": total_price,
            "quantity": quantity,
            "seller": sale.player.username,
            "available_quantity": sale.quantity,
            "shipments": player.package_shipments(),
        }


def store_import(player, resource, quantity):
    """This function is executed when a resource shipment arrives"""
    engine = current_app.config["engine"]
    max_cap = engine.config[player.id]["warehouse_capacities"][resource]
    if getattr(player, resource) + quantity > max_cap:
        setattr(player, resource, max_cap)
        # excess resources are stored in the ground
        setattr(
            player.tile,
            resource,
            getattr(player.tile, resource) + getattr(player, resource) + quantity - max_cap,
        )
        sale.player.notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived, but "
            "only {format_mass(max_cap - getattr(player, resource))} could be "
            "stored in your warehouse.",
        )
        engine.log(
            f"{player.username} received a shipment of {format_mass(quantity)} "
            "{resource}, but could only store "
            "{format_mass(max_cap - getattr(player, resource))} "
            "in their warehouse."
        )
    else:
        setattr(player, resource, getattr(player, resource) + quantity)
        sale.player.notify(
            "Shipments",
            f"A shipment of {format_mass(quantity)} {resource} arrived.",
        )
        engine.log(f"{player.username} received a shipment of {format_mass(quantity)} {resource}.")


def pause_shipment(player, shipment_id):
    """this function is executed when a player pauses or unpauses an ongoing shipment"""
    engine = current_app.config["engine"]
    shipment = Shipment.query.get(int(shipment_id))

    if shipment.suspension_time is None:
        shipment.suspension_time = engine.data["total_t"]
    else:
        shipment.departure_time += engine.data["total_t"] - shipment.suspension_time
        shipment.suspension_time = None
    db.session.commit()
    return {
        "response": "success",
        "shipments": player.package_shipments(),
    }
