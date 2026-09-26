"""Miscellaneous utility functions."""

import math
import os
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import Request

from energetica import accounts, instance_config, technology_effects
from energetica.accounts import Account
from energetica.database.active_facility import ActiveFacility
from energetica.database.map.hex_tile import HexTile
from energetica.database.messages import Chat, Message
from energetica.database.network import Network
from energetica.database.player import Player
from energetica.enums import ControllableFacilityType
from energetica.game_error import GameError, GameExceptionType
from energetica.globals import engine
from energetica.schemas.daily_quiz import DailyQuizBase
from energetica.schemas.simulate import CreateUserAction
from energetica.schemas.weather import WeatherOut
from energetica.sim.renewables import calculate_river_speed, calculate_solar_irradiance, calculate_wind_speed

# Helper functions and data initialization utilities


def signup_playing_user(request: Request | None, username: str, pwhash: str) -> Account:
    """
    Sign up an account with the player role.

    Writes the credentials to the server-wide SQLite accounts store. There is no per-instance
    object to create at signup time any more (see ADR-0004) — a ``Player`` is only created later,
    at settle.

    Calling with request set to null is reserved for simulation - when APIs call this function, they must pass the
    corresponding request object.
    """
    account_id = accounts.create_account(username=username, pwhash=pwhash)
    account = accounts.get_account_by_id(account_id)
    assert account is not None

    log_entry = CreateUserAction(
        timestamp=datetime.now(),
        ip=request.headers.get("X-Forwarded-For", request.client.host if request.client is not None else "null")
        if request is not None
        else None,
        action_type="create_user",
        user_id=account.account_id,
        username=account.username,
        pw_hash=account.pwhash,
    )
    engine.log_action(log_entry)

    engine.log(f"{username} created an account")
    return account


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


def init_array() -> list[list[float]]:
    return [[0.0] * 360 for _ in range(5)]


def empty_player_data() -> dict:
    """return an empty data structure for a new player."""
    return {
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
        "storage_soc": {},
        "resources": {},
        "emissions": {
            "steam_engine": init_array(),
            "construction": init_array(),
        },
        "money": {
            "balance": init_array(),
        },
    }


def empty_network_data() -> dict:
    """return an empty data structure for a new network."""
    return {
        "network_data": {
            "price": init_array(),
            "quantity": init_array(),
        },
        "exports": {},
        "imports": {},
        "generation": {},
        "consumption": {},
    }


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
        past_data = {}
        if not os.path.exists(f"instance/data/players/player_{player.id}.pck"):
            with open(f"instance/data/players/player_{player.id}.pck", "wb") as file:
                pickle.dump(empty_player_data(), file)
        with open(
            f"instance/data/players/player_{player.id}.pck",
            "rb",
        ) as file:
            past_data = pickle.load(file)
        new_data = player.rolling_history.get_data()
        for category in new_data:
            if category not in past_data:
                # if category didn't exist in past data (e.g. new category added in a deploy), initialize it
                past_data[category] = {}
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

        if not os.path.exists(f"instance/data/networks/{network.id}/time_series.pck"):
            Path(f"instance/data/networks/{network.id}").mkdir(parents=True, exist_ok=True)
            with open(f"instance/data/networks/{network.id}/time_series.pck", "wb") as file:
                pickle.dump(empty_network_data(), file)
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

    engine.log("last 216 data points have been saved to files")
    engine.save()


def send_new_message_sio(message: Message, chat: Chat) -> None:
    """Send a chat message through socketio."""
    for player in chat.participants:
        player.emit(
            "display_new_message",
            {
                "id": message.id,
                "time": message.timestamp.isoformat(),
                "player_id": message.player.id,
                "text": message.text,
                "chat_id": message.chat.id,
            },
        )


# Map


def initialize_player(account: Account, tile: HexTile) -> Player:
    """
    Initialize a player's data after they have chosen a location.

    This includes:
    - Giving the player an initial steam engine
    - Adding the player to the general chat
    """
    # Settling is what makes this run appear under the account's "your runs" in the lobby and the
    # in-run switcher. No-op without a slug (dev / unconfigured), where there is no lobby anyway.
    #
    # This write happens BEFORE any of the engine mutation below, and is deliberately left
    # uncaught: everything from here down (tile claim, Player creation, chat join, facility,
    # rolling history) is in-memory engine state that is hard to cleanly undo once touched — the
    # tile claim especially is a shared resource other players immediately see as taken. A DB
    # failure (e.g. SQLITE_BUSY on the shared accounts.db) must abort BEFORE any of that happens,
    # not after: a request that mutated the engine and then 500'd would leave the player settled
    # in-engine with no way to retry (the tile is already claimed, CHOICE_UNMODIFIABLE fires on
    # retry) and no membership row to show for it — worse than just failing outright up front.
    # Letting the exception propagate here, before any mutation, means a transient failure is a
    # clean no-op: nothing happened, the client gets a 500, and a retry is always safe.
    #
    # MembershipRoleConflictError also propagates uncaught: get_playing_account already rejects a
    # facilitator before they ever reach settle, so this should be unreachable — if it ever fires,
    # that invariant broke and the 500 should surface loudly, not be treated as a transient hiccup.
    slug = instance_config.instance_slug()
    settled_at = datetime.now(timezone.utc)
    if slug is not None:
        accounts.record_settlement(account_id=account.account_id, slug=slug, settled_at=settled_at.isoformat())

    player = Player(
        username=account.username,
        pwhash=account.pwhash,
        account_id=account.account_id,
        tile=tile,
        created_at=settled_at,
    )
    tile.player = player

    eol = engine.total_t + math.ceil(
        engine.const_config["assets"]["steam_engine"]["lifespan"] / engine.in_game_seconds_per_tick,
    )
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

    engine.general_chat.add_player(player)

    add_player_to_data(player)

    player.rolling_history.add_subcategory("op_costs", ControllableFacilityType.STEAM_ENGINE)
    player.rolling_history.add_subcategory("generation", ControllableFacilityType.STEAM_ENGINE)
    player.rolling_history.add_subcategory("emissions", ControllableFacilityType.STEAM_ENGINE)

    engine.log(f"{player.username} chose the location {tile.id}")
    return player


def record_join_reconciling_settlement(*, account_id: int, slug: str, joined_at: str) -> None:
    """Record a join (:func:`accounts.record_join`), then immediately reconcile ``settled_at`` if
    the account already has a ``Player`` in this run's engine.

    Covers the re-add-after-ban case (#1031 follow-up, per review): :func:`accounts.remove_membership`
    is a plain delete, so a previously-settled account that gets banned and later re-added would
    otherwise come back with ``settled_at`` reset to null even though its ``Player`` — tile,
    resources, facilities, all in-engine — never went anywhere; a ban only revokes the *next*
    entry attempt (see that function's docstring). The entry gate itself was never actually
    broken by this (``is_settled`` is derived straight from ``Player.filter_by``, never from
    ``settled_at``), but without this reconciliation the lobby would permanently mislabel the run
    "not yet settled" for that account and offer a "Settle" CTA that just redirects back to the
    dashboard. Only called from the two write paths that can re-add an already-settled account —
    the facilitator roster's add and the private join-link's confirm.

    Raises :class:`accounts.MembershipRoleConflictError` exactly like ``record_join`` — never
    swallowed here, unlike the best-effort settle-time write in :func:`initialize_player`: a
    roster/join-link write failing should surface loudly, not be treated as an incidental hiccup.
    """
    accounts.record_join(account_id=account_id, slug=slug, joined_at=joined_at)
    player = next(Player.filter_by(account_id=account_id), None)
    if player is not None:
        accounts.record_settlement(account_id=account_id, slug=slug, settled_at=player.created_at.isoformat())


# Quiz
def submit_quiz_answer(player: Player, player_answer: str) -> bool:
    """Return True if the answer was correct, False otherwise."""
    quiz_data = engine.daily_question
    if player.id in quiz_data["player_answers"]:
        raise GameError(GameExceptionType.QUIZ_ALREADY_ANSWERED)
    quiz_data["player_answers"][player.id] = player_answer
    player.progression_metrics["quiz_answers_total"] += 1
    if player_answer == quiz_data["answer"] or quiz_data["answer"] == "all correct":
        player.progression_metrics["xp"] += 1
        engine.log(f"{player.username} answered the quiz correctly")
        is_answer_correct = True
    else:
        engine.log(f"{player.username} answered the quiz incorrectly")
        is_answer_correct = False

    # Invalidate quiz query on all devices for this player
    player.invalidate_queries(["daily-quiz", "today"])

    return is_answer_correct


def get_quiz_question(player: Player) -> DailyQuizBase:
    """Return the data for the quiz question with only the answer of the current player."""
    quiz_data = engine.daily_question
    if player.id in quiz_data["player_answers"]:
        return DailyQuizBase(
            question=quiz_data["question"],
            answer1=quiz_data["answer1"],
            answer2=quiz_data["answer2"],
            answer3=quiz_data["answer3"],
            player_answer=quiz_data["player_answers"][player.id],
            answered_correctly=quiz_data["player_answers"][player.id] == quiz_data["answer"]
            or quiz_data["answer"] == "all correct",
            correct_answer=quiz_data["answer"],
            explanation=quiz_data["explanation"],
            learn_more_link=quiz_data["learn_more_link"],
        )
    else:
        return DailyQuizBase(
            question=quiz_data["question"],
            answer1=quiz_data["answer1"],
            answer2=quiz_data["answer2"],
            answer3=quiz_data["answer3"],
        )


# Weather


def package_weather_data(player: Player) -> WeatherOut:
    """Package date and weather data for a player."""
    x = player.tile.coordinates[0] + 0.5 * player.tile.coordinates[1]
    y = player.tile.coordinates[1] * 0.5 * 3**0.5
    total_seconds = (engine.total_t + engine.delta_t) * engine.in_game_seconds_per_tick
    random_seed = engine.random_seed
    solar_irradiance, clear_sky_value, clear_sky_index = calculate_solar_irradiance(
        (x, y), total_seconds, random_seed, engine.days_per_year
    )
    wind_speed = calculate_wind_speed((x, y), total_seconds, random_seed, engine.days_per_year)
    river_flow_speed = calculate_river_speed(total_seconds, engine.days_per_year)
    return WeatherOut(
        year_progress=(total_seconds / 3600 / 24 / engine.days_per_year) % 1,
        month_number=1 + math.floor((total_seconds / 3600 / 24 / (engine.days_per_year / 12)) % 12),
        solar_irradiance=solar_irradiance,
        clear_sky_value=clear_sky_value,
        clear_sky_index=clear_sky_index,
        wind_speed=wind_speed,
        river_flow_speed=river_flow_speed,
    )
