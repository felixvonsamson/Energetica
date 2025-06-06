"""Miscellaneous util functions."""

import math
import os
import pickle
from datetime import datetime, timedelta

import numpy as np
from noise import pnoise3
from scipy.stats import norm

from energetica import technology_effects
from energetica.config.assets import river_discharge_seasonal
from energetica.database.active_facility import ActiveFacility
from energetica.database.map import HexTile
from energetica.database.messages import Chat, Message, Notification
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.enums import ControllableFacilityType
from energetica.game_error import GameError
from energetica.globals import engine
from energetica.utils.astro import DrHI

# Helper functions and data initialization utilities


def add_player_to_data(player: Player) -> None:
    """Add a new player to the engine data."""
    player.capacities.update(player, None)


def reduce_resolution(array: list, new_values: np.ndarray) -> None:
    """Reduce resolution of current array x6, x36, x216 and x1296."""
    array[0] = array[0][len(new_values) :]
    array[0].extend(new_values)
    new_values_reduced = new_values
    for r in range(1, 4):
        new_values_reduced = np.mean(new_values_reduced.reshape(-1, 6), axis=1)
        array[r] = array[r][len(new_values_reduced) :]
        array[r].extend(new_values_reduced)
    if engine.total_t % 1296 == 0:
        array[4] = array[4][1:]
        array[4].append(np.mean(array[3][-6:]))


def save_past_data() -> None:
    """Save the past production data to files every 216 ticks AND remove network data older than 24h."""
    # save climate data
    with open("instance/data/servers/climate_data.pck", "rb") as file:
        past_climate_data = pickle.load(file)
    new_climate_data = engine.current_climate_data.get_data()
    for category in new_climate_data:
        for element in new_climate_data[category]:
            new_el_data = new_climate_data[category][element]
            past_el_data = past_climate_data[category][element]
            reduce_resolution(past_el_data, np.array(new_el_data))
    with open("instance/data/servers/climate_data.pck", "wb") as file:
        pickle.dump(past_climate_data, file)

    # save player data
    for player in Player.all():
        if player.tile is None:
            continue
        past_data = {}
        with open(
            f"instance/data/players/player_{player.id}.pck",
            "rb",
        ) as file:
            past_data = pickle.load(file)
        new_data = player.rolling_history.get_data()
        for category in new_data:
            for element in new_data[category]:
                new_el_data = new_data[category][element]
                if element not in past_data[category]:
                    # if facility didn't exist in past data, initialize it
                    past_data[category][element] = [[0.0] * 360 for _ in range(5)]
                past_el_data = past_data[category][element]
                reduce_resolution(past_el_data, np.array(new_el_data))

        with open(f"instance/data/players/player_{player.id}.pck", "wb") as file:
            pickle.dump(past_data, file)

    # remove old network files AND save past prices
    networks = Network.all()
    for network in networks:
        network_dir = f"instance/data/networks/{network.id}/charts/"
        files = os.listdir(network_dir)
        for filename in files:
            t_value = int(filename.split("market_t")[1].split(".pck")[0])
            if t_value < engine.total_t - 1440:
                os.remove(os.path.join(network_dir, filename))

        past_data = {}
        with open(
            f"instance/data/networks/{network.id}/time_series.pck",
            "rb",
        ) as file:
            past_data = pickle.load(file)

        new_data = network.rolling_history.get_data()
        for category in new_data:
            for group, buffer in new_data[category].items():
                if group not in past_data[category]:
                    past_data[category][group] = [[0.0] * 360 for _ in range(5)]
                past_el_data = past_data[category][group]
                reduce_resolution(past_el_data, np.array(buffer))

        with open(f"instance/data/networks/{network.id}/time_series.pck", "wb") as file:
            pickle.dump(past_data, file)

    # remove old notifications
    for notification in Notification.filter(
        lambda notification: notification.title != "Tutorial"
        and notification.time < datetime.now() - timedelta(weeks=2),
    ):
        notification.delete()

    engine.log("last 216 data points have been saved to files")
    engine.save()


def display_new_message(message: Message, chat: Chat) -> None:
    """Send a chat message to all relevant sources through socketio and websocket."""
    # websocket_message = websocket.rest_new_chat_message(chat.id, message)
    for player in chat.participants:
        player.emit(
            "display_new_message",
            {
                "time": message.time.isoformat(),
                "player_id": message.player.id,
                "text": message.text,
                "chat_id": message.chat.id,
            },
        )
        # websocket.rest_notify_player(player, websocket_message)


# Map


def confirm_location(player: Player, tile: HexTile) -> None:
    """
    Confirm a location choice.

    Return either success or an explanatory error message in the form of a dictionary.
    Called when a web client uses the choose_location socket.io endpoint, or the REST websocket API.
    """
    if tile.player is not None:
        # Location already taken
        raise GameError("locationOccupied", by=tile.player.id)
    if player.tile is not None:
        # Player has already chosen a location and cannot chose again
        raise GameError("choiceUnmodifiable")

    # Checks have succeeded, proceed
    tile.player = player
    player.tile = tile
    initialize_player(player)
    engine.log(f"{player.username} chose the location {tile.id}")


def initialize_player(player: Player) -> None:
    """
    Initialize a player's data after they have chosen a location.

    This includes:
    - Giving the player an initial steam engine
    - Adding the player to the general chat
    """
    eol = engine.total_t + math.ceil(
        engine.const_config["assets"]["steam_engine"]["lifespan"] / engine.in_game_seconds_per_tick,
    )
    if player.tile is None:
        raise GameError("noLocation")
    pos_x = player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1]
    pos_y = player.tile.coordinates[1]
    ActiveFacility(
        facility_type=ControllableFacilityType.STEAM_ENGINE,
        position=(pos_x, pos_y),
        end_of_life=eol,
        player=player,
        multipliers=technology_effects.current_multipliers(player, ControllableFacilityType.STEAM_ENGINE),
    )
    player.capacities.update(player, ControllableFacilityType.STEAM_ENGINE)

    general_chat = Chat.get(1)
    if general_chat is None:
        raise GameError("chatNotFound")
    general_chat.participants.add(player)

    add_player_to_data(player)

    def init_array() -> list[list[float]]:
        return [[0.0] * 360 for _ in range(5)]

    past_data = {
        "revenues": {
            "industry": init_array(),
            "exports": init_array(),
            "imports": init_array(),
            "dumping": init_array(),
            "climate_events": init_array(),
        },
        "op_costs": {
            "steam_engine": init_array(),
        },
        "generation": {
            "steam_engine": init_array(),
            "imports": init_array(),
        },
        "demand": {
            "industry": init_array(),
            "construction": init_array(),
            "research": init_array(),
            "transport": init_array(),
            "exports": init_array(),
            "dumping": init_array(),
        },
        "storage": {},
        "resources": {},
        "emissions": {
            "steam_engine": init_array(),
            "construction": init_array(),
        },
    }
    with open(f"instance/data/players/player_{player.id}.pck", "wb") as file:
        pickle.dump(past_data, file)
    player.rolling_history.add_subcategory("op_costs", ControllableFacilityType.STEAM_ENGINE)
    player.rolling_history.add_subcategory("generation", ControllableFacilityType.STEAM_ENGINE)
    player.rolling_history.add_subcategory("emissions", ControllableFacilityType.STEAM_ENGINE)
    # websocket.rest_notify_player_location(player)


# Quiz
def submit_quiz_answer(player: Player, answer: str) -> bool:
    """Return True if the answer was correct, False otherwise."""
    quiz_data = engine.daily_question
    if player.id in quiz_data["player_answers"]:
        raise GameError("quizAlreadyAnswered")
    quiz_data["player_answers"][player.id] = answer
    if answer == quiz_data["answer"] or quiz_data["answer"] == "all correct":
        player.progression_metrics["xp"] += 1
        engine.log(f"{player.username} answered the quiz correctly")
        return True
    engine.log(f"{player.username} answered the quiz incorrectly")
    return False


def get_quiz_question(player: Player) -> dict:
    """Return the data for the quiz question in the form of a dictionary with only the answer of the current player."""
    question_data = engine.daily_question.copy()
    if player.id in question_data["player_answers"]:
        question_data["player_answer"] = question_data["player_answers"][player.id]
    del question_data["player_answers"]
    return question_data


# Weather


def calculate_solar_irradiance(position: tuple[float, float], total_seconds: float, random_seed: int) -> float:
    """
    Calculate the solar irradiance for a given location and time.

    The clear sky index is derived from a 3d perlin noise function that moves in time to simulate the cloud cover.
    The clear sky index is then multiplied by the clear sky irradiance to get the solar irradiance.
    The irradiance is capped at 1000 W/m^2.
    """

    def transformation(noise_value: float, threshold: float = 0, smoothness: float = 2) -> float:
        """Sigmoid transformation."""
        return 1 / (1 + np.exp(-(noise_value - threshold) * 10 / smoothness))

    # Calculate the real day and time in a year for a given tick
    start_date = datetime(2023, 7, 1)  # 6 months offset because i'm using the southern hemisphere
    day_of_year = int((total_seconds / 3600 / 24 / 72) % 1 * 365)
    time_of_day = total_seconds % (3600 * 24)
    weather_datetime = start_date + timedelta(days=day_of_year, seconds=time_of_day)

    x_noise = position[0] + total_seconds / 2400
    y_noise = position[1] + total_seconds / 4000
    t = total_seconds / 3600 / 24
    regional_noise = pnoise3(
        x_noise / 50,
        y_noise / 50,
        t,
        octaves=2,
        persistence=0.5,
        lacunarity=2.0,
        base=random_seed,
    )
    regional_noise = transformation(regional_noise, smoothness=1) * 2 - 1
    cloud_cover_noise = pnoise3(x_noise, y_noise, t, octaves=6, persistence=0.5, lacunarity=2.0, base=random_seed)
    cloud_cover_noise = transformation(
        cloud_cover_noise,
        threshold=0.5 * regional_noise,
        smoothness=max(0.3, 1 - regional_noise),
    )
    csi = 1 - min(0.9, 5 - regional_noise * 5) * cloud_cover_noise
    clear_sky = DrHI(weather_datetime.timestamp(), (position[1] - 10) * 85 / 21, 0)
    return min(950, csi * clear_sky)


def calculate_wind_speed(position: tuple[float, float], total_seconds: float, random_seed: int) -> float:
    """
    Calculate the wind speed for a given location and time.

    The wind speed is derived from a 3d perlin noise function with a superposition of specific frequencies.
    Two sinusoidal functions are multiplied to the noise to simulate the diurnal and seasonal wind patterns.
    """
    x, y = position
    t = total_seconds / 60
    wind_speed_noise = (
        0.9 * pnoise3(x / 20, y / 20, t / 5760, base=random_seed)
        + 0.06 * pnoise3(x, y, t / 360, base=random_seed)
        + 0.03 * pnoise3(x * 3, y * 3, t / 90, base=random_seed)
        + 0.007 * pnoise3(x * 18, y * 18, t / 15, base=random_seed)
        + 0.003 * pnoise3(x * 108, y * 108, t / 2.5, base=random_seed)
    )
    wind_speed_noise = norm.cdf(wind_speed_noise, loc=0, scale=0.15)
    wind_speed_noise = (1 - (1 - wind_speed_noise) ** 0.1282) ** 0.4673
    return (
        wind_speed_noise
        * (1 + 0.4 * math.sin(t / 60 / 24 / 72 * math.pi * 2 + 0.5 * math.pi))
        * (1 + 0.1 * math.sin(t / 60 / 24 * math.pi * 2 + 0.4 * math.pi))
        * 85
    )


def calculate_river_discharge(total_seconds: float) -> float:
    """Calculate the river discharge by interpolating the values from the seasonal variation."""
    days_since_start = math.floor(total_seconds / 3600 / 24)
    current_day_fraction = (total_seconds % (3600 * 24)) / (3600 * 24)
    discharge_factor = river_discharge_seasonal[days_since_start % 72] + current_day_fraction * (
        river_discharge_seasonal[(days_since_start + 1) % 72] - river_discharge_seasonal[days_since_start % 72]
    )
    return discharge_factor * 150  # in m^3/s


def package_weather_data(player: Player) -> dict:
    """Package date and weather data for a player."""
    if player.tile is None:
        raise GameError("noLocation")
    x = player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1]
    y = player.tile.coordinates[1] * 0.5 * 3**0.5
    total_seconds = (engine.total_t + engine.delta_t) * engine.in_game_seconds_per_tick
    random_seed = engine.random_seed
    solar_irradiance = calculate_solar_irradiance((x, y), total_seconds, random_seed)
    wind_speed = calculate_wind_speed((x, y), total_seconds, random_seed)
    river_discharge = calculate_river_discharge(total_seconds)
    months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    return {
        "year_progress": (total_seconds / 3600 / 24 / 72) % 1,
        "month": months[math.floor((total_seconds / 3600 / 24 / 6) % 12)],
        "solar_irradiance": solar_irradiance,
        "wind_speed": wind_speed,
        "river_discharge": river_discharge,
    }
