from werkzeug.security import generate_password_hash
from pathlib import Path
from .auth import add_player_to_data, init_table
from .database import Player, Hex, Network
from . import db

def init_test_players(engine):
    members = []

    for i in range(3):
        members.append(create_player("Player"+str(i), i+1))
    members.append(create_player("Player3", 21))

    network = "Network1"
    create_network(network, members)

    if members[0] != None:
        members[1].steam_engine = 10
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


def create_player(username, tile_id):
    p = Player.query.filter_by(username=username).first()
    if p == None:
        tile = Hex.query.filter_by(id=tile_id).first()
        new_player = Player(
            username=username,
            password=generate_password_hash("password", method="sha256"),
            data_table_name=f"data_{username}.pck",
            tile = [tile],
        )
        add_player_to_data(username)
        init_table(username)
        db.session.add(new_player)
        db.session.commit()
        return new_player

def create_network(name, members):
    n = Network.query.filter_by(name=name).first()
    if n == None:
        new_Network = Network(name=name, members=members)
        db.session.add(new_Network)
        db.session.commit()
        Path(f"instance/network_data/{name}").mkdir(parents=True, exist_ok=True)