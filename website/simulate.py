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


def simulate(app, port, actions, log_every_k_ticks=10000, checkpoint_ticks=[]):
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
        engine = current_app.config["engine"]

        for action in actions:
            print(action)
            verify(engine)
            if action["action_type"] == "tick":
                engine.data["total_t"] += 1
                engine.log(f"t = {engine.data['total_t']}")
                production_update.update_electricity(engine=engine)
                check_events_completion(engine)
                db.session.commit()
                if action["total_t"] % log_every_k_ticks == 0 or action["total_t"] in checkpoint_ticks:
                    with open("instance/engine_data.pck", "wb") as file:
                        pickle.dump(engine.data, file)
                    with tarfile.open(f"checkpoints/checkpoint_{action["total_t"]}.tar.gz", "w:gz") as tar:
                        tar.add("instance/")
            elif action["action_type"] == "climate_event_impact":
                tile = Hex.query.get(action["tile_id"])
                climate_event_impact(engine, tile, action["event"])
            elif action["action_type"] == "create_user":
                player_id = action["player_id"]
                user_sessions[player_id] = create_user(player_id, port)
            elif action["action_type"] == "request":
                player_id = action["player_id"]
                if player_id not in user_sessions:
                    user_sessions[player_id] = login_user(player_id, port)
                url = f"http://localhost:{port}{action["request"]['endpoint']}"
                content_type = "json" if action["request"]["content_type"] == "application/json" else "data"
                response = user_sessions[player_id].post(url, **{content_type: action["request"]["content"]})
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
