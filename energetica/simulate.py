"""Module for simulating user actions on the server."""

from __future__ import annotations

import cProfile
import pstats
from time import sleep
from typing import Any

import requests

from energetica.database.player import Player
from energetica.globals import engine
from energetica.utils.tick_execution import tick

base_url: str | None = None


def create_user(user_id: int, username: str, password: str) -> requests.Session:
    """Create a user with the given user_id."""
    session = requests.Session()
    json = {"username": username, "password": password}
    response = session.post(f"{base_url}/sign-up", json=json, allow_redirects=False)
    assert response.status_code == 201
    assert next(Player.filter_by(username=username)).id == user_id
    return session


def login_user(user_id: int) -> requests.Session:
    """Login a user with the given user_id."""
    session = requests.Session()
    data = {"user_id": user_id}
    response = session.post(f"{base_url}/root_login", data=data, allow_redirects=False)
    assert response.status_code == 200
    return session


def verify() -> None:
    assert True


def simulate(*simulate_args: Any, profiling: bool = False, **simulate_kwargs: Any) -> None:
    if not profiling:
        _simulate(*simulate_args, **simulate_kwargs)
    else:
        with cProfile.Profile() as profile:
            _simulate(*simulate_args, **simulate_kwargs)
            stats = pstats.Stats(profile)
        stats.sort_stats(pstats.SortKey.CUMULATIVE).print_stats(30)


def _simulate(
    port: int,
    actions: list[dict],
    simulating: bool,
    stop_on_mismatch: bool,
    stop_on_server_error: bool,
    stop_on_assertion_error: bool,
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
        if action["action_type"] == "tick":
            tick()
            if (
                checkpoint_every_k_ticks
                and action["total_t"] % checkpoint_every_k_ticks == 0
                or action["total_t"] in checkpoint_ticks
            ):
                engine.save_checkpoint(f"checkpoints/simulation/checkpoint_{action['total_t']}.tar.gz")
        elif action["action_type"] == "create_user":
            player_id = action["player_id"]
            username = action["username"] if not simulating else f"user{player_id}"
            password = "password"
            user_sessions[player_id] = create_user(player_id, username, password)
        elif action["action_type"] == "request":
            player_id = action["player_id"]
            if player_id not in user_sessions:
                user_sessions[player_id] = login_user(player_id)
            url = f"{base_url}{action['request']['endpoint']}"
            content_type = "json" if action["request"]["content_type"] == "application/json" else "data"
            response = user_sessions[player_id].post(
                url,
                **{content_type: action["request"]["content"]},
                allow_redirects=False,
            )
            # TODO (Yassir): mismatch if content type is not the same
            if "money" in action["response"]["content"]:
                money = action["response"]["content"]["money"]
                real_money = Player.get(player_id).money
                if abs(money - real_money) > 1:
                    print(
                        f"""\033[31mMoney {real_money} does not match expected money """
                        f"""{money}.\033[0m""",
                    )
                    if stop_on_mismatch:
                        break
            if (
                action["response"]["content_type"] == "application/json"
                and response.headers["Content-Type"] == "application/json"
                and response.json()["response"] != action["response"]["content"]["response"]
            ):
                print(
                    f"""\033[31mResponse {response.json()["response"]} does not match expected response """
                    f"""{action["response"]["content"]["response"]}.\033[0m""",
                )
                if stop_on_mismatch:
                    break
            if response.status_code != action["response"]["status_code"]:
                print(
                    f"""\033[31mStatus code {response.status_code} does not match expected status code """
                    f"""{action["response"]["status_code"]}.\033[0m""",
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
