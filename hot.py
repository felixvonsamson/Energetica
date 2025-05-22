import json
import os

from energetica import create_app

try:
    kwargs_json = os.environ["ENERGETICA_APP_CONFIG"]
    kwargs = json.loads(kwargs_json)
except KeyError:
    raise RuntimeError("Missing ENERGETICA_APP_CONFIG")
except json.JSONDecodeError as e:
    raise RuntimeError(f"Invalid JSON in ENERGETICA_APP_CONFIG: {e}")

app = create_app(**kwargs)
