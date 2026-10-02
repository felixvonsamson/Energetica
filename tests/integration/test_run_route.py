"""``GET /api/v1/run`` tells the frontend which kind of Run it is in (#994). The Workshop side is
covered in ``test_workshop_app.py``.
"""

from __future__ import annotations

from typing import get_args

from fastapi.testclient import TestClient

from energetica.freeplay.app import create_app
from energetica.identity.instance_config import run_modes
from energetica.identity.run import RunModeTag


def test_the_persistent_world_reports_the_freeplay_run_mode() -> None:
    client = TestClient(create_app(env="dev", schema_only=True))

    response = client.get("/api/v1/run")

    assert response.status_code == 200
    assert response.json() == {"mode": "freeplay"}


def test_the_reported_modes_are_the_modes_instance_json_accepts() -> None:
    assert get_args(RunModeTag) == run_modes()
