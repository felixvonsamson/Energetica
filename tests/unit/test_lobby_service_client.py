"""The lobby service client turns a service it cannot reach into a 503 (ADR-0009)."""

from __future__ import annotations

import socket
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

from energetica.identity.lobby_service_client import LobbyServiceClient, LobbyServiceUnavailable


@pytest.fixture
def socket_dir() -> Iterator[Path]:
    # Not pytest's tmp_path: a Unix socket path must stay under about 104 characters on macOS.
    with tempfile.TemporaryDirectory(dir="/tmp") as directory:
        yield Path(directory)


def test_no_service_on_the_socket_is_a_503(socket_dir: Path) -> None:
    client = LobbyServiceClient.connect("test", socket_path=socket_dir / "absent.sock")

    with pytest.raises(LobbyServiceUnavailable) as raised:
        client.healthz()

    assert raised.value.status_code == 503


def test_a_service_that_does_not_answer_in_time_is_a_503(socket_dir: Path) -> None:
    path = socket_dir / "silent.sock"
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
        listener.bind(str(path))
        listener.listen()  # accepts connections into the backlog, never answers
        client = LobbyServiceClient.connect("test", socket_path=path, timeout=0.2)

        with pytest.raises(LobbyServiceUnavailable) as raised:
            client.healthz()

    assert raised.value.status_code == 503
