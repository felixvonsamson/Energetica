"""
I dumped all small helpful functions here
"""

import time
import requests
import json
import math
import numpy as np
from .database import Player, Under_construction, Shipment, Chat
from . import db
from flask import current_app
from sqlalchemy import func

# this function is executed after an asset is finished facility :
def add_asset(player_id, facility):
    player = Player.query.get(int(player_id))
    assets = current_app.config["engine"].config[player_id]["assets"]
    setattr(player, facility, getattr(player, facility) + 1)
    facility_data = assets[facility]
    # player.emissions += ??? IMPLEMENT EMMISIONS FROM CONSTRUCTION
    Under_construction.query.filter(
        Under_construction.finish_time < time.time()
    ).delete()
    db.session.commit()

# this function is executed when a resource shippment arrives :
def store_import(player_id, resource, quantity):
    player = Player.query.get(int(player_id))
    max_cap = current_app.config["engine"].config[player_id][
        "warehouse_capacities"][resource]
    if getattr(player, resource) + quantity > max_cap:
        setattr(player, resource, max_cap)
        # excess ressources are stored in the ground
        setattr(player.tile[0], resource, getattr(player.tile[0], resource) + 
                getattr(player, resource) + quantity - max_cap)
    else :
        setattr(player, resource, getattr(player, resource) + quantity)
    Shipment.query.filter(Shipment.arrival_time < time.time()).delete()
    db.session.commit()

# format for price display
def display_CHF(price):
    return f"{price:,.0f} CHF".replace(",", " ")

# checks if a chat with exactly these participants already exists
def check_existing_chats(participants):
    # Get the IDs of the participants
    participant_ids = [participant.id for participant in participants]

    # Generate the conditions for participants' IDs and count
    conditions = [Chat.participants.any(id=participant_id) for participant_id in participant_ids]

    # Query the Chat table
    existing_chats = Chat.query.filter(*conditions)
    for chat in existing_chats:
        if len(chat.participants)==len(participants):
            return True
    return False

# This function upddates the windspeed and irradiation data every 10 mminutes by using the meteosuisse api
def update_weather(engine):
    url_wind = "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min_en.json"
    url_irr = "https://data.geo.admin.ch/ch.meteoschweiz.messwerte-globalstrahlung-10min/ch.meteoschweiz.messwerte-globalstrahlung-10min_en.json"
    t = engine.current_t
    try:
        response = requests.get(url_wind)
        if response.status_code == 200:
            windspeed = json.loads(response.content)['features'][107]['properties']['value']
            interpolation = np.linspace(engine.current_windspeed[t-1], windspeed, 11)
            engine.current_windspeed[t : t+10] = interpolation[1:]
        else:
            print("Failed to fetch the file. Status code:", response.status_code)
            engine.current_windspeed[t : t+10] = [engine.current_windspeed[t-1]]*10
    except Exception as e:
        print("An error occurred:", e)
        engine.current_windspeed[t : t+10] = [engine.current_windspeed[t-1]]*10

    try:
        response = requests.get(url_irr)
        if response.status_code == 200:
            irradiation = json.loads(response.content)['features'][65]['properties']['value']
            interpolation = np.linspace(engine.current_irradiation[t-1], irradiation, 11)
            engine.current_irradiation[t : t+10] = interpolation[1:]
        else:
            print("Failed to fetch the file. Status code:", response.status_code)
            engine.current_irradiation[t : t+10] = [engine.current_irradiation[t-1]]*10
    except Exception as e:
        print("An error occurred:", e)
        engine.current_irradiation[t : t+10] = [engine.current_irradiation[t-1]]*10

    month = math.floor((engine.total_t%60000)/5000)
    f = (engine.total_t%60000)/5000 - month
    d = engine.river_discharge
    power_factor = d[month]+(d[(month+1)%12]-d[month])*f
    engine.current_discharge[t : t+10] = [power_factor]*10
