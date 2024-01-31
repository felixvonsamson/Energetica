from werkzeug.security import generate_password_hash
from pathlib import Path
from .auth import add_player_to_data, init_table
from .database import (
    Player,
    Hex,
    Network,
    Under_construction,
    Shipment,
    Resource_on_sale,
)
from . import db
import pickle
import os
from .utils import data_init_network


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
    # members = []

    player = create_player(engine, "user", "password")
    print(player)
    Hex.query.filter_by(id=83).first().player_id = player.id
    player.industry = 15
    player.coal_mine = 1
    player.coal_burner = 2
    player.gas_burner = 3
    player.gas = 5000
    player.uranium_mine = 1
    player.small_pumped_hydro = 1
    player.hydrogen_storage = 1
    player.warehouse = 1
    db.session.commit()

    # create_network(engine, "network", [player])

    # for i in range(3):
    #     members.append(create_player(engine, "Player" + str(i), i + 1, "password"))
    # members.append(create_player(engine, "Player3", 21, "password"))

    # network = "Network1"
    # create_network(engine, network, members)

    # if members[0] is not None:
    #     members[1].steam_engine = 10
    #     members[1].industry = 15
    #     members[0].gas_burner = 1
    #     members[0].gas = 100000
    #     members[0].coal_burner = 1
    #     members[0].coal = 1000000
    #     members[0].nuclear_reactor = 1
    #     members[0].uranium = 3000
    #     members[2].compressed_air = 1
    #     members[2].windmill = 1
    #     members[2].watermill = 1
    #     members[2].PV_solar = 1
    #     members[3].small_pumped_hydro = 1
    #     members[3].onshore_wind_turbine = 1
    #     db.session.commit()


def create_player(engine, username, password):
    p = Player.query.filter_by(username=username).first()
    if p is None:
        new_player = Player(
            username=username,
            pwhash=generate_password_hash(password, method="scrypt"),
            data_table_name=f"data_{username}.pck",
        )
        add_player_to_data(username)
        init_table(username)
        db.session.add(new_player)
        db.session.commit()
        return new_player
    print(f"create_player: player {username} already exists")
    return p


def create_network(engine, name, members):
    n = Network.query.filter_by(name=name).first()
    if n is None:
        new_Network = Network(name=name, members=members)
        db.session.add(new_Network)
        db.session.commit()
        Path(f"instance/network_data/{name}/charts").mkdir(
            parents=True, exist_ok=True
        )
        engine.data["network_data"][name] = data_init_network(1441)
        past_data = data_init_network(1440)
        Path(f"instance/network_data/{name}/prices").mkdir(
            parents=True, exist_ok=True
        )
        for timescale in ["day", "5_days", "month", "6_months"]:
            with open(
                f"instance/network_data/{name}/prices/{timescale}.pck", "wb"
            ) as file:
                pickle.dump(past_data, file)
