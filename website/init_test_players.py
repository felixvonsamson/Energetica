from werkzeug.security import generate_password_hash
from pathlib import Path
from .auth import add_player_to_data, init_table
from .database import Player, Hex, Network
from . import db
import pickle
from .socketio_handlers import data_init_network

def edit_database():
    Max = create_player("maximilientirard", 20, "kUcmo0-jyjwoc-kugnot")
    print(Max)
    Max.money = 75000
    Max.steam_engine = 23
    Max.windmill = 1
    Max.watermill = 3
    Max.industry = 14
    Max.laboratory = 4
    Max.mathematics = 4
    Max.mechanical_engineering = 4
    Max.building_technology = 3
    Max.transport_technology = 1
    Max.civil_engineering = 1
    Max.small_water_dam = 2
    db.session.commit()

def init_test_players(engine):
    members = []

    for i in range(3):
        members.append(create_player(engine, "Player"+str(i), i+1, "password"))
    members.append(create_player(engine, "Player3", 21, "password"))

    network = "Network1"
    create_network(engine, network, members)

    if members[0] != None:
        members[1].steam_engine = 10
        members[1].industry = 15
        members[0].gas_burner = 1
        members[0].gas = 100000
        members[0].coal_burner = 1
        members[0].coal = 1000000
        members[0].nuclear_reactor = 1
        members[0].uranium = 3000
        members[2].compressed_air = 1
        members[2].windmill = 1
        members[2].watermill = 1
        members[2].PV_solar = 1
        members[3].small_pumped_hydro = 1
        members[3].onshore_wind_turbine = 1
        db.session.commit()


def create_player(engine, username, tile_id, pw):
    p = Player.query.filter_by(username=username).first()
    if p == None:
        tile = Hex.query.filter_by(id=tile_id).first()
        new_player = Player(
            username=username,
            password=generate_password_hash(pw, method="sha256"),
            data_table_name=f"data_{username}.pck",
            tile = [tile],
        )
        add_player_to_data(username)
        init_table(username)
        db.session.add(new_player)
        db.session.commit()
        return new_player

def create_network(engine, name, members):
    n = Network.query.filter_by(name=name).first()
    if n == None:
        new_Network = Network(name=name, members=members)
        db.session.add(new_Network)
        db.session.commit()
        Path(f"instance/network_data/{name}/charts").mkdir(parents=True, exist_ok=True)
        engine.data["network_data"][name] = data_init_network(1441)
        past_data = data_init_network(1440)
        Path(f"instance/network_data/{name}/prices").mkdir(parents=True, exist_ok=True)
        for timescale in ["day", "5_days", "month", "6_months"]:
            with open(f"instance/network_data/{name}/prices/{timescale}.pck", "wb") as file:
                pickle.dump(past_data, file)