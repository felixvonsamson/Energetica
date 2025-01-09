"""Module for simulating user actions on the server."""

from __future__ import annotations

import cProfile
import pstats
from time import sleep
from typing import TYPE_CHECKING

import requests

from energetica.database.player import Player
from energetica.globals import engine
from energetica.utils.tick_execution import state_update

if TYPE_CHECKING:
    from flask import Flask


def create_user(user_id, username, pw_hash, port):
    """Create a user with the given user_id."""
    session = requests.Session()
    data = {"username": username, "pw_hash": pw_hash}
    response = session.post(f"http://localhost:{port}/sign-up", data=data, allow_redirects=False)
    assert response.status_code == 302
    assert next(Player.filter(username=username)).id == user_id
    return session


def login_user(user_id, port):
    """Login a user with the given user_id."""
    session = requests.Session()
    data = {"user_id": user_id}
    response = session.post(f"http://localhost:{port}/root_login", data=data, allow_redirects=False)
    assert response.status_code == 200
    return session


def verify():
    assert True


def simulate(*simulate_args, profiling=False, **simulate_kwargs):
    if not profiling:
        _simulate(*simulate_args, **simulate_kwargs)
    else:
        with cProfile.Profile() as profile:
            _simulate(*simulate_args, **simulate_kwargs)
            stats = pstats.Stats(profile)
        stats.sort_stats(pstats.SortKey.CUMULATIVE).print_stats(30)


def _simulate(
    app: Flask,
    port: int,
    actions: list[dict],
    simulating: bool,
    stop_on_mismatch: bool,
    stop_on_server_error: bool,
    stop_on_assertion_error: bool,
    checkpoint_every_k_ticks: int = 10000,
    checkpoint_ticks: list[int] | None = None,
) -> None:
    """Simulate the list of actions. Returns true if the simulation was successful, false otherwise."""
    if checkpoint_ticks is None:
        checkpoint_ticks = []
    with app.app_context():
        trials = 0
        while True:
            try:
                requests.get(f"http://localhost:{port}", timeout=1)
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
                state_update(app)
                if (
                    checkpoint_every_k_ticks
                    and action["total_t"] % checkpoint_every_k_ticks == 0
                    or action["total_t"] in checkpoint_ticks
                ):
                    engine.save_checkpoint(f"checkpoints/simulation/checkpoint_{action['total_t']}.tar.gz")
            elif action["action_type"] == "create_user":
                player_id = action["player_id"]
                username = action["username"] if simulating else f"user{player_id}"
                pw_hash = action["pw_hash"] if simulating else "password"
                user_sessions[player_id] = create_user(username, pw_hash, port)
            elif action["action_type"] == "request":
                player_id = action["player_id"]
                if player_id not in user_sessions:
                    user_sessions[player_id] = login_user(player_id, port)
                url = f"http://localhost:{port}{action['request']['endpoint']}"
                content_type = "json" if action["request"]["content_type"] == "application/json" else "data"
                response = user_sessions[player_id].post(
                    url, **{content_type: action["request"]["content"]}, allow_redirects=False
                )
                # TODO (Yassir): mismatch if content type is not the same
                # TODO(mglst): It would be nice to have both the expected and the actual response in the output
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
