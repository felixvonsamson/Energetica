import sys
import pickle

from website.database import engine_data


class CustomModule:
    def __init__(self):
        self.CircularBufferPlayer = engine_data.CircularBufferPlayer
        self.CircularBufferNetwork = engine_data.CircularBufferNetwork
        self.WeatherData = engine_data.WeatherData
        self.EmissionData = engine_data.EmissionData


sys.modules["website.database"] = CustomModule()
with open("instance/engine_data.pck", "rb") as old_file:
    old_engine_data = pickle.load(old_file)
    with open("instance/engine_data.pck", "wb") as new_file:
        pickle.dump(old_engine_data, new_file)
        print("dumped updated engine data successfully!")
