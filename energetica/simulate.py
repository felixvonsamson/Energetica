"""Module for simulating user actions on the server."""

from __future__ import annotations

import cProfile
import pstats
from time import sleep
from typing import Any, cast

import requests

from energetica.database.player import Player
from energetica.globals import engine
from energetica.schemas.simulate import Action
from energetica.utils import misc
from energetica.utils.auth import add_session_cookie_to_session
from energetica.utils.tick_execution import tick

base_url: str | None = None


def create_user(user_id: int, username: str, pwhash: str) -> requests.Session:
    """Create a user with the given user_id."""
    new_player = misc.signup_player(None, username, pwhash)
    session = requests.Session()
    add_session_cookie_to_session(session, new_player)
    return session


def login_user(user_id: int) -> requests.Session:
    """Login a user with the given user_id."""
    player = Player.getitem(user_id, ValueError(f"Cannot log in player: player with id {user_id} does not exist"))
    session = requests.Session()
    add_session_cookie_to_session(session, player)
    return session


def verify() -> None:
    assert True


def simulate(*simulate_args: Any, profiling: bool = False, **simulate_kwargs: Any) -> bool:
    """
    Wrapper around _simulate. Allows to run profiling if requested.

    Returns true if the simulation was successful, false otherwise.
    """
    if not profiling:
        return _simulate(*simulate_args, **simulate_kwargs)
    else:
        with cProfile.Profile() as profile:
            retval = _simulate(*simulate_args, **simulate_kwargs)
            stats = pstats.Stats(profile)
        stats.sort_stats(pstats.SortKey.CUMULATIVE).print_stats(30)
        return retval


def _simulate(
    port: int,
    actions: list[Action],
    simulating: bool,
    stop_on_mismatch: bool,
    stop_on_server_error: bool,
    stop_on_assertion_error: bool,
    stop_on_unauthenticated_actions: bool,
    checkpoint_every_k_ticks: int = 10000,
    checkpoint_ticks: list[int] | None = None,
) -> bool:
    """Simulate the list of actions. Returns true if the simulation was successful, false otherwise."""
    global base_url

    base_url = f"http://localhost:{port}"

    if checkpoint_ticks is None:
        checkpoint_ticks = []

    trials = 0
    while True:
        try:
            requests.get(base_url, timeout=1)
        except requests.exceptions.ConnectionError:
            trials += 1
            if trials == 10:
                print("Server is not running.")
                exit(1)
            sleep(1)
            continue
        break
    user_sessions = {}

    for action in actions:
        print(action)
        if action.action_type == "tick":
            tick()
            if (
                checkpoint_every_k_ticks
                and action.total_t % checkpoint_every_k_ticks == 0
                or action.total_t in checkpoint_ticks
            ):
                engine.save_checkpoint(f"checkpoints/simulation/checkpoint_{action.total_t}.tar.gz")
        elif action.action_type == "create_user":
            player_id = action.player_id
            user_sessions[player_id] = create_user(player_id, action.username, action.pw_hash)
        elif action.action_type == "request":
            player_id = action.player_id
            if player_id:
                if player_id not in user_sessions:
                    user_sessions[player_id] = login_user(player_id)
                session = cast(requests.Session, user_sessions[player_id])
            else:
                print(
                    f"""\033[31mUnauthenticated action encountered""",
                )
                if stop_on_unauthenticated_actions:
                    break
                session = requests.Session()
            url = f"{base_url}{action.request.endpoint}"
            content_type = "json" if action.request.content_type == "application/json" else "data"
            method = action.request.method
            try:
                method_func = getattr(session, method.lower())
            except AttributeError:
                raise ValueError(f"Cannot manage the following method: {method}")
            response = method_func(
                url,
                **{content_type: action.request.payload},
                allow_redirects=False,
            )
            # TODO (Yassir): mismatch if content type is not the same
            # if "money" in action.response.payload:
            #     money = action.response.payload["money"]
            #     real_money = Player.getitem(player_id).money
            #     if abs(money - real_money) > 1:
            #         print(
            #             f"""\033[31mMoney {real_money} does not match expected money """
            #             f"""{money}.\033[0m""",
            #         )
            #         if stop_on_mismatch:
            #             break
            # if (
            #     action.response["content_type"] == "application/json"
            #     and response.headers["Content-Type"] == "application/json"
            #     and response.json()["response"] != action.response["content"]["response"]
            # ):
            #     print(
            #         f"""\033[31mResponse {response.json()["response"]} does not match expected response """
            #         f"""{action.response["content"]["response"]}.\033[0m""",
            #     )
            #     if stop_on_mismatch:
            #         break
            if response.status_code != action.response.status_code:
                print(
                    f"""\033[31mStatus code {response.status_code} does not match expected status code """
                    f"""{action.response.status_code}.\033[0m""",
                )
                if stop_on_mismatch:
                    break
            if response.status_code != 200:
                print(f"Status code: {response.status_code}")
                if response.status_code // 100 == 4:
                    print("\033[33m" + response.text + "\033[0m")
                elif response.status_code // 100 == 5:
                    print("\033[31mServer error, look at the stack above.\033[0m")
                    if stop_on_server_error:
                        break
        try:
            verify()
        except AssertionError:
            print(print("\033[31m" + "Assertion error.\033[0m"))
            if stop_on_assertion_error:
                break
    else:
        return True
    return False
