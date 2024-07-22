from pathlib import Path
import pickle
import math
from collections import deque

from website.database import engine_data

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# DATABASE_URI = "sqlite:///instance/database.db"
# engine = create_engine(DATABASE_URI)
# Session = sessionmaker(bind=engine)
# session = Session()

# # Add the new column with a default value
# session.execute(text("ALTER TABLE player ADD COLUMN graph_view STRING DEFAULT 'basic'"))
# session.commit()

from website.database.player import Player, Network

with open("instance/engine_data.pck", "rb") as old_file:
    old_engine_data = pickle.load(old_file)

old_engine_data["start_date"] = math.floor(old_engine_data["start_date"].timestamp() / 30) * 30

# old_engine_data["network_capacities"] = {}
# networks = session.query(Network).all()
# for network in networks:
#     old_engine_data["network_capacities"][network.id] = engine_data.CapacityData()
#     old_engine_data["network_capacities"][network.id]._data = {}
#     for player in network.members:
#         player_capacities = old_engine_data["player_capacities"][player.id].get_all()
#         for facility in player_capacities:
#             if "power" in player_capacities[facility]:
#                 if facility not in old_engine_data["network_capacities"][network.id]._data:
#                     old_engine_data["network_capacities"][network.id]._data[facility] = {"power": 0.0}
#                 old_engine_data["network_capacities"][network.id]._data[facility]["power"] += player_capacities[
#                     facility
#                 ]["power"]

#     old_engine_data["network_data"][network.id]._data["consumption"] = {}
#     old_engine_data["network_data"][network.id]._data["generation"] = {}
#     for facility in old_engine_data["network_capacities"][network.id]._data:
#         old_engine_data["network_data"][network.id]._data["consumption"][facility] = deque([0.0] * 360, maxlen=360)
#         old_engine_data["network_data"][network.id]._data["generation"][facility] = deque([0.0] * 360, maxlen=360)

#     with open(f"instance/network_data/{network.id}/time_series.pck", "rb") as file:
#         old_network_data = pickle.load(file)
#         old_network_data["consumption"] = {}
#         old_network_data["generation"] = {}
#         for facility in old_engine_data["network_capacities"][network.id]._data:
#             old_network_data["consumption"][facility] = [[0.0] * 360] * 5
#             old_network_data["generation"][facility] = [[0.0] * 360] * 5
#         with open(f"instance/network_data/{network.id}/time_series.pck", "wb") as file:
#             pickle.dump(old_network_data, file)

# # remove obselete O&M data
# players = session.query(Player).all()
# for player in players:
#     if Path(f"instance/player_data/player_{player.id}.pck").is_file():
#         with open(f"instance/player_data/player_{player.id}.pck", "rb") as file:
#             old_player_data = pickle.load(file)
#             if "O&M_costs" in old_player_data["revenues"]:
#                 del old_player_data["revenues"]["O&M_costs"]
#         with open(f"instance/player_data/player_{player.id}.pck", "wb") as file:
#             pickle.dump(old_player_data, file)


# players = session.query(Player).all()
# # for player in players:


with open("instance/engine_data.pck", "wb") as new_file:
    pickle.dump(old_engine_data, new_file)
    print("dumped updated engine data successfully!")
