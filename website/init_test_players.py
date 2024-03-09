from werkzeug.security import generate_password_hash
from pathlib import Path

from .database.player import Network, Player
from .database.database import (
    Hex,
    Under_construction,
    Shipment,
    Resource_on_sale,
    CircularBufferPlayer,
    CircularBufferNetwork,
)
from . import db
import pickle
import os
import time
from .utils import data_init_network, init_table


def edit_database(engine):
    with open("retieved_data.pck", "rb") as file:
        retieved_data = pickle.load(file)
    for player_id in retieved_data["player"]:
        player = create_player(
            engine,
            retieved_data["player"][player_id]["username"],
            retieved_data["player"][player_id]["pwhash"],
        )
        for attribute in retieved_data["player"][player_id]:
            setattr(
                player, attribute, retieved_data["player"][player_id][attribute]
            )
        db.session.commit()

    for network_id in retieved_data["network"]:
        create_network(engine, retieved_data["network"][network_id]["name"], [])

    for tile_id in retieved_data["hex"]:
        tile = Hex.query.filter_by(id=tile_id).first()
        tile.player_id = retieved_data["hex"][tile_id]["player_id"]
        db.session.commit()

    for construction_id in retieved_data["under_construction"]:
        construction = retieved_data["under_construction"][construction_id]
        new_facility = Under_construction(
            name=construction["name"],
            family=construction["family"],
            start_time=construction["start_time"],
            duration=construction["duration"],
            player_id=construction["player_id"],
        )
        db.session.add(new_facility)
        db.session.commit()

    for shipment_id in retieved_data["shipment"]:
        shipment = retieved_data["shipment"][shipment_id]
        new_shipment = Shipment(
            resource=shipment["resource"],
            quantity=shipment["quantity"],
            departure_time=shipment["departure_time"],
            duration=shipment["duration"],
            player_id=shipment["player_id"],
        )
        db.session.add(new_shipment)
        db.session.commit()

    for sale_id in retieved_data["resource_on_sale"]:
        sale = retieved_data["resource_on_sale"][sale_id]
        new_sale = Resource_on_sale(
            resource=sale["resource"],
            quantity=sale["quantity"],
            price=sale["price"],
            creation_date=sale["creation_date"],
            player_id=sale["player_id"],
        )
        db.session.add(new_sale)
        db.session.commit()

    os.remove("retieved_data.pck")


def init_test_players(engine):
    player = create_player(engine, "user", "password")
    if player:
        Hex.query.filter_by(id=300).first().player_id = player.id

        player.money = 1000000
        player.coal = 450000
        player.oil = 100000
        player.gas = 800000
        player.uranium = 4500

        add_asset(player, "industry", 18)
        add_asset(player, "laboratory", 5)
        add_asset(player, "mathematics", 1)
        add_asset(player, "mineral_extraction", 2)
        add_asset(player, "building_technology", 1)
        add_asset(player, "coal_mine", 1)
        # add_asset(player, "uranium_mine", 1)
        add_asset(player, "warehouse", 2)
        add_asset(player, "small_pumped_hydro", 1)
        add_asset(player, "hydrogen_storage", 1)
        add_asset(player, "onshore_wind_turbine", 1)
        # add_asset(player, "offshore_wind_turbine", 2)
        add_asset(player, "nuclear_reactor_gen4", 1)
        add_asset(player, "combined_cycle", 1)
        add_asset(player, "gas_burner", 3)
        db.session.commit()
    player2 = create_player(engine, "user2", "password")
    if player2:
        Hex.query.filter_by(id=84).first().player_id = player2.id
        db.session.commit()

    create_network(engine, "net", [player, player2])
    db.session.commit()


def add_asset(player, asset, n):
    asset_to_family = {
        "coal_mine": "Extraction facilities",
        "oil_field": "Extraction facilities",
        "gas_drilling_site": "Extraction facilities",
        "uranium_mine": "Extraction facilities",
        "small_pumped_hydro": "Storage facilities",
        "compressed_air": "Storage facilities",
        "molten_salt": "Storage facilities",
        "large_pumped_hydro": "Storage facilities",
        "hydrogen_storage": "Storage facilities",
        "lithium_ion_batteries": "Storage facilities",
        "solid_state_batteries": "Storage facilities",
        "steam_engine": "Power facilities",
        "nuclear_reactor": "Power facilities",
        "nuclear_reactor_gen4": "Power facilities",
        "combined_cycle": "Power facilities",
        "gas_burner": "Power facilities",
        "oil_burner": "Power facilities",
        "coal_burner": "Power facilities",
        "small_water_dam": "Power facilities",
        "large_water_dam": "Power facilities",
        "watermill": "Power facilities",
        "onshore_wind_turbine": "Power facilities",
        "offshore_wind_turbine": "Power facilities",
        "windmill": "Power facilities",
        "CSP_solar": "Power facilities",
        "PV_solar": "Power facilities",
        "laboratory": "Functional facilities",
        "warehouse": "Functional facilities",
        "industry": "Functional facilities",
        "carbon_capture": "Functional facilities",
        "mathematics": "Technologies",
        "mechanical_engineering": "Technologies",
        "thermodynamics": "Technologies",
        "physics": "Technologies",
        "building_technology": "Technologies",
        "mineral_extraction": "Technologies",
        "transport_technology": "Technologies",
        "materials": "Technologies",
        "civil_engineering": "Technologies",
        "aerodynamics": "Technologies",
        "chemistry": "Technologies",
        "nuclear_engineering": "Technologies",
    }
    priority_list_name = "construction_priorities"
    if asset_to_family[asset] == "Technologies":
        priority_list_name = "research_priorities"
    for i in range(n):
        new_construction = Under_construction(
            name=asset,
            family=asset_to_family[asset],
            start_time=time.time(),
            duration=0,
            suspension_time=None,
            original_price=0,
            player_id=player.id,
        )
        db.session.add(new_construction)
        db.session.commit()
        player.add_project_priority(priority_list_name, new_construction.id)


def create_player(engine, username, password):
    p = Player.query.filter_by(username=username).first()
    if p is None:
        new_player = Player(
            username=username,
            pwhash=generate_password_hash(password, method="scrypt"),
        )
        db.session.add(new_player)
        db.session.commit()
        engine.data["current_data"][new_player.id] = CircularBufferPlayer()
        init_table(new_player)
        db.session.commit()
        return new_player
    engine.log(f"create_player: player {username} already exists")
    return None


def create_network(engine, name, members):
    n = Network.query.filter_by(name=name).first()
    if n is None:
        new_network = Network(name=name, members=members)
        db.session.add(new_network)
        db.session.commit()
        Path(f"instance/network_data/{new_network.id}/charts").mkdir(
            parents=True, exist_ok=True
        )
        engine.data["network_data"][new_network.id] = CircularBufferNetwork()
        past_data = data_init_network()
        Path(f"instance/network_data/{new_network.id}").mkdir(
            parents=True, exist_ok=True
        )
        with open(
            f"instance/network_data/{new_network.id}/time_series.pck",
            "wb",
        ) as file:
            pickle.dump(past_data, file)
