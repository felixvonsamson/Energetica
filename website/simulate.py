import requests
from flask import current_app


def create_user(id, port):
    session = requests.Session()
    data = {"username": f"user{id}", "password1": "password", "password2": "password"}
    session.post(f"http://localhost:{port}/sign-up", data=data)
    return session


def simulate(app, port, actions):
    import website.production_update as production_update
    from website import db
    from website.database.map import Hex
    from website.utils.game_engine import check_events_completion, climate_event_impact

    with app.app_context():
        user_sessions = {}
        engine = current_app.config["engine"]
        for action in actions:
            print(action)
            if action["endpoint"] == "update_electricity":
                engine.data["total_t"] += 1
                engine.log(f"t = {engine.data['total_t']}")
                production_update.update_electricity(engine=engine)
                check_events_completion(engine)
                db.session.commit()
            elif action["endpoint"] == "climate_event_impact":
                tile = Hex.query.get(action["tile_id"])
                climate_event_impact(engine, tile, action["event"])
            else:
                player_id = action["player_id"]
                if action["endpoint"] == "/api/choose_location" and player_id not in user_sessions:
                    user_sessions[player_id] = create_user(player_id, port)
                user_sessions[player_id].post(
                    f"http://localhost:{port}{action['endpoint']}", json=action["request_content"]
                )