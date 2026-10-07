"""Test helpers that talk to an app's Socket.IO server through its HTTP long-polling transport.

A ``TestClient`` cannot open a WebSocket to Socket.IO, but polling is plain HTTP: a GET opens an
Engine.IO session, a POST of ``40`` asks to connect, and each later GET returns whatever the server
has queued for that session. The connection runs the server's ``connect`` handler, entry gate
included, with the client's cookies, so these test the real mounted server.
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

_POLLING_URL = "/socket.io/?EIO=4&transport=polling"


def connect(client: TestClient) -> tuple[str, dict]:
    """Connect to the server with ``client``'s cookies.

    Returns the Engine.IO session id, for :func:`poll`, and the server's answer: ``{"sid": ...}`` when
    it admitted the connection, or ``{"message": ...}`` when it refused it.
    """
    opened = client.get(_POLLING_URL)
    assert opened.status_code == 200
    sid = json.loads(opened.text[1:])["sid"]
    assert client.post(f"{_POLLING_URL}&sid={sid}", content="40").status_code == 200
    (packet,) = poll(client, sid)
    return sid, packet


def is_admitted(answer: dict) -> bool:
    """Whether the answer :func:`connect` returned admitted the connection."""
    return "sid" in answer


def poll(client: TestClient, sid: str) -> list:
    """The Socket.IO packets the server has queued for ``sid``, each decoded from its JSON payload.

    A connect answer decodes to its object, and an event to its ``[name, data]`` list.
    """
    response = client.get(f"{_POLLING_URL}&sid={sid}")
    assert response.status_code == 200
    # Engine.IO separates the packets in one polling response with the record separator.
    return [_decode(packet) for packet in response.text.split("\x1e")]


def _decode(packet: str) -> object:
    # "4" marks an Engine.IO message, then "0" (connect), "2" (event) or "4" (connect refused).
    assert packet[0] == "4" and packet[1] in "024", f"unexpected packet {packet!r}"
    return json.loads(packet[2:])
