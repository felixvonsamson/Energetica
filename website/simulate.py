import pickle
import tarfile
from time import sleep

import requests
from flask import current_app


def create_user(id, port):
    session = requests.Session()
    data = {"username": f"user{id}", "password1": "password", "password2": "password"}
    session.post(f"http://localhost:{port}/sign-up", data=data)
    return session


def login_user(id, port):
    session = requests.Session()
    data = {"username": f"user{id}", "password": "password"}
    session.post(f"http://localhost:{port}/login", data=data)
    return session


def verify(engine):
    assert True


def simulate(app, port, create_users, actions, log_every_k_ticks=10000, simulate_till=None):
    import website.production_update as production_update
    from website import db
    from website.database.map import Hex
    from website.utils.game_engine import check_events_completion, climate_event_impact

    with app.app_context():
        while True:
            try:
                requests.get(f"http://localhost:{port}")
            except requests.exceptions.ConnectionError:
                sleep(1)
                continue
            break
        user_sessions = {}
        if create_users:
            max_player = max((action["player_id"] for action in actions if "player_id" in action), default=0)
            for player_id in range(1, max_player + 1):
                user_sessions[player_id] = create_user(player_id, port)
        else:
            for player_id in range(1, 19 + 1):
                user_sessions[player_id] = login_user(player_id, port)
        engine = current_app.config["engine"]

        for action in actions:
            print(action)
            if action["endpoint"] == "update_electricity":
                engine.data["total_t"] += 1
                engine.log(f"t = {engine.data['total_t']}")
                production_update.update_electricity(engine=engine)
                check_events_completion(engine)
                db.session.commit()
                if action["total_t"] % log_every_k_ticks == 0:
                    with open("instance/engine_data.pck", "wb") as file:
                        pickle.dump(engine.data, file)
                    with tarfile.open(f"checkpoints/checkpoint_{action["total_t"]}.tar.gz", "w:gz") as tar:
                        tar.add("instance/")
            elif action["endpoint"] == "climate_event_impact":
                tile = Hex.query.get(action["tile_id"])
                climate_event_impact(engine, tile, action["event"])
            else:
                player_id = action["player_id"]
                if action["endpoint"] == "/api/choose_location" and player_id not in user_sessions:
                    user_sessions[player_id] = create_user(player_id, port)
                response = user_sessions[player_id].post(
                    f"http://localhost:{port}{action['endpoint']}", json=action["request_content"]
                )
                if response.status_code != 200:
                    print(f"Status code: {response.status_code}")
                    if response.status_code // 100 == 4:
                        print("\033[33m" + response.text + "\033[0m")
                    elif response.status_code // 100 == 5:
                        print("\033[31m" + "Server error, look at the stack above.\033[0m")
            try:
                verify(engine)
            except AssertionError:
                print(print("\033[31m" + "Assertion error.\033[0m"))
